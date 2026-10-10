import { BDCS, FRED_SERIES, GPU_MODELS, NEWS_FEEDS, SEC_WATCH, TICKER_GROUPS, TRENDS_GEO, TRENDS_GROUPS } from "./config";
import { fetchFred, type FredData } from "./fred";
import { fetchGpuPrice, type GpuPrice } from "./gpu";
import { readHistory, readSavedTrends, type Snapshot } from "./history";
import { mapLimit, settle } from "./http";
import { fetchNews, type NewsItem } from "./news";
import { fetchNav, fetchTenderOffers, type Filing } from "./sec";
import { compositeScore, computeSignals, type Signal } from "./signals";
import { fetchTrends, type TrendsData } from "./trends";
import { fetchQuote, type Quote } from "./yahoo";

export type BdcRow = {
  symbol: string;
  name: string;
  price: number | null;
  nav: number | null;
  navAsOf: string | null;
  priceToNav: number | null;
};

export type TrendsGroup = {
  id: string;
  title: string;
  blurb: string;
  data: TrendsData | null;
  live: boolean; // false = served from the last saved copy
};

export type DashboardData = {
  generatedAt: string;
  score: number | null;
  signals: Signal[];
  quotes: Record<string, Quote>;
  fred: Record<string, FredData>;
  bdcs: BdcRow[];
  bdcPriceToNav: number | null;
  gpu: GpuPrice[];
  gpuChange30d: number | null;
  news: { id: string; title: string; items: NewsItem[] }[];
  tenderOffers: Filing[] | null;
  trends: TrendsGroup[];
  history: Snapshot[];
  errors: string[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const errors: string[] = [];

  const symbols = new Map<string, string>();
  for (const g of TICKER_GROUPS) for (const t of g.tickers) symbols.set(t.symbol, t.name);
  for (const b of BDCS) symbols.set(b.symbol, b.name);

  const [quoteResults, fredResults, gpuResults, newsResults, navResults, tenders, history, trendResults, savedTrends] =
    await Promise.all([
      mapLimit([...symbols], 4, ([s, n]) => settle(fetchQuote(s, n))),
      mapLimit(FRED_SERIES, 4, (f) => settle(fetchFred(f.id))),
      mapLimit(GPU_MODELS, 2, (m) => settle(fetchGpuPrice(m))),
      mapLimit(NEWS_FEEDS, 3, (f) => settle(fetchNews(f.query))),
      mapLimit(BDCS, 2, (b) => settle(fetchNav(b.symbol))),
      settle(fetchTenderOffers(SEC_WATCH)),
      readHistory(),
      // One group at a time: Trends throttles bursts.
      mapLimit(TRENDS_GROUPS, 1, (g) => settle(fetchTrends(g.keywords, g.time, TRENDS_GEO))),
      readSavedTrends<TrendsData>(),
    ]);

  const quotes = new Map<string, Quote>();
  quoteResults.forEach((r, i) => {
    const sym = [...symbols.keys()][i];
    if (r.ok) quotes.set(sym, r.data);
    else errors.push(`Price ${sym}: ${r.error}`);
  });

  const fred = new Map<string, FredData>();
  fredResults.forEach((r, i) => {
    if (r.ok) fred.set(FRED_SERIES[i].id, r.data);
    else errors.push(`FRED ${FRED_SERIES[i].id}: ${r.error}`);
  });

  const gpu: GpuPrice[] = [];
  gpuResults.forEach((r, i) => {
    if (r.ok) gpu.push(r.data);
    else errors.push(`GPU ${GPU_MODELS[i]}: ${r.error}`);
  });

  const news = NEWS_FEEDS.map((f, i) => {
    const r = newsResults[i];
    if (!r.ok) errors.push(`News ${f.title}: ${r.error}`);
    return { id: f.id, title: f.title, items: r.ok ? r.data : [] };
  });

  const bdcs: BdcRow[] = BDCS.map((b, i) => {
    const r = navResults[i];
    if (!r.ok) errors.push(`NAV ${b.symbol}: ${r.error}`);
    const price = quotes.get(b.symbol)?.last ?? null;
    const nav = r.ok ? r.data.nav : null;
    return {
      ...b,
      price,
      nav,
      navAsOf: r.ok ? r.data.asOf : null,
      priceToNav: price != null && nav ? price / nav : null,
    };
  });
  // Median, not mean: internally managed BDCs (MAIN, HTGC) carry structural
  // premiums that would otherwise mask discounts elsewhere.
  const ratios = bdcs
    .map((b) => b.priceToNav)
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const bdcPriceToNav = !ratios.length
    ? null
    : ratios.length % 2
      ? ratios[mid]
      : (ratios[mid - 1] + ratios[mid]) / 2;

  const trends: TrendsGroup[] = TRENDS_GROUPS.map((g, i) => {
    const r = trendResults[i];
    const meta = { id: g.id, title: g.title, blurb: g.blurb };
    if (r.ok) return { ...meta, data: r.data, live: true };
    const saved = savedTrends[g.id];
    const sameTerms = saved && saved.keywords.join() === g.keywords.join() && saved.time === g.time;
    errors.push(`Google Trends ${g.title}: ${r.error}${sameTerms ? " (showing last saved copy)" : ""}`);
    return { ...meta, data: sameTerms ? saved : null, live: false };
  });

  if (!tenders.ok) errors.push(`SEC tender offers: ${tenders.error}`);

  // 30-day H100 change from stored snapshots, if we have them.
  let gpuChange30d: number | null = null;
  const h100 = gpu.find((g) => g.model === "H100 SXM");
  if (h100 && history.length) {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const base = [...history].reverse().find((s) => s.date <= cutoff)?.gpu["H100 SXM"];
    if (base) gpuChange30d = (h100.median / base - 1) * 100;
  }

  const signals = computeSignals({ quotes, fred, bdcPriceToNav, gpu, gpuChange30d });

  return {
    generatedAt: new Date().toISOString(),
    score: compositeScore(signals),
    signals,
    quotes: Object.fromEntries(quotes),
    fred: Object.fromEntries(fred),
    bdcs,
    bdcPriceToNav,
    gpu,
    gpuChange30d,
    news,
    tenderOffers: tenders.ok ? tenders.data : null,
    trends,
    history,
    errors,
  };
}

export function toSnapshot(d: DashboardData): Snapshot {
  return {
    date: d.generatedAt.slice(0, 10),
    score: d.score,
    bdcPriceToNav: d.bdcPriceToNav,
    gpu: Object.fromEntries(d.gpu.map((g) => [g.model, +g.median.toFixed(3)])),
    signals: Object.fromEntries(d.signals.map((s) => [s.id, s.score])),
  };
}
