import { strFromU8, unzipSync } from "fflate";
import { cachedFetch } from "./http";

/**
 * How much of the S&P 500 is tied to AI, after Steve Eisman's breakdown: the tech sector, the tech-like giants, and
 * the utilities, industrials and financials whose growth now rests on the buildout. Weights come from SPY's daily
 * holdings file; sector membership from the sector SPDR funds, since SPY's own file leaves the sector blank.
 */

const SSGA = "https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-";

/** S&P 500 sector funds, one per GICS sector. */
const SECTOR_FUNDS: Record<string, string> = {
  xlk: "Information Technology",
  xlc: "Communication Services",
  xly: "Consumer Discretionary",
  xlf: "Financials",
  xlv: "Health Care",
  xli: "Industrials",
  xlp: "Consumer Staples",
  xle: "Energy",
  xlu: "Utilities",
  xlb: "Materials",
  xlre: "Real Estate",
};

export type AiGroup = {
  id: string;
  label: string;
  detail: string;
  /** Whole sector, or named companies within a sector. */
  sector?: string;
  tickers?: string[];
  ai: boolean;
};

/** Eisman's groups. Named-company lists only count members actually in the index (and in that sector). */
export const AI_GROUPS: AiGroup[] = [
  { id: "tech", label: "Information Technology", detail: "The whole sector: chips, software, hardware", sector: "Information Technology", ai: true },
  { id: "giants", label: "Tech-like giants", detail: "Alphabet, Amazon, Meta", tickers: ["GOOGL", "GOOG", "AMZN", "META"], ai: true },
  {
    id: "funding",
    label: "Financials: funding",
    detail: "Investment banks and alternative asset managers financing the buildout",
    sector: "Financials",
    tickers: ["JPM", "GS", "MS", "BAC", "C", "BX", "KKR", "APO", "ARES"],
    ai: true,
  },
  { id: "utilities", label: "Utilities", detail: "The whole sector: power for data centers", sector: "Utilities", ai: true },
  {
    id: "power",
    label: "Industrials: power",
    detail: "Generation and grid equipment and builders",
    sector: "Industrials",
    tickers: ["GEV", "PWR", "VRT"],
    ai: true,
  },
  {
    id: "building",
    label: "Industrials: building",
    detail: "Electrical, cooling and automation equipment for data centers",
    sector: "Industrials",
    tickers: ["ETN", "ROK", "HUBB", "EMR", "TT", "JCI"],
    ai: true,
  },
  { id: "staples", label: "Staples & healthcare", detail: "Not AI", tickers: [], ai: false },
  { id: "other", label: "Everything else", detail: "Rest of the index", tickers: [], ai: false },
];

export type AiShare = {
  asOf: string | null;
  totalAi: number; // % of the index
  groups: { id: string; label: string; detail: string; ai: boolean; weight: number; members: { ticker: string; name: string; weight: number }[] }[];
};

type Holding = { name: string; ticker: string; weight: number };

const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

/** Holdings table of an SSGA daily holdings workbook (shared strings resolved). */
async function fetchHoldings(fund: string): Promise<{ asOf: string | null; rows: Holding[] }> {
  const buf = new Uint8Array(await (await cachedFetch(`${SSGA}${fund}.xlsx`, { timeoutMs: 30000 })).arrayBuffer());
  const files = unzipSync(buf, { filter: (f) => f.name === "xl/worksheets/sheet1.xml" || f.name === "xl/sharedStrings.xml" });
  const shared = [...strFromU8(files["xl/sharedStrings.xml"] ?? new Uint8Array()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unescape(m[1].replace(/<[^>]+>/g, "")),
  );
  const rows: Record<string, string>[] = [];
  for (const r of strFromU8(files["xl/worksheets/sheet1.xml"]).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string> = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = c[3]?.match(/<v>([^<]*)<\/v>/)?.[1] ?? c[3]?.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] ?? "";
      cells[c[1]] = /t="s"/.test(c[2]) && v ? (shared[Number(v)] ?? "") : unescape(v);
    }
    rows.push(cells);
  }
  const header = rows.findIndex((r) => r.A === "Name");
  if (header < 0) throw new Error(`${fund.toUpperCase()} holdings: header not found`);
  const col = (name: string) => Object.entries(rows[header]).find(([, v]) => v === name)?.[0];
  const [tCol, wCol] = [col("Ticker"), col("Weight")];
  if (!tCol || !wCol) throw new Error(`${fund.toUpperCase()} holdings: columns not found`);
  const asOfText = rows.slice(0, header).map((r) => r.B ?? "").find((v) => /^As of /.test(v));
  const asOfDate = asOfText ? new Date(`${asOfText.replace("As of ", "")} UTC`) : null;
  return {
    asOf: asOfDate && !Number.isNaN(asOfDate.getTime()) ? asOfDate.toISOString().slice(0, 10) : null,
    rows: rows
      .slice(header + 1)
      .map((r) => ({ name: r.A ?? "", ticker: (r[tCol] ?? "").trim(), weight: Number(r[wCol]) }))
      .filter((h) => h.ticker && h.ticker !== "-" && Number.isFinite(h.weight)),
  };
}

export async function fetchAiShare(): Promise<AiShare> {
  const [spy, ...sectors] = await Promise.all([fetchHoldings("spy"), ...Object.keys(SECTOR_FUNDS).map((f) => fetchHoldings(f))]);
  const total = spy.rows.reduce((a, h) => a + h.weight, 0);
  if (spy.rows.length < 450 || total < 95) throw new Error(`SPY holdings look incomplete (${spy.rows.length} rows, ${total.toFixed(1)}%)`);
  const sectorOf = new Map<string, string>();
  Object.values(SECTOR_FUNDS).forEach((name, i) => sectors[i].rows.forEach((h) => sectorOf.set(h.ticker, name)));

  const taken = new Set<string>();
  const groups = AI_GROUPS.map((g) => ({ ...g, members: [] as Holding[] }));
  const add = (g: (typeof groups)[number], h: Holding) => {
    g.members.push(h);
    taken.add(h.ticker);
  };
  // Named companies first, then whole sectors, then staples & healthcare, then the rest.
  for (const g of groups.filter((g) => g.tickers?.length))
    for (const h of spy.rows) if (g.tickers!.includes(h.ticker) && (!g.sector || sectorOf.get(h.ticker) === g.sector)) add(g, h);
  for (const g of groups.filter((g) => g.sector && !g.tickers)) for (const h of spy.rows) if (!taken.has(h.ticker) && sectorOf.get(h.ticker) === g.sector) add(g, h);
  const staples = groups.find((g) => g.id === "staples")!;
  for (const h of spy.rows) if (!taken.has(h.ticker) && ["Consumer Staples", "Health Care"].includes(sectorOf.get(h.ticker) ?? "")) add(staples, h);
  const other = groups.find((g) => g.id === "other")!;
  for (const h of spy.rows) if (!taken.has(h.ticker)) add(other, h);

  // Scale to the stock holdings, so cash in the fund doesn't count.
  const pct = (w: number) => (w / total) * 100;
  const out = groups.map((g) => ({
    id: g.id,
    label: g.label,
    detail: g.detail,
    ai: g.ai,
    weight: pct(g.members.reduce((a, h) => a + h.weight, 0)),
    members: g.members.sort((a, b) => b.weight - a.weight).map((h) => ({ ticker: h.ticker, name: h.name, weight: pct(h.weight) })),
  }));
  return { asOf: spy.asOf, totalAi: out.filter((g) => g.ai).reduce((a, g) => a + g.weight, 0), groups: out };
}
