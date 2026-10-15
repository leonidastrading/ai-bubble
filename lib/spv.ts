import spvData from "@/data/ai-spvs.json";
import { toInstants, type Quarter } from "./fundamentals";
import { fetchConcept } from "./sec";
import type { Quote } from "./yahoo";

export type Spv = {
  id: string;
  name: string;
  project: string;
  type: "data-center" | "gpu";
  tenants: string[];
  equity: { name: string; share: number | null }[];
  lenders: string[];
  debtB: number | null;
  equityB: number | null;
  rating: string | null;
  terms: string;
  date: string | null;
  status: "closed" | "raising" | "reported";
  stress: { price: number; asOf: string; note: string; source: string } | null;
  /** Loan pricing over SOFR, for GPU-backed loans. */
  pricing?: { spreadBps: number; note: string; source?: string };
  source: string;
  events: { date: string | null; text: string; source: string }[];
};

// Public tickers for capital providers, so the page can show their stock moves.
const PROVIDER_TICKERS: Record<string, string> = {
  "Blue Owl": "OWL",
  Apollo: "APO",
  Nvidia: "NVDA",
  CoreWeave: "CRWV",
  Meta: "META",
  JPMorgan: "JPM",
  "Goldman Sachs": "GS",
  "Morgan Stanley": "MS",
  MUFG: "MUFG",
  SMBC: "SMFG",
};

export type ProviderRow = {
  name: string;
  role: string; // "lender", "equity" or both
  vehicles: number;
  debtInVehiclesB: number;
  ticker: string | null;
  drawdown: number | null;
};

export type SpvSummary = {
  updated: string;
  notes: string;
  spvs: Spv[];
  totalDebtB: number;
  byType: { type: string; debtB: number; count: number }[];
  byTenant: { tenant: string; debtB: number; count: number }[];
  providers: ProviderRow[];
  worstPrice: Spv["stress"] & { spv: string } | null;
};

export function getSpvSummary(quotes: Record<string, Quote>): SpvSummary {
  const spvs = spvData.spvs as Spv[];
  const sum = (xs: Spv[]) => xs.reduce((t, s) => t + (s.debtB ?? 0), 0);

  const byType = (["data-center", "gpu"] as const).map((type) => {
    const xs = spvs.filter((s) => s.type === type);
    return { type: type === "gpu" ? "GPU-backed" : "Data center", debtB: sum(xs), count: xs.length };
  });

  // The first tenant is the party that signs the lease and carries the obligation.
  const tenants = new Map<string, Spv[]>();
  for (const s of spvs) tenants.set(s.tenants[0], [...(tenants.get(s.tenants[0]) ?? []), s]);
  const byTenant = [...tenants]
    .map(([tenant, xs]) => ({ tenant, debtB: sum(xs), count: xs.length }))
    .sort((a, b) => b.debtB - a.debtB);

  const providers = new Map<string, { roles: Set<string>; spvs: Set<string>; debt: number }>();
  const add = (name: string, role: string, s: Spv) => {
    const p = providers.get(name) ?? { roles: new Set(), spvs: new Set(), debt: 0 };
    if (!p.spvs.has(s.id)) p.debt += s.debtB ?? 0;
    p.roles.add(role);
    p.spvs.add(s.id);
    providers.set(name, p);
  };
  for (const s of spvs) {
    s.lenders.forEach((l) => add(l, "lender", s));
    s.equity.forEach((e) => add(e.name, "equity", s));
  }
  const providerRows: ProviderRow[] = [...providers]
    .map(([name, p]) => {
      const ticker = PROVIDER_TICKERS[name] ?? null;
      return {
        name,
        role: [...p.roles].sort().join(" + "),
        vehicles: p.spvs.size,
        debtInVehiclesB: p.debt,
        ticker,
        drawdown: ticker ? (quotes[ticker]?.drawdown ?? null) : null,
      };
    })
    .sort((a, b) => b.debtInVehiclesB - a.debtInVehiclesB);

  const priced = spvs.filter((s) => s.stress).sort((a, b) => a.stress!.price - b.stress!.price);
  const worst = priced[0];

  return {
    updated: spvData.updated,
    notes: spvData.notes,
    spvs,
    totalDebtB: sum(spvs),
    byType,
    byTenant,
    providers: providerRows,
    worstPrice: worst ? { ...worst.stress!, spv: worst.name } : null,
  };
}

// ── What the tenants disclose (SEC XBRL, automatic) ──

export type OffBalanceRow = {
  symbol: string;
  periodEnd: string;
  operatingLeasesB: number | null;
  financeLeasesB: number | null;
  purchaseObligationsB: number | null;
  debtB: number | null;
  ratio: number | null; // (leases + purchase obligations) / debt
  series: { end: string; totalB: number }[];
};

async function latestInstants(symbol: string, concepts: string[]): Promise<Quarter[]> {
  try {
    return toInstants((await fetchConcept(symbol, concepts)).facts);
  } catch {
    return [];
  }
}

/**
 * Future lease payments and unrecorded purchase obligations are where SPV
 * deals surface in a tenant's own filings, as commitments rather than debt.
 * Leases that haven't commenced yet are disclosed only in text, so this
 * understates the total.
 */
export async function fetchOffBalance(symbol: string): Promise<OffBalanceRow> {
  const [op, fin, purchase, debt] = await Promise.all([
    latestInstants(symbol, ["LesseeOperatingLeaseLiabilityPaymentsDue"]),
    latestInstants(symbol, ["FinanceLeaseLiabilityPaymentsDue"]),
    latestInstants(symbol, ["UnrecordedUnconditionalPurchaseObligationBalanceSheetAmount", "PurchaseObligation"]),
    latestInstants(symbol, ["LongTermDebt", "LongTermDebtNoncurrent", "DebtInstrumentCarryingAmount"]),
  ]);
  const last = (xs: Quarter[]) => (xs.length ? xs[xs.length - 1] : null);
  const b = (q: Quarter | null) => (q ? q.val / 1e9 : null);
  // Label the row with the newest figure's date (leases are often only updated annually).
  const anchor = [last(op), last(fin), last(purchase)]
    .filter((q): q is Quarter => q != null)
    .sort((x, y) => y.end.localeCompare(x.end))[0];
  if (!anchor) throw new Error(`${symbol}: no lease or purchase-obligation data`);

  // Quarterly total of leases + purchase obligations. Some items are only
  // reported annually, so each one carries forward to later quarter-ends.
  const at = (xs: Quarter[], end: string) => [...xs].reverse().find((q) => q.end <= end)?.val ?? 0;
  const ends = [...new Set([...op, ...purchase].map((q) => q.end))].sort().slice(-16);
  const series = ends
    .map((end) => ({ end, totalB: (at(op, end) + at(fin, end) + at(purchase, end)) / 1e9 }))
    .filter((p) => p.totalB > 0);

  const committed = (b(last(op)) ?? 0) + (b(last(fin)) ?? 0) + (b(last(purchase)) ?? 0);
  const debtB = b(last(debt));
  return {
    symbol,
    periodEnd: anchor.end,
    operatingLeasesB: b(last(op)),
    financeLeasesB: b(last(fin)),
    purchaseObligationsB: b(last(purchase)),
    debtB,
    ratio: debtB ? committed / debtB : null,
    series,
  };
}
