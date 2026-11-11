import { fetchDailySince, type Point } from "./yahoo";

/**
 * Breadth rotation: the three-week change in equal-weight vs cap-weight S&P 500 (RSP ÷ SPY, dividend-adjusted).
 * Extreme jumps mean money leaving the mega-caps for the average stock; extreme drops mean the mega-caps are
 * pulling away. Each extreme is marked as an episode with what SPY did next.
 */

export const ROTATION_WINDOW = 15; // trading days, about three weeks
const EXTREME = 0.02; // top and bottom 2% of all windows
const GAP = 40; // quiet trading days (about two months) before a new episode of the same kind

export type RotationEpisode = {
  date: string;
  kind: "high" | "low";
  change: number; // % change in RSP ÷ SPY over the window
  spy: number;
  spyVsHigh: number; // % below SPY's one-year high
  fwd1m: number | null;
  fwd3m: number | null;
  fwd6m: number | null;
};

export type Rotation = {
  asOf: string;
  change: number; // latest three-week change, %
  percentile: number; // of all windows since the start
  spyVsHigh: number;
  thresholds: { high: number; low: number };
  regime: "broadening" | "unwind" | "megacap" | "normal";
  episodes: RotationEpisode[];
  /** Weekly SPY closes (plus every episode day) for the chart. */
  spy: Point[];
  /** SPY ÷ RSP on the same dates (rises when the mega-caps beat the average stock). */
  megacapEdge: Point[];
};

export async function fetchRotation(): Promise<Rotation> {
  const [rsp, spyPts] = await Promise.all([fetchDailySince("RSP", "2003-05-01"), fetchDailySince("SPY", "2003-05-01")]);
  const spyBy = new Map(spyPts.map((p) => [p.t, p.v]));
  const days = rsp.filter((p) => spyBy.has(p.t)).map((p) => ({ t: p.t, ratio: p.v / spyBy.get(p.t)!, spy: spyBy.get(p.t)! }));
  const n = days.length;
  const change = days.map((d, i) => (i >= ROTATION_WINDOW ? (d.ratio / days[i - ROTATION_WINDOW].ratio - 1) * 100 : null));
  const vsHigh = days.map((d, i) => (d.spy / Math.max(...days.slice(Math.max(0, i - 251), i + 1).map((x) => x.spy)) - 1) * 100);
  const sorted = change.filter((c): c is number => c != null).sort((a, b) => a - b);
  const high = sorted[Math.floor(sorted.length * (1 - EXTREME))];
  const low = sorted[Math.floor(sorted.length * EXTREME)];
  const fwd = (i: number, k: number) => (i + k < n ? (days[i + k].spy / days[i].spy - 1) * 100 : null);

  const episodes: RotationEpisode[] = [];
  const lastOf = { high: -Infinity, low: -Infinity };
  change.forEach((c, i) => {
    if (c == null) return;
    const kind = c >= high ? "high" : c <= low ? "low" : null;
    if (!kind) return;
    // One marker per episode: the first extreme day after a quiet gap.
    if (i - lastOf[kind] > GAP)
      episodes.push({ date: days[i].t, kind, change: c, spy: days[i].spy, spyVsHigh: vsHigh[i], fwd1m: fwd(i, 21), fwd3m: fwd(i, 63), fwd6m: fwd(i, 126) });
    lastOf[kind] = i;
  });

  const now = change[n - 1] ?? 0;
  const spyVsHigh = vsHigh[n - 1];
  const regime = now >= high ? (spyVsHigh <= -5 ? "unwind" : "broadening") : now <= low ? "megacap" : "normal";
  const marked = new Set(episodes.map((e) => e.date));
  // Weekly points keep the chart light; episode days and the latest day are always kept.
  const kept = days.filter((d, i) => i % 5 === 0 || marked.has(d.t) || i === n - 1);
  const spy = kept.map((d) => ({ t: d.t, v: +d.spy.toFixed(2) }));
  const megacapEdge = kept.map((d) => ({ t: d.t, v: 1 / d.ratio }));
  return {
    asOf: days[n - 1].t,
    change: now,
    percentile: (sorted.filter((v) => v < now).length / sorted.length) * 100,
    spyVsHigh,
    thresholds: { high, low },
    regime,
    episodes,
    spy,
    megacapEdge,
  };
}
