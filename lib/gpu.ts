import { cachedFetch } from "./http";

export type GpuPrice = {
  model: string;
  offers: number;
  median: number; // $/GPU-hour
  p25: number;
  p75: number;
};

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Spot on-demand prices from the Vast.ai public marketplace. It's a retail
 * marketplace, not term-contract pricing, but it moves with the market and
 * is the best free, keyless proxy for GPU rental rates.
 */
export async function fetchGpuPrice(model: string): Promise<GpuPrice> {
  const q = {
    gpu_name: { eq: model },
    rentable: { eq: true },
    type: "on-demand",
    limit: 500,
  };
  const url = `https://console.vast.ai/api/v0/bundles/?q=${encodeURIComponent(JSON.stringify(q))}`;
  const json = (await (await cachedFetch(url)).json()) as {
    offers: { dph_total: number; num_gpus: number }[];
  };
  const prices = json.offers
    .filter((o) => o.num_gpus > 0 && o.dph_total > 0)
    .map((o) => o.dph_total / o.num_gpus)
    .sort((a, b) => a - b);
  if (!prices.length) throw new Error(`No ${model} offers`);
  return {
    model,
    offers: prices.length,
    median: quantile(prices, 0.5),
    p25: quantile(prices, 0.25),
    p75: quantile(prices, 0.75),
  };
}
