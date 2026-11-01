import { cachedFetch } from "./http";
import type { Point } from "./yahoo";

/**
 * Ramp AI Index: monthly share of US businesses on Ramp (85,000+ firms) paying for AI, from card, invoice and ACH
 * transactions, plus AI spend per employee. The page embeds the full monthly history behind its charts; the weekly
 * token-spend table and the AI share of business spend are only published for the latest period, so the daily
 * refresh saves those to the snapshot archive.
 */

export const RAMP_URL = "https://ramp.com/data/ai-index";

export type RampShare = { name: string; now: number; prev: number };

export type RampIndex = {
  asOf: string; // first day of the latest month
  overall: Point[];
  vendors: Record<string, Point[]>;
  sizes: Record<string, Point[]>;
  sectors: Record<string, Point[]>;
  spend: { t: string; median: number; top10: number; top1: number }[];
  tokens: {
    week: string | null;
    prevWeek: string | null;
    spendChangePct: number | null; // total token spend vs the same week a month earlier
    volumeChangePct: number | null;
    spendShare: RampShare[];
    volumeShare: RampShare[];
    pricePerM: RampShare[]; // blended $ per million tokens
  };
  aiShareOfSpend: { now: number; prev: number } | null; // % of non-payroll business spend
};

type Row = Record<string, string | number | null>;

/** The JSON arrays embedded in the page whose first object has exactly these keys. */
function arrays(text: string, keys: string[]): Row[][] {
  const out: Row[][] = [];
  for (const m of text.matchAll(/\[\{"date_month"[^[\]]*?\}\]/g)) {
    try {
      const rows = JSON.parse(m[0]) as Row[];
      const k = Object.keys(rows[0]).sort();
      if (k.length === keys.length && keys.every((x) => k.includes(x))) out.push(rows);
    } catch {
      // not a data array
    }
  }
  return out;
}

const series = (rows: Row[], key: string) => rows.map((r) => ({ t: String(r.date_month), v: Number(r[key]) })).filter((p) => Number.isFinite(p.v));

function groupBy(rows: Row[], by: string): Record<string, Point[]> {
  const out: Record<string, Point[]> = {};
  for (const r of rows) (out[String(r[by])] ??= []).push({ t: String(r.date_month), v: Number(r.adoption_rate_pct) });
  for (const k in out) out[k].sort((a, b) => a.t.localeCompare(b.t));
  return out;
}

const isoDate = (s: string) => {
  const d = new Date(`${s} UTC`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

function shares(text: string, label: string): RampShare[] {
  const re = new RegExp(`${label}: ([A-Za-z][\\w .&-]*?) \\$?([\\d.]+)%? \\$?([\\d.]+)%?`, "g");
  return [...text.matchAll(re)].map((m) => ({ name: m[1].trim(), now: Number(m[2]), prev: Number(m[3]) }));
}

export async function fetchRamp(): Promise<RampIndex> {
  const html = await (await cachedFetch(RAMP_URL, { timeoutMs: 30000 })).text();
  const data = html.replace(/\\"/g, '"');
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

  const [overall] = arrays(data, ["date_month", "adoption_rate_pct", "mom_change_pp", "yoy_change_pp"]);
  if (!overall?.length) throw new Error("Ramp AI Index: adoption series not found");
  const [vendors] = arrays(data, ["date_month", "vendor", "adoption_rate_pct", "mom_change_pp"]);
  const [sectors] = arrays(data, ["date_month", "naics_sector", "adoption_rate_pct", "mom_change_pp"]);
  const [sizes] = arrays(data, ["date_month", "business_size", "adoption_rate_pct", "mom_change_pp"]);
  const spendRows = arrays(data, [
    "date_month",
    "median_pepm",
    "p90_pepm",
    "p99_pepm",
    "top_10_percent_median_pepm",
    "top_1_percent_median_pepm",
    "p99_winsorized_weighted_pepm",
    "raw_weighted_pepm",
    "business_count",
    "spend_usd",
    "total_fte_denominator",
    "is_publishable",
  ])[0];

  const weeks = text.match(/Metric Week ending ([A-Z][a-z]+ \d{1,2}, \d{4}) Week ending ([A-Z][a-z]+ \d{1,2}, \d{4})/);
  const change = (what: string) => {
    const m = text.match(new RegExp(`Total token ${what} (rose|fell) ([\\d.]+)%`));
    return m ? (m[1] === "fell" ? -1 : 1) * Number(m[2]) : null;
  };
  const spendShare = text.match(/AI share of business spend \(excluding payroll\) ([\d.]+)% ([\d.]+)%/);

  const overallPts = series(overall, "adoption_rate_pct");
  return {
    asOf: overallPts[overallPts.length - 1].t,
    overall: overallPts,
    vendors: vendors ? groupBy(vendors, "vendor") : {},
    sizes: sizes ? groupBy(sizes, "business_size") : {},
    sectors: sectors ? groupBy(sectors, "naics_sector") : {},
    spend: (spendRows ?? [])
      .map((r) => ({
        t: String(r.date_month),
        median: Number(r.median_pepm),
        top10: Number(r.top_10_percent_median_pepm),
        top1: Number(r.top_1_percent_median_pepm),
      }))
      .filter((r) => Number.isFinite(r.median)),
    tokens: {
      week: weeks ? isoDate(weeks[1]) : null,
      prevWeek: weeks ? isoDate(weeks[2]) : null,
      spendChangePct: change("spending"),
      volumeChangePct: change("volume"),
      spendShare: shares(text, "Share of token spend"),
      volumeShare: shares(text, "Share of token volume"),
      pricePerM: shares(text, "Blended price per million tokens"),
    },
    aiShareOfSpend: spendShare ? { now: Number(spendShare[1]), prev: Number(spendShare[2]) } : null,
  };
}
