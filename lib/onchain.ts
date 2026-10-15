import { cachedFetch } from "./http";
import type { Point } from "./yahoo";

/**
 * USD.AI: a lending protocol that takes stablecoin deposits and lends them
 * against GPUs to small and mid-sized AI clouds. Its deposits (total value
 * locked) are public on DefiLlama, so this is a live read on how much
 * crypto money is willing to fund GPU loans.
 */
export async function fetchUsdAiDeposits(): Promise<Point[]> {
  const res = await cachedFetch("https://api.llama.fi/protocol/usd-ai", { timeoutMs: 20000 });
  const json = (await res.json()) as { tvl?: { date: number; totalLiquidityUSD: number }[] };
  const byDay = new Map<string, number>();
  for (const p of json.tvl ?? []) byDay.set(new Date(p.date * 1000).toISOString().slice(0, 10), +(p.totalLiquidityUSD / 1e6).toFixed(1));
  const points = [...byDay].map(([t, v]) => ({ t, v })).sort((a, b) => a.t.localeCompare(b.t));
  if (points.length < 10) throw new Error("USD.AI: too little history");
  return points;
}
