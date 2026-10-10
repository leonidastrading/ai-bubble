import { BDCS, FRED_SERIES, GPU_MODELS, NEWS_FEEDS, SEC_WATCH, TICKER_GROUPS } from "./config";
import { fetchFred, type FredData } from "./fred";
import { fetchGpuPrice, type GpuPrice } from "./gpu";
import { readHistory, type Snapshot } from "./history";
import { mapLimit, settle } from "./http";
import { fetchNews, type NewsItem } from "./news";
import { fetchNav, fetchTenderOffers, type Filing } from "./sec";
import { compositeScore, computeSignals, type Signal } from "./signals";
import { fetchQuote, type Quote } from "./yahoo";

export type BdcRow = {
  symbol: string;
  name: string;
  price: number | null;
  nav: number | null;
  navAsOf: string | null;
  priceToNav: number | null;
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
  history: Snapshot[];
  errors: string[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const errors: string[] = [];

  const symbols = new Map<string, string>();
  for (const g of TICKER_GROUPS) for (const t of g.tickers) symbols.set(t.symbol, t.name);
  for (const b of BDCS) symbols.set(b.symbol, b.name);

  const [quoteResults, fredResults, gpuResults, newsResults, navResults, tenders, history] =
    await Promise.all([
      mapLimit([...symbols], 4, ([s, n]) => settle(fetchQuote(s, n))),
      mapLimit(FRED_SERIES, 4, (f) => settle(fetchFred(f.id))),
      mapLimit(GPU_MODELS, 2, (m) => settle(fetchGpuPrice(m))),
      mapLimit(NEWS_FEEDS, 3, (f) => settle(fetchNews(f.query))),
      mapLimit(BDCS, 2, (b) => settle(fetchNav(b.symbol))),
      settle(fetchTenderOffers(SEC_WATCH)),
      readHistory(),
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
  const ratios = bdcs.map((b) => b.priceToNav).filter((x): x is number => x != null);
  const bdcPriceToNav = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;

  if (!tenders.ok) errors.push(`SEC tender offers: ${tenders.error}`);

  // 30-day H100 change from stored snapshots, if we have them.
  let gpuChange30d: number | null = null;
  const h100 = gpu.find((g) => g.model === "H100 SXM");
  if (h100 && history.length) {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const base = [...history].reverse().find((s) => s.date <= cutoff)?.gpu["H100 SXM"] ?? history[0].gpu["H100 SXM"];
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
