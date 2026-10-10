import { fetchConcept, type Fact } from "./sec";

export type Quarter = { end: string; val: number };

const DAY = 86400_000;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY;

/** Latest-filed fact per (start, end), so restatements win. */
function dedupe(facts: Fact[]): Fact[] {
  const by = new Map<string, Fact>();
  for (const f of facts) {
    const k = `${f.start ?? ""}|${f.end}`;
    const prev = by.get(k);
    if (!prev || f.filed > prev.filed) by.set(k, f);
  }
  return [...by.values()];
}

/**
 * Turn duration facts into discrete quarters. Income-statement items come as
 * 3-month facts; cash-flow items (capex) come year-to-date (3, 6, 9, 12
 * months from the fiscal-year start), so quarters are differences between
 * consecutive cumulative values that share a start date.
 */
export function toQuarters(facts: Fact[]): Quarter[] {
  const durations = dedupe(facts.filter((f) => f.start));
  const out = new Map<string, number>();

  const byStart = new Map<string, Fact[]>();
  for (const f of durations) {
    const list = byStart.get(f.start!) ?? [];
    list.push(f);
    byStart.set(f.start!, list);
  }
  for (const list of byStart.values()) {
    list.sort((a, b) => a.end.localeCompare(b.end));
    let prev: Fact | null = null;
    for (const f of list) {
      const span = days(f.start!, f.end);
      if (span >= 80 && span <= 100) {
        out.set(f.end, f.val);
      } else if (prev && span > 100 && span < 380) {
        const gap = days(prev.end, f.end);
        if (gap >= 80 && gap <= 100 && !out.has(f.end)) out.set(f.end, f.val - prev.val);
      }
      prev = f;
    }
  }
  return [...out.entries()].map(([end, val]) => ({ end, val })).sort((a, b) => a.end.localeCompare(b.end));
}

/** Point-in-time balances (receivables, inventory, investments). */
export function toInstants(facts: Fact[]): Quarter[] {
  const by = new Map<string, Fact>();
  for (const f of facts.filter((x) => !x.start)) {
    const prev = by.get(f.end);
    if (!prev || f.filed > prev.filed) by.set(f.end, f);
  }
  return [...by.values()].map((f) => ({ end: f.end, val: f.val })).sort((a, b) => a.end.localeCompare(b.end));
}

/** Trailing-twelve-month sums for every run of four consecutive quarters. */
export function ttm(qs: Quarter[]): Quarter[] {
  const out: Quarter[] = [];
  for (let i = 3; i < qs.length; i++) {
    const w = qs.slice(i - 3, i + 1);
    if (days(w[0].end, w[3].end) > 300) continue; // a quarter is missing
    out.push({ end: qs[i].end, val: w.reduce((a, q) => a + q.val, 0) });
  }
  return out;
}

/** Value one year earlier (closest period end 330–400 days back). */
export function yearAgo(series: Quarter[], end: string): number | null {
  const hit = series.find((q) => {
    const d = days(q.end, end);
    return d >= 330 && d <= 400;
  });
  return hit?.val ?? null;
}

/**
 * Quarterly series merged across alternative tags: companies switch tags over
 * the years (Alphabet moved between `Revenues` and the ASC 606 tag), so for
 * each quarter take the first tag, in preference order, that reports it.
 */
async function mergedQuarters(symbol: string, concepts: string[]): Promise<Quarter[]> {
  const lists = await Promise.all(
    concepts.map((c) =>
      // Keep retired tags too: they hold the older quarters.
      fetchConcept(symbol, [c], "USD", false)
        .then((r) => toQuarters(r.facts))
        .catch(() => [] as Quarter[]),
    ),
  );
  const merged = new Map<string, number>();
  for (const list of lists) for (const q of list) if (!merged.has(q.end)) merged.set(q.end, q.val);
  if (!merged.size) throw new Error(`${symbol}: none of ${concepts.join(", ")} reported`);
  return [...merged.entries()].map(([end, val]) => ({ end, val })).sort((a, b) => a.end.localeCompare(b.end));
}

const REVENUE = ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"];
const CAPEX = [
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "PaymentsToAcquireProductiveAssets",
  "PaymentsForCapitalImprovements",
];

export type CapexRow = {
  symbol: string;
  name: string;
  periodEnd: string;
  capexTtm: number;
  revenueTtm: number;
  capexToRevenue: number;
  capexYoY: number | null;
  revenueYoY: number | null;
  series: { end: string; capexTtm: number; revenueTtm: number }[];
};

export async function fetchCapex(symbol: string, name: string): Promise<CapexRow> {
  const [revQ, capQ] = await Promise.all([mergedQuarters(symbol, REVENUE), mergedQuarters(symbol, CAPEX)]);
  const revT = ttm(revQ);
  const capT = ttm(capQ);
  const capByEnd = new Map(capT.map((q) => [q.end, q.val]));
  const series = revT
    .filter((r) => capByEnd.has(r.end))
    .map((r) => ({ end: r.end, revenueTtm: r.val, capexTtm: capByEnd.get(r.end)! }));
  const last = series[series.length - 1];
  if (!last) throw new Error(`${symbol}: no overlapping capex/revenue quarters`);
  const capPrev = yearAgo(capT, last.end);
  const revPrev = yearAgo(revT, last.end);
  return {
    symbol,
    name,
    periodEnd: last.end,
    capexTtm: last.capexTtm,
    revenueTtm: last.revenueTtm,
    capexToRevenue: last.capexTtm / last.revenueTtm,
    capexYoY: capPrev ? (last.capexTtm / capPrev - 1) * 100 : null,
    revenueYoY: revPrev ? (last.revenueTtm / revPrev - 1) * 100 : null,
    series: series.filter((p) => days(p.end, last.end) <= 5 * 366),
  };
}

export type NvidiaHealth = {
  periodEnd: string;
  dso: number; // days sales outstanding
  dio: number | null; // days inventory outstanding
  privateStakes: number | null; // non-marketable equity (stakes in private AI firms)
  series: { end: string; dso: number; dio: number | null; revenue: number }[];
};

/**
 * Vendor-financing fingerprints at the chip supplier: customers paying
 * slower (DSO up), product piling up (DIO up), and growing stakes in the
 * private companies that buy the chips.
 */
export async function fetchNvidiaHealth(): Promise<NvidiaHealth> {
  const [revQ, cogs, ar, inv, stakes] = await Promise.all([
    mergedQuarters("NVDA", REVENUE),
    fetchConcept("NVDA", ["CostOfRevenue", "CostOfGoodsAndServicesSold"]).catch(() => null),
    fetchConcept("NVDA", ["AccountsReceivableNetCurrent"]),
    fetchConcept("NVDA", ["InventoryNet"]).catch(() => null),
    fetchConcept("NVDA", [
      "EquitySecuritiesWithoutReadilyDeterminableFairValueAmount",
      "NonMarketableEquitySecurities",
    ]).catch(() => null),
  ]);
  const cogsQ = new Map(cogs ? toQuarters(cogs.facts).map((q) => [q.end, q.val]) : []);
  const arI = new Map(toInstants(ar.facts).map((q) => [q.end, q.val]));
  const invI = new Map(inv ? toInstants(inv.facts).map((q) => [q.end, q.val]) : []);

  const series = revQ
    .filter((q) => arI.has(q.end) && q.val > 0)
    .map((q) => {
      const c = cogsQ.get(q.end);
      const i = invI.get(q.end);
      return {
        end: q.end,
        revenue: q.val,
        dso: +((arI.get(q.end)! / q.val) * 91).toFixed(1),
        dio: c && i ? +((i / c) * 91).toFixed(1) : null,
      };
    });
  const last = series[series.length - 1];
  if (!last) throw new Error("NVDA: no receivables/revenue overlap");
  const stakeI = stakes ? toInstants(stakes.facts) : [];
  return {
    periodEnd: last.end,
    dso: last.dso,
    dio: last.dio,
    privateStakes: stakeI.length ? stakeI[stakeI.length - 1].val : null,
    series: series.slice(-16),
  };
}
