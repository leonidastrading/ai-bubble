import type { FredData } from "./fred";
import type { GpuPrice } from "./gpu";
import type { Quote } from "./yahoo";

export type Signal = {
  id: string;
  label: string;
  stage: string; // which step of the bubble-pop scenario it watches
  value: string;
  score: number; // 0 = calm, 100 = crisis
  calm: string;
  stress: string;
  detail: string;
};

/** Linear map: `calm` -> 0, `stress` -> 100, clamped. Works in either direction. */
function scale(v: number, calm: number, stress: number): number {
  return Math.round(Math.max(0, Math.min(100, ((v - calm) / (stress - calm)) * 100)));
}

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function basketDrawdown(quotes: Map<string, Quote>, symbols: string[]): number | null {
  const dds = symbols.map((s) => quotes.get(s)?.drawdown).filter((d): d is number => d != null);
  return dds.length ? avg(dds) : null;
}

function relative3m(quotes: Map<string, Quote>, symbols: string[], bench = "SPY"): number | null {
  const b = quotes.get(bench)?.chg3m;
  const xs = symbols.map((s) => quotes.get(s)?.chg3m).filter((d): d is number => d != null);
  if (b == null || !xs.length) return null;
  return avg(xs) - b;
}

export function computeSignals(input: {
  quotes: Map<string, Quote>;
  fred: Map<string, FredData>;
  bdcPriceToNav: number | null;
  gpu: GpuPrice[];
  gpuChange30d: number | null;
}): Signal[] {
  const { quotes, fred, bdcPriceToNav, gpu, gpuChange30d } = input;
  const out: Signal[] = [];

  const chips = basketDrawdown(quotes, ["NVDA", "AVGO", "AMD", "MU", "TSM", "ANET"]);
  if (chips != null)
    out.push({
      id: "chips",
      label: "AI chip basket drawdown",
      stage: "3 · Capex cut",
      value: `${f1(chips)}%`,
      score: scale(chips, -5, -45),
      calm: "> -5%",
      stress: "< -45%",
      detail: "Average distance below 52-week high for NVDA, AVGO, AMD, MU, TSM, ANET.",
    });

  const hyper = relative3m(quotes, ["MSFT", "GOOGL", "AMZN", "META"]);
  if (hyper != null)
    out.push({
      id: "hyperscalers",
      label: "Hyperscalers vs S&P (3m)",
      stage: "1 · Monetization stalls",
      value: `${f1(hyper)} pts`,
      score: scale(hyper, 2, -15),
      calm: "> +2",
      stress: "< -15",
      detail: "Investors punishing the spenders is the first sign the capex bet is in doubt.",
    });

  const orcl = quotes.get("ORCL");
  if (orcl)
    out.push({
      id: "oracle",
      label: "Oracle drawdown",
      stage: "4 · Credit transmits",
      value: `${f1(orcl.drawdown)}%`,
      score: scale(orcl.drawdown, -5, -50),
      calm: "> -5%",
      stress: "< -50%",
      detail: "Oracle carries roughly two-thirds of SPV-financed data center debt.",
    });

  const neo = basketDrawdown(quotes, ["CRWV", "NBIS"]);
  if (neo != null)
    out.push({
      id: "neoclouds",
      label: "Neocloud drawdown",
      stage: "4 · Credit transmits",
      value: `${f1(neo)}%`,
      score: scale(neo, -15, -70),
      calm: "> -15%",
      stress: "< -70%",
      detail: "CoreWeave & Nebius: GPU-backed borrowers, most exposed to rental price declines.",
    });

  const owl = quotes.get("OWL");
  if (owl)
    out.push({
      id: "owl",
      label: "Blue Owl drawdown",
      stage: "4 · Credit transmits",
      value: `${f1(owl.drawdown)}%`,
      score: scale(owl.drawdown, -10, -65),
      calm: "> -10%",
      stress: "< -65%",
      detail: "Purest public play on data-center SPV lending. Crowded short: watch for squeezes.",
    });

  const alts = relative3m(quotes, ["APO", "BX", "KKR", "ARES"]);
  if (alts != null)
    out.push({
      id: "alts",
      label: "Alt managers vs S&P (3m)",
      stage: "4 · Credit transmits",
      value: `${f1(alts)} pts`,
      score: scale(alts, 0, -25),
      calm: "> 0",
      stress: "< -25",
      detail: "APO, BX, KKR, ARES relative to SPY over three months.",
    });

  if (bdcPriceToNav != null)
    out.push({
      id: "bdc",
      label: "BDC price / NAV (median)",
      stage: "4 · Credit transmits",
      value: `${f2(bdcPriceToNav)}x`,
      score: scale(bdcPriceToNav, 1.05, 0.8),
      calm: "> 1.05x",
      stress: "< 0.80x",
      detail: "Market price vs. self-reported NAV. A 15–20% discount says private marks are too high.",
    });

  const h100 = gpu.find((g) => g.model === "H100 SXM");
  if (h100)
    out.push({
      id: "gpu",
      label: "H100 rental $/hr",
      stage: "2 · Price deflation",
      value: `$${f2(h100.median)}${gpuChange30d != null ? ` (${gpuChange30d >= 0 ? "+" : ""}${f1(gpuChange30d)}% 30d)` : ""}`,
      score: scale(h100.median, 2.75, 1.0),
      calm: "> $2.75",
      stress: "< $1.00",
      detail: "Median on-demand marketplace price. Falling rates erode GPU-SPV collateral.",
    });

  const reits = basketDrawdown(quotes, ["EQIX", "DLR", "IRM"]);
  if (reits != null)
    out.push({
      id: "reits",
      label: "Data center REIT drawdown",
      stage: "3 · Capex cut",
      value: `${f1(reits)}%`,
      score: scale(reits, -5, -35),
      calm: "> -5%",
      stress: "< -35%",
      detail: "Multiple compression from ~30x toward ~18x FFO would show up here.",
    });

  const hy = fred.get("BAMLH0A0HYM2");
  if (hy)
    out.push({
      id: "hy",
      label: "High-yield spread",
      stage: "4 · Credit transmits",
      value: `${f2(hy.last)}%`,
      score: scale(hy.last, 3.0, 6.5),
      calm: "< 3.0%",
      stress: "> 6.5%",
      detail: `ICE BofA US HY OAS, as of ${hy.lastDate}.`,
    });

  const ccc = fred.get("BAMLH0A3HYC");
  if (ccc)
    out.push({
      id: "ccc",
      label: "CCC spread",
      stage: "4 · Credit transmits",
      value: `${f2(ccc.last)}%`,
      score: scale(ccc.last, 8, 16),
      calm: "< 8%",
      stress: "> 16%",
      detail: `Weakest borrowers. As of ${ccc.lastDate}.`,
    });

  const vix = quotes.get("^VIX")?.last ?? fred.get("VIXCLS")?.last;
  if (vix != null)
    out.push({
      id: "vix",
      label: "VIX",
      stage: "6 · Macro spillover",
      value: f1(vix),
      score: scale(vix, 14, 35),
      calm: "< 14",
      stress: "> 35",
      detail: "Equity implied volatility.",
    });

  const nfci = fred.get("NFCI");
  if (nfci)
    out.push({
      id: "nfci",
      label: "Financial conditions (NFCI)",
      stage: "6 · Macro spillover",
      value: f2(nfci.last),
      score: scale(nfci.last, -0.5, 0.5),
      calm: "< -0.5",
      stress: "> 0.5",
      detail: `Chicago Fed index, as of ${nfci.lastDate}. Positive = tighter than average.`,
    });

  const spy = quotes.get("SPY");
  if (spy)
    out.push({
      id: "spx",
      label: "S&P 500 drawdown",
      stage: "6 · Macro spillover",
      value: `${f1(spy.drawdown)}%`,
      score: scale(spy.drawdown, -3, -30),
      calm: "> -3%",
      stress: "< -30%",
      detail: "The scenario's endgame is a 25–35% index decline.",
    });

  const info = fred.get("LNU04032237");
  if (info?.changeYoY != null)
    out.push({
      id: "whitecollar",
      label: "Info-sector unemployment (YoY)",
      stage: "Layoff spiral",
      value: `${info.last.toFixed(1)}% (${info.changeYoY >= 0 ? "+" : ""}${f1(info.changeYoY)} pts)`,
      score: scale(info.changeYoY, 0, 2.5),
      calm: "≤ 0 pts",
      stress: "> +2.5 pts",
      detail: "Rising white-collar unemployment while margins hit records is the 'too successful too fast' fingerprint.",
    });

  return out;
}

export function compositeScore(signals: Signal[]): number | null {
  if (!signals.length) return null;
  return Math.round(avg(signals.map((s) => s.score)));
}

export function scoreLabel(score: number): { label: string; tone: "calm" | "watch" | "elevated" | "stress" } {
  if (score < 25) return { label: "Calm", tone: "calm" };
  if (score < 45) return { label: "Watch", tone: "watch" };
  if (score < 65) return { label: "Elevated", tone: "elevated" };
  return { label: "Stress", tone: "stress" };
}
