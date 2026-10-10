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

// ── Other price sources ──
// Model keys shared across sources; they match GPU_MODELS (Vast.ai names).

export type ListPrices = Record<string, { onDemand?: number; community?: number }>;

/** RunPod's public GraphQL API (no key): secure-cloud and community-cloud list prices. */
export async function fetchRunpodPrices(): Promise<ListPrices> {
  const ids: Record<string, string> = {
    "NVIDIA B200": "B200",
    "NVIDIA H200": "H200",
    "NVIDIA H100 80GB HBM3": "H100 SXM",
    "NVIDIA H100 PCIe": "H100 PCIE",
    "NVIDIA A100-SXM4-80GB": "A100 SXM4",
  };
  const res = await fetch("https://api.runpod.io/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "ai-bubble-monitor/1.0" },
    body: JSON.stringify({ query: "query { gpuTypes { id securePrice communityPrice } }" }),
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 86400, tags: ["bubble-data"] },
  });
  if (!res.ok) throw new Error(`RunPod ${res.status}`);
  const json = (await res.json()) as { data?: { gpuTypes: { id: string; securePrice: number; communityPrice: number }[] } };
  const out: ListPrices = {};
  for (const g of json.data?.gpuTypes ?? []) {
    const model = ids[g.id];
    if (!model) continue;
    out[model] = {
      onDemand: g.securePrice > 0 ? g.securePrice : undefined,
      community: g.communityPrice > 0 ? g.communityPrice : undefined,
    };
  }
  if (!Object.keys(out).length) throw new Error("RunPod returned no matching GPUs");
  return out;
}

/** Lambda's public pricing page: lowest on-demand per-GPU price for each model. */
export async function fetchLambdaPrices(): Promise<ListPrices> {
  const html = await (await cachedFetch("https://lambda.ai/pricing")).text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
  const names: [RegExp, string][] = [
    [/B200 SXM6/, "B200"],
    [/H100 SXM/, "H100 SXM"],
    [/H100 PCIe/, "H100 PCIE"],
    [/A100 SXM 80 GB/, "A100 SXM4"],
  ];
  const out: ListPrices = {};
  // Rows look like "H100 SXM 80 GB 208 1800 GiB 22 TiB SSD $3.99"; reserved
  // rows ("NVIDIA H100 2 weeks – 1 year …") don't match these names.
  for (const m of text.matchAll(/((?:B200 SXM6|H100 SXM|H100 PCIe|A100 SXM|A100 PCIe|GH200) \d+ GB)[^$]{0,80}\$([0-9]+\.[0-9]{2})/g)) {
    const hit = names.find(([re]) => re.test(m[1]));
    if (!hit) continue;
    const price = Number(m[2]);
    const cur = out[hit[1]]?.onDemand;
    if (cur == null || price < cur) out[hit[1]] = { onDemand: price };
  }
  if (!Object.keys(out).length) throw new Error("Couldn't find prices on Lambda's pricing page");
  return out;
}

// ── Weekly market history (GetDeploying open dataset, CC BY 4.0) ──

export type GpuWeek = {
  slug: string;
  date: string;
  onDemand: number | null;
  spot: number | null;
  reserved12: number | null;
  providers: number | null;
};

export const HISTORY_SLUGS: Record<string, string> = {
  "nvidia-b200": "B200",
  "nvidia-h200": "H200",
  "nvidia-h100": "H100",
  "nvidia-a100": "A100",
  "nvidia-b300": "B300",
};

/**
 * Weekly median rental price per GPU model across ~90 cloud providers, the
 * trailing 53 weeks. Free under CC BY 4.0 (attribution: GetDeploying).
 */
export async function fetchGpuHistory(): Promise<GpuWeek[]> {
  const csv = await (await cachedFetch("https://getdeploying.com/dataset/gpu-prices/weekly.csv")).text();
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header.split(",");
  const idx = (k: string) => cols.indexOf(k);
  const [iSlug, iDate, iBill, iRes, iMed, iProv] = ["gpu_slug", "date", "billing_type", "reservation_months", "median_price", "provider_count"].map(idx);
  const weeks = new Map<string, GpuWeek>();
  for (const line of lines) {
    const c = line.split(",");
    const slug = c[iSlug];
    if (!HISTORY_SLUGS[slug]) continue;
    const key = `${slug}|${c[iDate]}`;
    const w = weeks.get(key) ?? { slug, date: c[iDate], onDemand: null, spot: null, reserved12: null, providers: null };
    const price = Number(c[iMed]);
    if (!Number.isFinite(price)) continue;
    if (c[iBill] === "ON_DEMAND") {
      w.onDemand = price;
      w.providers = Number(c[iProv]) || null;
    } else if (c[iBill] === "SPOT") w.spot = price;
    else if (c[iBill] === "RESERVATION" && c[iRes] === "12") w.reserved12 = price;
    weeks.set(key, w);
  }
  if (!weeks.size) throw new Error("GPU history: no rows for tracked models");
  return [...weeks.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Merge archived and fresh weeks; fresh rows win (the latest week can be revised). */
export function mergeGpuHistory(archived: GpuWeek[], fresh: GpuWeek[]): GpuWeek[] {
  const m = new Map(archived.map((w) => [`${w.slug}|${w.date}`, w]));
  for (const w of fresh) m.set(`${w.slug}|${w.date}`, w);
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}
