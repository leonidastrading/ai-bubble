import type { FredData } from "./fred";
import type { NvidiaHealth } from "./fundamentals";
import type { GpuPrice } from "./gpu";
import { creditStress, impliedDefault5y, latestCds } from "./credit-stress";
import type { Valuation } from "./valuation";
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
  capexAggregate: { capexYoY: number; revenueYoY: number; capexToRevenue: number } | null;
  nvidia: NvidiaHealth | null;
  spvWorst: { price: number; asOf: string; spv: string } | null;
  h100Market: { price: number; date: string; providers: number | null; yearAgo: number | null } | null;
  valuation: Valuation;
  openGap: { gap: number; bestOpen: { model: string }; bestClosed: { model: string }; lagMonths: number | null } | null;
}): Signal[] {
  const { quotes, fred, bdcPriceToNav, gpu, gpuChange30d, capexAggregate, nvidia, spvWorst, h100Market, openGap, valuation } = input;
  const out: Signal[] = [];

  // Market-wide valuation and leverage: how far there is to fall, not when.
  if (valuation.capeNow != null)
    out.push({
      id: "cape",
      label: "Shiller CAPE",
      stage: "Setup · Valuation",
      value: valuation.capeNow.toFixed(1),
      score: scale(valuation.capeNow, 27, 44),
      calm: "≤ 27 (post-1990 normal)",
      stress: "≥ 44 (dot-com peak)",
      detail: "S&P 500 price ÷ 10-year average inflation-adjusted earnings (multpl.com, Shiller data).",
    });
  const ecyNow = valuation.ecy.at(-1);
  const ecyVal = ecyNow?.tips ?? ecyNow?.shiller;
  if (ecyVal != null)
    out.push({
      id: "ecy",
      label: "Excess CAPE yield",
      stage: "Setup · Valuation",
      value: `${f2(ecyVal)}%`,
      score: scale(ecyVal, 4, 0),
      calm: "≥ 4%",
      stress: "≤ 0%",
      detail: "Earnings yield (1 ÷ CAPE) minus the 10-year TIPS real yield: the extra return stocks offer over safe real bonds.",
    });
  const bNow = valuation.buffett.at(-1);
  if (bNow)
    out.push({
      id: "buffett",
      label: "Buffett indicator",
      stage: "Setup · Valuation",
      value: `${bNow.v.toFixed(0)}% of GDP`,
      score: scale(bNow.v, 110, 220),
      calm: "≤ 110%",
      stress: "≥ 220%",
      detail: `Market value of US nonfinancial corporate equities ÷ GDP (Fed Z.1), as of ${bNow.t}.`,
    });
  const m = valuation.margin.at(-1);
  if (m?.yoy != null && m.spyYoy != null)
    out.push({
      id: "margin",
      label: "Margin debt growth vs market",
      stage: "Setup · Leverage",
      value: `${m.yoy >= 0 ? "+" : ""}${f1(m.yoy)}% vs S&P ${m.spyYoy >= 0 ? "+" : ""}${f1(m.spyYoy)}%`,
      score: scale(m.yoy - m.spyYoy, 0, 30),
      calm: "≤ market growth",
      stress: "30+ pts faster",
      detail: `FINRA customer margin debit balances, 12-month growth, ${m.t.slice(0, 7)}. Borrowing outpacing prices is a late-bubble pattern.`,
    });

  if (spvWorst)
    out.push({
      id: "spvprice",
      label: "Weakest SPV loan price",
      stage: "4 · Credit transmits",
      value: `${spvWorst.price}¢`,
      score: scale(spvWorst.price, 98, 80),
      calm: "> 98¢",
      stress: "< 80¢",
      detail: `${spvWorst.spv}, as of ${spvWorst.asOf}. Cents on the dollar in secondary trading; reported prices only.`,
    });

  if (capexAggregate) {
    const gap = capexAggregate.capexYoY - capexAggregate.revenueYoY;
    out.push({
      id: "capexgap",
      label: "Capex growth minus revenue growth",
      stage: "1 · Monetization stalls",
      value: `${gap >= 0 ? "+" : ""}${f1(gap)} pts`,
      score: scale(gap, 10, 60),
      calm: "< +10",
      stress: "> +60",
      detail: `Hyperscaler TTM capex ${capexAggregate.capexYoY >= 0 ? "+" : ""}${f1(capexAggregate.capexYoY)}% YoY vs revenue ${capexAggregate.revenueYoY >= 0 ? "+" : ""}${f1(capexAggregate.revenueYoY)}%. Capex is ${(capexAggregate.capexToRevenue * 100).toFixed(0)}% of revenue.`,
    });
  }

  if (nvidia)
    out.push({
      id: "nvdadso",
      label: "Nvidia days sales outstanding",
      stage: "5 · Circular deals",
      value: `${nvidia.dso.toFixed(0)} days`,
      score: scale(nvidia.dso, 55, 85),
      calm: "< 55",
      stress: "> 85",
      detail: `Receivables ÷ quarterly revenue × 91, quarter ending ${nvidia.periodEnd}. Customers paying slower is the classic vendor-financing tell.`,
    });

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

  const igv = quotes.get("IGV");
  if (igv)
    out.push({
      id: "software",
      label: "Software ETF (IGV) drawdown",
      stage: "4 · Credit transmits",
      value: `${f1(igv.drawdown)}%`,
      score: scale(igv.drawdown, -10, -40),
      calm: "> -10%",
      stress: "< -40%",
      detail: "Software is about a fifth to a third of BDC loan books. AI pressure on SaaS shows up in IGV before it shows in private-credit marks.",
    });

  const banks = basketDrawdown(quotes, ["JPM", "GS", "MS", "BAC", "C", "WFC", "MUFG", "SMFG", "MFG"]);
  if (banks != null)
    out.push({
      id: "banks",
      label: "Lender banks drawdown",
      stage: "4 · Credit transmits",
      value: `${f1(banks)}%`,
      score: scale(banks, -8, -35),
      calm: "> -8%",
      stress: "< -35%",
      detail: "Average distance below 52-week high for the US banks and Japanese megabanks that arrange and hold AI infrastructure debt.",
    });

  const sloos = fred.get("DRTSCILM");
  if (sloos)
    out.push({
      id: "sloos",
      label: "Banks tightening loan standards",
      stage: "4 · Credit transmits",
      value: `${f1(sloos.last)}% net`,
      score: scale(sloos.last, 0, 50),
      calm: "≤ 0%",
      stress: "≥ 50%",
      detail: `Fed loan officer survey, C&I loans to large and mid-sized firms, as of ${sloos.lastDate}.`,
    });

  // Worst reported 5-year CDS among AI borrowers (curated weekly from news reports).
  const worstCds = creditStress.borrowers
    .map((b) => ({ b, c: latestCds(b) }))
    .filter((x): x is { b: (typeof creditStress.borrowers)[number]; c: NonNullable<ReturnType<typeof latestCds>> } => x.c != null)
    .sort((a, z) => z.c.bps - a.c.bps)[0];
  if (worstCds)
    out.push({
      id: "aicds",
      label: "Worst AI-borrower CDS",
      stage: "4 · Credit transmits",
      value: `${worstCds.b.name} ${worstCds.c.bps.toFixed(0)} bp`,
      score: scale(worstCds.c.bps, 250, 1500),
      calm: "≤ 250 bp",
      stress: "≥ 1,500 bp",
      detail: `5-year credit default swap spread, as of ${worstCds.c.date}: about ${impliedDefault5y(worstCds.c.bps).toFixed(0)}% market-implied odds of default within five years.`,
    });

  const sentiment = fred.get("UMCSENT");
  if (sentiment)
    out.push({
      id: "sentiment",
      label: "Consumer sentiment",
      stage: "6 · Macro spillover",
      value: f1(sentiment.last),
      score: scale(sentiment.last, 90, 55),
      calm: "≥ 90",
      stress: "≤ 55",
      detail: `University of Michigan index, as of ${sentiment.lastDate}. The 2008 and 2022 lows were in the 50s.`,
    });

  const cards = fred.get("DRCCLACBS");
  if (cards)
    out.push({
      id: "carddelinq",
      label: "Credit card delinquency",
      stage: "6 · Macro spillover",
      value: `${f2(cards.last)}%`,
      score: scale(cards.last, 2.5, 5),
      calm: "≤ 2.5%",
      stress: "≥ 5%",
      detail: `Share of bank card balances 30+ days past due, as of ${cards.lastDate}.`,
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

  // Prefer the cross-provider weekly median; fall back to the single marketplace.
  const h100 = gpu.find((g) => g.model === "H100 SXM");
  if (h100Market) {
    const yoy = h100Market.yearAgo ? (h100Market.price / h100Market.yearAgo - 1) * 100 : null;
    out.push({
      id: "gpu",
      label: "H100 rental $/hr",
      stage: "2 · Price deflation",
      value: `$${f2(h100Market.price)}${yoy != null ? ` (${yoy >= 0 ? "+" : ""}${f1(yoy)}% 1y)` : ""}`,
      score: scale(h100Market.price, 2.75, 1.0),
      calm: "> $2.75",
      stress: "< $1.00",
      detail: `Median on-demand price across ${h100Market.providers ?? "~40"} cloud providers, week of ${h100Market.date} (GetDeploying). Falling rates erode GPU-SPV collateral.`,
    });
  } else if (h100)
    out.push({
      id: "gpu",
      label: "H100 rental $/hr",
      stage: "2 · Price deflation",
      value: `$${f2(h100.median)}${gpuChange30d != null ? ` (${gpuChange30d >= 0 ? "+" : ""}${f1(gpuChange30d)}% 30d)` : ""}`,
      score: scale(h100.median, 2.75, 1.0),
      calm: "> $2.75",
      stress: "< $1.00",
      detail: "Median on-demand marketplace price (Vast.ai). Falling rates erode GPU-SPV collateral.",
    });

  if (openGap)
    out.push({
      id: "opengap",
      label: "Open-weight gap to frontier",
      stage: "2 · Price deflation",
      value: `${f1(openGap.gap)} ECI pts${openGap.lagMonths != null ? ` (~${openGap.lagMonths} mo behind)` : ""}`,
      score: scale(openGap.gap, 15, 2),
      calm: "> 15 pts",
      stress: "< 2 pts",
      detail: `Epoch Capabilities Index: ${openGap.bestClosed.model} vs best open-weight ${openGap.bestOpen.model}. A small gap means frontier-level intelligence is available nearly free.`,
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

  // IT equipment & software investment as a share of GDP, against the dot-com peak.
  const it = fred.get("A679RC1Q027SBEA");
  const gdp = fred.get("GDP");
  if (it && gdp) {
    const gdpAt = new Map(gdp.points.map((p) => [p.t, p.v]));
    const share = it.points.filter((p) => gdpAt.get(p.t)).map((p) => ({ t: p.t, v: (p.v / gdpAt.get(p.t)!) * 100 }));
    const last = share[share.length - 1];
    const peak = Math.max(...share.filter((p) => p.t >= "1998" && p.t <= "2002").map((p) => p.v));
    if (last && Number.isFinite(peak))
      out.push({
        id: "itshare",
        label: "IT investment share of GDP",
        stage: "6 · Macro spillover",
        value: `${f2(last.v)}% (dot-com peak ${f2(peak)}%)`,
        score: scale(last.v / peak, 0.8, 1.25),
        calm: "< 0.8× peak",
        stress: "> 1.25× peak",
        detail: `Business investment in IT equipment and software ÷ GDP, ${last.t}. Above the 2000 peak means the economy leans on the buildout more than it did then.`,
      });
  }

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
