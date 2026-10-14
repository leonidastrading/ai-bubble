import { strFromU8, unzipSync } from "fflate";
import type { FredData } from "./fred";
import { cachedFetch } from "./http";
import { sheetRows } from "./intelligence";
import type { Point, Quote } from "./yahoo";

/**
 * Classic market-wide bubble gauges: Shiller CAPE and P/E, the excess CAPE
 * yield, the Buffett indicator, the 10y−2y yield curve, Fed hiking cycles,
 * breadth and margin debt. All monthly or quarterly, all from free sources.
 */

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

/** multpl.com monthly tables (Shiller's data plus a current reading), oldest first. */
export async function fetchMultpl(path: "shiller-pe" | "s-p-500-pe-ratio"): Promise<Point[]> {
  const html = await (await cachedFetch(`https://www.multpl.com/${path}/table/by-month`)).text();
  const points: Point[] = [];
  for (const m of html.matchAll(/<tr[^>]*>\s*<td>([A-Z][a-z]{2}) (\d{1,2}), (\d{4})<\/td>\s*<td>([\s\S]*?)<\/td>/g)) {
    const v = Number(m[4].replace(/<[^>]+>|&#x2002;|[^\d.]/g, ""));
    const mm = MONTHS[m[1]];
    if (mm && Number.isFinite(v) && v > 0) points.push({ t: `${m[3]}-${mm}-${m[2].padStart(2, "0")}`, v });
  }
  if (points.length < 100) throw new Error(`multpl ${path}: only ${points.length} rows`);
  return points.reverse();
}

/** FINRA customer margin debit balances, $ millions, monthly since 1997. */
export async function fetchMarginDebt(): Promise<Point[]> {
  const buf = new Uint8Array(
    await (await cachedFetch("https://www.finra.org/sites/default/files/2021-03/margin-statistics.xlsx", { timeoutMs: 30000 })).arrayBuffer(),
  );
  const files = unzipSync(buf, { filter: (f) => f.name === "xl/worksheets/sheet1.xml" });
  const rows = sheetRows(strFromU8(files["xl/worksheets/sheet1.xml"]));
  const points: Point[] = [];
  for (const r of rows) {
    const ym = r.find((c) => c.col === "A")?.value ?? "";
    const debit = Number(r.find((c) => c.col === "B")?.value);
    if (/^\d{4}-\d{2}$/.test(ym) && Number.isFinite(debit) && debit > 0) points.push({ t: `${ym}-01`, v: debit });
  }
  if (points.length < 100) throw new Error(`FINRA margin statistics: only ${points.length} rows`);
  return points.sort((a, b) => a.t.localeCompare(b.t));
}

/** Last value on or before `t` (points sorted oldest first). */
function asOf(points: Point[], t: string): number | null {
  let lo = 0;
  let hi = points.length - 1;
  let found: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) {
      found = points[mid].v;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const monthsBefore = (t: string, n: number) => {
  const d = new Date(`${t.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

export type Status = "normal" | "elevated" | "flashing";

export type Gauge = {
  id: string;
  act: 1 | 2 | 3;
  label: string;
  value: string;
  status: Status;
  rule: string;
};

export type HikeCycle = { start: string; from: number; peakDate: string; peak: number };

export type Valuation = {
  cape: { t: string; cape: number | null; pe: number | null }[];
  capeNow: number | null;
  peNow: number | null;
  capeAvgPost1990: number | null;
  ecy: { t: string; shiller: number | null; tips: number | null }[];
  buffett: Point[];
  curve: Point[];
  curveNow: { v: number; t: string } | null;
  fedFunds: Point[];
  cycles: HikeCycle[];
  hikeSoFar: { from: number; now: number; since: string } | null;
  breadth1y: number | null;
  margin: { t: string; debtB: number; yoy: number | null; spyYoy: number | null }[];
  gauges: Gauge[];
};

/** Fed hiking cycles: trough-to-peak moves of at least 1 point in the monthly rate. */
function hikingCycles(ff: Point[], min = 1): HikeCycle[] {
  const out: HikeCycle[] = [];
  if (!ff.length) return out;
  let trough = ff[0];
  let peak = ff[0];
  let rising = false;
  for (const p of ff) {
    if (!rising) {
      // Keep the lowest rate but the latest month near it, so a long stretch
      // at zero dates the cycle from when hikes actually began.
      if (p.v - trough.v <= 0.1) trough = { t: p.t, v: Math.min(p.v, trough.v) };
      if (p.v - trough.v >= 0.5) {
        rising = true;
        peak = p;
      }
    } else {
      if (p.v > peak.v) peak = p;
      if (peak.v - p.v >= 0.5) {
        if (peak.v - trough.v >= min) out.push({ start: trough.t, from: trough.v, peakDate: peak.t, peak: peak.v });
        rising = false;
        trough = p;
      }
    }
  }
  if (rising && peak.v - trough.v >= min) out.push({ start: trough.t, from: trough.v, peakDate: peak.t, peak: peak.v });
  return out;
}

const yoyPct = (points: Point[], t: string) => {
  const now = asOf(points, t);
  const then = asOf(points, monthsBefore(t, 12));
  return now != null && then ? (now / then - 1) * 100 : null;
};

export function computeValuation(input: {
  cape: Point[];
  pe: Point[];
  fred: Map<string, FredData>;
  quotes: Map<string, Quote>;
  margin: Point[];
}): Valuation {
  const { cape, pe, fred, quotes, margin } = input;
  const f = (id: string) => fred.get(id)?.points ?? [];

  // CAPE and P/E, monthly. multpl's newest row is a current reading, keep it.
  const capeRows = cape.filter((p) => p.t >= "1900-01-01").map((p) => ({ t: p.t, cape: p.v, pe: asOf(pe, p.t) }));
  const capeNow = cape.at(-1)?.v ?? null;
  const peNow = pe.at(-1)?.v ?? null;
  const post1990 = cape.filter((p) => p.t >= "1990-01-01").map((p) => p.v);
  const capeAvgPost1990 = post1990.length ? post1990.reduce((a, b) => a + b, 0) / post1990.length : null;

  // Excess CAPE yield. Shiller: 10y Treasury minus trailing 10-year CPI inflation.
  // TIPS: 10-year TIPS yield (market-implied real yield), from 2003 monthly.
  const gs10 = f("GS10");
  const tips = f("FII10");
  const cpi = f("CPIAUCSL");
  const ecy = cape
    .filter((p) => p.t >= "1963-01-01")
    .map((p) => {
      const ey = 100 / p.v;
      const y10 = asOf(gs10, p.t);
      const c0 = asOf(cpi, monthsBefore(p.t, 120));
      const c1 = asOf(cpi, monthsBefore(p.t, 1));
      const infl = c0 && c1 ? (Math.pow(c1 / c0, 1 / 10) - 1) * 100 : null;
      const tipsY = tips.length && p.t >= tips[0].t ? asOf(tips, p.t) : null;
      return {
        t: p.t,
        shiller: y10 != null && infl != null ? +(ey - (y10 - infl)).toFixed(2) : null,
        tips: tipsY != null ? +(ey - tipsY).toFixed(2) : null,
      };
    })
    .filter((r) => r.shiller != null || r.tips != null);
  // The newest TIPS reading is daily; use it for today's value.
  const dTips = fred.get("DFII10");
  if (ecy.length && dTips && capeNow) ecy[ecy.length - 1].tips = +(100 / capeNow - dTips.last).toFixed(2);

  // Buffett indicator: market value of nonfinancial corporate equities ÷ GDP (Fed Z.1, BEA).
  const eq = f("NCBEILQ027S");
  const gdp = f("GDP");
  const buffett = eq.flatMap((p) => {
    const g = asOf(gdp, p.t);
    return g ? [{ t: p.t, v: +((p.v / 1000 / g) * 100).toFixed(1) }] : [];
  });

  // Yield curve: monthly 10y − 2y since 1976, plus today's daily spread.
  const gs2 = f("GS2");
  const curve = gs2.flatMap((p) => {
    const y = asOf(gs10, p.t);
    return y != null ? [{ t: p.t, v: +(y - p.v).toFixed(2) }] : [];
  });
  const t10y2y = fred.get("T10Y2Y");
  const curveNow = t10y2y ? { v: t10y2y.last, t: t10y2y.lastDate } : null;

  // Fed hiking cycles, and the hike so far from the low of the past two years.
  const fedFunds = f("FEDFUNDS");
  const cycles = hikingCycles(fedFunds);
  const dff = fred.get("DFF");
  let hikeSoFar: Valuation["hikeSoFar"] = null;
  if (dff) {
    const cut = monthsBefore(dff.lastDate, 24);
    const win = dff.points.filter((p) => p.t >= cut);
    const low = win.reduce((a, b) => (b.v < a.v ? b : a), win[0]);
    if (low) hikeSoFar = { from: low.v, now: dff.last, since: low.t };
  }

  // Breadth: equal-weight S&P 500 vs the cap-weighted index over 12 months.
  const ret1y = (s: string) => {
    const q = quotes.get(s);
    if (!q) return null;
    const then = asOf(q.points, monthsBefore(q.points.at(-1)!.t, 12));
    return then ? (q.last / then - 1) * 100 : null;
  };
  const rsp = ret1y("RSP");
  const spy = ret1y("SPY");
  const breadth1y = rsp != null && spy != null ? rsp - spy : null;

  // Margin debt growth vs the market's growth over the same 12 months.
  const spyPts = quotes.get("SPY")?.points ?? [];
  const marginRows = margin
    .filter((p) => p.t >= "1998-01-01")
    .map((p) => ({ t: p.t, debtB: +(p.v / 1000).toFixed(1), yoy: yoyPct(margin, p.t), spyYoy: spyPts.length && p.t >= spyPts[0].t ? yoyPct(spyPts, monthEnd(p.t)) : null }));

  // Seven gauges with the same thresholds as the explainer they came from.
  const gauges: Gauge[] = [];
  if (capeNow != null) {
    const base = 27;
    gauges.push({
      id: "cape",
      act: 1,
      label: "Shiller CAPE",
      value: capeNow.toFixed(1),
      status: capeNow >= base * 1.35 ? "flashing" : capeNow >= base * 1.15 ? "elevated" : "normal",
      rule: `Elevated 15% above its post-2002 normal (~27), flashing 35% above (≥${(base * 1.35).toFixed(1)})`,
    });
  }
  const ecyNow = ecy.at(-1);
  const ecyVal = ecyNow?.tips ?? ecyNow?.shiller ?? null;
  if (ecyVal != null)
    gauges.push({
      id: "ecy",
      act: 1,
      label: "Excess CAPE yield",
      value: `${ecyVal.toFixed(2)}%${ecyNow?.tips != null ? " (TIPS)" : ""}`,
      status: ecyVal < 2 ? "flashing" : ecyVal < 3 ? "elevated" : "normal",
      rule: "Elevated below 3%, flashing below 2% (stocks barely out-yield safe real bonds)",
    });
  const bNow = buffett.at(-1);
  if (bNow)
    gauges.push({
      id: "buffett",
      act: 1,
      label: "Buffett indicator",
      value: `${bNow.v.toFixed(0)}% of GDP`,
      status: bNow.v >= 140 ? "flashing" : bNow.v >= 110 ? "elevated" : "normal",
      rule: `Elevated at 110% of GDP, flashing at 140%. As of ${bNow.t}`,
    });
  if (curveNow)
    gauges.push({
      id: "curve",
      act: 2,
      label: "Yield curve (10y − 2y)",
      value: `${curveNow.v >= 0 ? "+" : ""}${curveNow.v.toFixed(2)} pts`,
      status: curveNow.v < 0 ? "flashing" : "normal",
      rule: "Flashing when inverted (below zero); recessions have followed within 12–24 months",
    });
  if (hikeSoFar) {
    const size = hikeSoFar.now - hikeSoFar.from;
    gauges.push({
      id: "hikes",
      act: 2,
      label: "Fed rate hikes",
      value: `${size >= 0 ? "+" : ""}${size.toFixed(2)} pts from ${hikeSoFar.from.toFixed(2)}%`,
      status: size >= 1.5 ? "flashing" : size >= 0.2 ? "elevated" : "normal",
      rule: "Change in the Fed funds rate from its low of the past two years. Elevated while hiking, flashing at 1.5+ points",
    });
  }
  if (breadth1y != null)
    gauges.push({
      id: "breadth",
      act: 3,
      label: "Breadth (equal-weight vs index, 1y)",
      value: `${breadth1y >= 0 ? "+" : ""}${breadth1y.toFixed(1)} pts`,
      status: breadth1y <= -10 ? "flashing" : breadth1y <= -3 ? "elevated" : "normal",
      rule: "RSP minus SPY over 12 months. Elevated when the typical stock trails by 3+ points, flashing at 10+",
    });
  const mNow = marginRows.at(-1);
  if (mNow?.yoy != null) {
    const gap = mNow.spyYoy != null ? mNow.yoy - mNow.spyYoy : null;
    gauges.push({
      id: "margin",
      act: 3,
      label: "Margin debt",
      value: `$${(mNow.debtB / 1000).toFixed(2)}T, ${mNow.yoy >= 0 ? "+" : ""}${mNow.yoy.toFixed(0)}% y/y`,
      status: gap != null && gap >= 20 ? "flashing" : gap != null && gap >= 10 ? "elevated" : "normal",
      rule: `Borrowing growth minus S&P 500 growth over 12 months${gap != null ? ` (now ${gap >= 0 ? "+" : ""}${gap.toFixed(0)} pts)` : ""}. Elevated at 10+ points, flashing at 20+. As of ${mNow.t.slice(0, 7)}`,
    });
  }

  return {
    cape: capeRows,
    capeNow,
    peNow,
    capeAvgPost1990,
    ecy,
    buffett,
    curve,
    curveNow,
    fedFunds,
    cycles,
    hikeSoFar,
    breadth1y,
    margin: marginRows,
    gauges,
  };
}

/** FINRA reports month-end balances; compare against month-end prices. */
function monthEnd(t: string): string {
  const d = new Date(`${t.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}
