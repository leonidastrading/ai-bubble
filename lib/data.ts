import { BDCS, CAPEX_COMPANIES, SOFTWARE_GROUP, FRED_SERIES, GPU_MODELS, NEWS_FEEDS, SEC_WATCH, TICKER_GROUPS, TRENDS_GEO, TRENDS_GROUPS } from "./config";
import { fetchFred, type FredData } from "./fred";
import { fetchCapex, fetchNvidiaHealth, type CapexRow, type NvidiaHealth } from "./fundamentals";
import { fetchGpuHistory, fetchGpuPrice, fetchLambdaPrices, fetchRunpodPrices, mergeGpuHistory, type GpuPrice, type GpuWeek, type ListPrices } from "./gpu";
import { readGpuArchive, readHistory, readPriceLog, readSavedTrends, type PricePoint, type Snapshot } from "./history";
import { mapLimit, settle } from "./http";
import { fetchNews, type NewsItem } from "./news";
import { getNetwork, type Network } from "./network";
import { fetchDataCenterConstruction } from "./owid";
import { computeGap, fetchBtosAi, fetchEci, fetchOpenRouter, priceModels, type AdoptionSeries, type GapSummary, type PricedModel } from "./intelligence";
import { fetchOffBalance, getSpvSummary, type OffBalanceRow, type SpvSummary } from "./spv";
import { fetchNav, fetchTenderOffers, type Filing } from "./sec";
import { compositeScore, computeSignals, type Signal } from "./signals";
import { fetchTrends, type TrendsData } from "./trends";
import { fetchQuote, type Point, type Quote } from "./yahoo";

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
  runpod: ListPrices | null;
  lambda: ListPrices | null;
  gpuHistory: GpuWeek[];
  dcConstruction: Point[] | null;
  intel: {
    gap: GapSummary | null;
    priced: PricedModel[];
    frontierBlended: number | null;
    cheapestNearFrontier: PricedModel | null;
    priceLog: Record<string, PricePoint[]>;
    adoption: AdoptionSeries | null;
  };
  news: { id: string; title: string; items: NewsItem[] }[];
  tenderOffers: Filing[] | null;
  trends: TrendsGroup[];
  capex: CapexRow[];
  capexAggregate: { capexYoY: number; revenueYoY: number; capexToRevenue: number } | null;
  nvidia: NvidiaHealth | null;
  network: Network | null;
  spv: SpvSummary;
  offBalance: OffBalanceRow[];
  history: Snapshot[];
  errors: string[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const errors: string[] = [];

  const symbols = new Map<string, string>();
  for (const g of TICKER_GROUPS) for (const t of g.tickers) symbols.set(t.symbol, t.name);
  for (const t of SOFTWARE_GROUP.tickers) symbols.set(t.symbol, t.name);
  for (const b of BDCS) symbols.set(b.symbol, b.name);

  const [quoteResults, fredResults, gpuResults, newsResults, navResults, tenders, history, trendResults, savedTrends, capexResults, nvidiaResult] =
    await Promise.all([
      mapLimit([...symbols], 4, ([s, n]) => settle(fetchQuote(s, n))),
      mapLimit(FRED_SERIES, 4, (f) => settle(fetchFred(f.id, f.years))),
      mapLimit(GPU_MODELS, 2, (m) => settle(fetchGpuPrice(m))),
      mapLimit(NEWS_FEEDS, 3, (f) => settle(fetchNews(f.query))),
      mapLimit(BDCS, 2, (b) => settle(fetchNav(b.symbol))),
      settle(fetchTenderOffers(SEC_WATCH)),
      readHistory(),
      // One group at a time: Trends throttles bursts.
      mapLimit(TRENDS_GROUPS, 1, (g) => settle(fetchTrends(g.keywords, g.time, TRENDS_GEO))),
      readSavedTrends<TrendsData>(),
      mapLimit(CAPEX_COMPANIES, 1, (c) => settle(fetchCapex(c.symbol, c.name))),
      settle(fetchNvidiaHealth()),
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

  const capex: CapexRow[] = [];
  capexResults.forEach((r, i) => {
    if (r.ok) capex.push(r.data);
    else errors.push(`Capex ${CAPEX_COMPANIES[i].symbol}: ${r.error}`);
  });
  // Dollar-weighted: sum TTM capex and revenue across companies, now vs. a year ago.
  const withYoY = capex.filter((c) => c.capexYoY != null && c.revenueYoY != null);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const capexAggregate = withYoY.length
    ? {
        capexYoY: (sum(withYoY.map((c) => c.capexTtm)) / sum(withYoY.map((c) => c.capexTtm / (1 + c.capexYoY! / 100))) - 1) * 100,
        revenueYoY: (sum(withYoY.map((c) => c.revenueTtm)) / sum(withYoY.map((c) => c.revenueTtm / (1 + c.revenueYoY! / 100))) - 1) * 100,
        capexToRevenue: sum(withYoY.map((c) => c.capexTtm)) / sum(withYoY.map((c) => c.revenueTtm)),
      }
    : null;
  if (!nvidiaResult.ok) errors.push(`Nvidia filings: ${nvidiaResult.error}`);
  const nvidia = nvidiaResult.ok ? nvidiaResult.data : null;

  if (!tenders.ok) errors.push(`SEC tender offers: ${tenders.error}`);

  // 30-day H100 change from stored snapshots, if we have them.
  let gpuChange30d: number | null = null;
  const h100 = gpu.find((g) => g.model === "H100 SXM");
  if (h100 && history.length) {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const base = [...history].reverse().find((s) => s.date <= cutoff)?.gpu["H100 SXM"];
    if (base) gpuChange30d = (h100.median / base - 1) * 100;
  }

  const [networkResult, offBalanceResults, runpodR, lambdaR, gpuHistR, gpuArchive, dcR, eciR, orR, btosR, priceLog] = await Promise.all([
    settle(getNetwork(quotes, errors)),
    mapLimit(CAPEX_COMPANIES, 1, (c) => settle(fetchOffBalance(c.symbol))),
    settle(fetchRunpodPrices()),
    settle(fetchLambdaPrices()),
    settle(fetchGpuHistory()),
    readGpuArchive<GpuWeek>(),
    settle(fetchDataCenterConstruction()),
    settle(fetchEci()),
    settle(fetchOpenRouter()),
    settle(fetchBtosAi()),
    readPriceLog(),
  ]);
  if (!eciR.ok) errors.push(`Epoch capabilities: ${eciR.error}`);
  if (!orR.ok) errors.push(`OpenRouter prices: ${orR.error}`);
  if (!btosR.ok) errors.push(`Census AI adoption: ${btosR.error}`);
  const gapR = eciR.ok ? settle(Promise.resolve().then(() => computeGap(eciR.data))) : null;
  const gap = gapR ? await gapR : null;
  if (gap && !gap.ok) errors.push(`Open-weight gap: ${gap.error}`);
  const priced = eciR.ok && orR.ok ? priceModels(eciR.data, orR.data) : [];
  const frontier = priced.find((m) => !m.open) ?? null;
  // Cheapest model within 10 ECI points of the best model: what near-frontier intelligence costs.
  const nearFrontier = frontier ? priced.filter((m) => m.eci >= priced[0].eci - 10) : [];
  const cheapestNearFrontier = nearFrontier.length ? nearFrontier.reduce((a, b) => (b.blended < a.blended ? b : a)) : null;
  if (!dcR.ok) errors.push(`Data center construction: ${dcR.error}`);
  if (!runpodR.ok) errors.push(`GPU RunPod: ${runpodR.error}`);
  if (!lambdaR.ok) errors.push(`GPU Lambda: ${lambdaR.error}`);
  if (!gpuHistR.ok) errors.push(`GPU market history: ${gpuHistR.error}`);
  const gpuHistory = mergeGpuHistory(gpuArchive, gpuHistR.ok ? gpuHistR.data : []);
  const h100Weeks = gpuHistory.filter((w) => w.slug === "nvidia-h100" && w.onDemand != null);
  const h100Market = h100Weeks.length ? h100Weeks[h100Weeks.length - 1] : null;
  const offBalance: OffBalanceRow[] = [];
  offBalanceResults.forEach((r, i) => {
    if (r.ok) offBalance.push(r.data);
    else errors.push(`Off-balance-sheet ${CAPEX_COMPANIES[i].symbol}: ${r.error}`);
  });
  const spv = getSpvSummary(Object.fromEntries(quotes));
  if (!networkResult.ok) errors.push(`Deal network: ${networkResult.error}`);

  const signals = computeSignals({ quotes, fred, bdcPriceToNav, gpu, gpuChange30d, capexAggregate, nvidia, spvWorst: spv.worstPrice, openGap: gap?.ok ? gap.data : null, h100Market: h100Market && { price: h100Market.onDemand!, date: h100Market.date, providers: h100Market.providers, yearAgo: h100Weeks.find((w) => w.date >= isoDaysAgo(h100Market.date, 364))?.onDemand ?? null } });

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
    capex,
    capexAggregate,
    nvidia,
    network: networkResult.ok ? networkResult.data : null,
    spv,
    offBalance,
    runpod: runpodR.ok ? runpodR.data : null,
    lambda: lambdaR.ok ? lambdaR.data : null,
    gpuHistory,
    dcConstruction: dcR.ok ? dcR.data : null,
    intel: {
      gap: gap?.ok ? gap.data : null,
      priced,
      frontierBlended: frontier?.blended ?? null,
      cheapestNearFrontier,
      priceLog,
      adoption: btosR.ok ? btosR.data : null,
    },
    history,
    errors,
  };
}

function isoDaysAgo(iso: string, days: number): string {
  return new Date(Date.parse(iso) - days * 86400_000).toISOString().slice(0, 10);
}

export function toSnapshot(d: DashboardData): Snapshot {
  return {
    date: d.generatedAt.slice(0, 10),
    score: d.score,
    bdcPriceToNav: d.bdcPriceToNav,
    gpu: Object.fromEntries(d.gpu.map((g) => [g.model, +g.median.toFixed(3)])),
    intel: d.intel.gap
      ? {
          gap: d.intel.gap.gap,
          frontierBlended: d.intel.frontierBlended,
          cheapestNearFrontier: d.intel.cheapestNearFrontier?.blended ?? null,
        }
      : undefined,
    gpuList: Object.fromEntries(
      (
        [
          ["runpod", d.runpod],
          ["lambda", d.lambda],
        ] as const
      )
        .filter(([, v]) => v)
        .map(([k, v]) => [k, Object.fromEntries(Object.entries(v!).flatMap(([m, p]) => (p.onDemand != null ? [[m, p.onDemand]] : [])))]),
    ),
    signals: Object.fromEntries(d.signals.map((s) => [s.id, s.score])),
  };
}
