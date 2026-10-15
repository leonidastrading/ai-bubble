import { cachedFetch, mapLimit, settle } from "./http";

/**
 * Polymarket prediction markets that bear on the AI-bubble scenario. Prices
 * are the market's probability of "Yes" (0–1). Public Gamma and CLOB APIs,
 * no key needed.
 */

export const POLY_EVENTS: { slug: string; label: string; chart?: boolean }[] = [
  { slug: "ai-bubble-burst-by", label: "AI bubble bursts", chart: true },
  { slug: "coreweave-announces-bankruptcy-by", label: "CoreWeave bankruptcy", chart: true },
  { slug: "openai-announces-bankruptcy-by", label: "OpenAI bankruptcy" },
  { slug: "anthropic-announces-bankruptcy-by", label: "Anthropic bankruptcy" },
  { slug: "us-recession-by-end-of-2026", label: "US recession", chart: true },
  { slug: "another-fed-rate-hike-in-2026", label: "Fed hikes again in 2026" },
  { slug: "anthropic-ipo-by", label: "Anthropic IPO" },
];

export type PolyMarket = {
  question: string;
  label: string;
  prob: number; // 0–100
  change1w: number | null; // percentage points
  volume: number;
  endDate: string | null;
  tokenId: string | null;
};

export type PolyEvent = {
  slug: string;
  label: string;
  title: string;
  url: string;
  volume: number;
  markets: PolyMarket[];
  history: { t: string; v: number }[] | null; // headline market, % by day
  headline: string | null; // which market the history is for
};

type GammaMarket = {
  question: string;
  groupItemTitle?: string;
  outcomePrices?: string;
  closed?: boolean;
  oneWeekPriceChange?: number | null;
  volume?: string | number;
  endDate?: string;
  clobTokenIds?: string;
};

async function fetchHistory(tokenId: string): Promise<{ t: string; v: number }[]> {
  const res = await cachedFetch(`https://clob.polymarket.com/prices-history?market=${tokenId}&interval=max&fidelity=1440`, { timeoutMs: 15000 });
  const json = (await res.json()) as { history?: { t: number; p: number }[] };
  const byDay = new Map<string, number>();
  for (const p of json.history ?? []) byDay.set(new Date(p.t * 1000).toISOString().slice(0, 10), +(p.p * 100).toFixed(1));
  return [...byDay].map(([t, v]) => ({ t, v })).sort((a, b) => a.t.localeCompare(b.t));
}

async function fetchEvent(def: (typeof POLY_EVENTS)[number]): Promise<PolyEvent> {
  const res = await cachedFetch(`https://gamma-api.polymarket.com/events?slug=${def.slug}`, { timeoutMs: 15000 });
  const [ev] = (await res.json()) as { title: string; volume?: number | string; markets: GammaMarket[] }[];
  if (!ev) throw new Error(`Polymarket event not found: ${def.slug}`);
  const markets: PolyMarket[] = ev.markets
    .filter((m) => !m.closed && m.outcomePrices)
    .map((m) => {
      const prices = JSON.parse(m.outcomePrices!) as string[];
      const tokens = m.clobTokenIds ? (JSON.parse(m.clobTokenIds) as string[]) : [];
      return {
        question: m.question,
        label: m.groupItemTitle || m.question,
        prob: Number(prices[0]) * 100,
        change1w: m.oneWeekPriceChange != null ? m.oneWeekPriceChange * 100 : null,
        volume: Number(m.volume ?? 0),
        endDate: m.endDate ? m.endDate.slice(0, 10) : null,
        tokenId: tokens[0] ?? null,
      };
    })
    .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
  if (!markets.length) throw new Error(`Polymarket: no open markets for ${def.slug}`);

  // Chart the most-traded open market of the event.
  let history: PolyEvent["history"] = null;
  let headline: string | null = null;
  if (def.chart) {
    const top = [...markets].sort((a, b) => b.volume - a.volume)[0];
    if (top.tokenId) {
      const h = await settle(fetchHistory(top.tokenId));
      if (h.ok && h.data.length > 1) {
        history = h.data;
        headline = top.label;
      }
    }
  }
  return {
    slug: def.slug,
    label: def.label,
    title: ev.title,
    url: `https://polymarket.com/event/${def.slug}`,
    volume: Number(ev.volume ?? 0),
    markets,
    history,
    headline,
  };
}

export async function fetchPolymarket(errors: string[]): Promise<PolyEvent[]> {
  const results = await mapLimit(POLY_EVENTS, 3, (e) => settle(fetchEvent(e)));
  const out: PolyEvent[] = [];
  results.forEach((r, i) => {
    if (r.ok) out.push(r.data);
    else errors.push(`Polymarket ${POLY_EVENTS[i].slug}: ${r.error}`);
  });
  return out;
}
