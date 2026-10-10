// Everything the dashboard tracks lives here, so adding a ticker or a FRED
// series is a one-line change.

export const REVALIDATE_SECONDS = 60 * 60 * 24;
export const CACHE_TAG = "bubble-data";

export type TickerGroup = {
  id: string;
  title: string;
  blurb: string;
  benchmark?: string;
  tickers: { symbol: string; name: string }[];
};

export const TICKER_GROUPS: TickerGroup[] = [
  {
    id: "ai-chips",
    title: "AI chips & supply chain",
    blurb:
      "Priced for endless growth. In a capex cut these fall first and hardest (the 40–60% scenario).",
    benchmark: "SPY",
    tickers: [
      { symbol: "NVDA", name: "Nvidia" },
      { symbol: "AVGO", name: "Broadcom" },
      { symbol: "AMD", name: "AMD" },
      { symbol: "MU", name: "Micron (HBM memory)" },
      { symbol: "TSM", name: "TSMC" },
      { symbol: "ANET", name: "Arista (networking)" },
      { symbol: "SMH", name: "Semiconductor ETF" },
    ],
  },
  {
    id: "hyperscalers",
    title: "Hyperscalers",
    blurb:
      "The spenders. Watch for capex guidance cuts and AI revenue misses on earnings calls.",
    benchmark: "SPY",
    tickers: [
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "GOOGL", name: "Alphabet" },
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "META", name: "Meta" },
      { symbol: "ORCL", name: "Oracle (largest SPV user)" },
    ],
  },
  {
    id: "neoclouds",
    title: "Neoclouds (GPU-backed debt)",
    blurb:
      "Most direct exposure to falling GPU rental prices and GPU-collateralised loans.",
    benchmark: "SPY",
    tickers: [
      { symbol: "CRWV", name: "CoreWeave" },
      { symbol: "NBIS", name: "Nebius" },
      { symbol: "APLD", name: "Applied Digital" },
      { symbol: "IREN", name: "IREN" },
    ],
  },
  {
    id: "private-credit",
    title: "Private credit & alt managers",
    blurb:
      "The lenders behind data-center SPVs. Stress shows up here before it shows in hyperscaler debt ratios.",
    benchmark: "SPY",
    tickers: [
      { symbol: "OWL", name: "Blue Owl" },
      { symbol: "APO", name: "Apollo" },
      { symbol: "BX", name: "Blackstone" },
      { symbol: "KKR", name: "KKR" },
      { symbol: "ARES", name: "Ares" },
      { symbol: "BLK", name: "BlackRock" },
    ],
  },
  {
    id: "reits",
    title: "Data center REITs & power",
    blurb:
      "Long leases cushion REITs; the damage shows as multiple compression. Power and cooling vendors are priced for the buildout.",
    benchmark: "SPY",
    tickers: [
      { symbol: "EQIX", name: "Equinix" },
      { symbol: "DLR", name: "Digital Realty" },
      { symbol: "IRM", name: "Iron Mountain" },
      { symbol: "VRT", name: "Vertiv (power/cooling)" },
      { symbol: "CEG", name: "Constellation Energy" },
      { symbol: "VST", name: "Vistra" },
    ],
  },
  {
    id: "market",
    title: "Broad market & volatility",
    blurb: "Macro spillover: AI names are a large share of index weight.",
    tickers: [
      { symbol: "SPY", name: "S&P 500" },
      { symbol: "QQQ", name: "Nasdaq 100" },
      { symbol: "RSP", name: "S&P 500 equal weight" },
      { symbol: "HYG", name: "High-yield bond ETF" },
      { symbol: "^VIX", name: "VIX" },
    ],
  },
];

// Public BDCs: price vs reported NAV is the market's verdict on private marks.
export const BDCS = [
  { symbol: "OBDC", name: "Blue Owl Capital Corp" },
  { symbol: "ARCC", name: "Ares Capital" },
  { symbol: "BXSL", name: "Blackstone Secured Lending" },
  { symbol: "FSK", name: "FS KKR Capital" },
  { symbol: "GBDC", name: "Golub Capital BDC" },
  { symbol: "MAIN", name: "Main Street Capital" },
  { symbol: "HTGC", name: "Hercules Capital" },
];

export type FredSeries = {
  id: string;
  title: string;
  unit: string;
  group: "credit" | "stress" | "labor" | "economy";
  note?: string;
};

export const FRED_SERIES: FredSeries[] = [
  { id: "BAMLH0A0HYM2", title: "High-yield OAS", unit: "%", group: "credit", note: "Credit transmits the shock. Above ~5% means a credit squeeze." },
  { id: "BAMLH0A3HYC", title: "CCC & lower OAS", unit: "%", group: "credit", note: "The weakest borrowers crack first." },
  { id: "BAMLC0A4CBBB", title: "BBB corporate OAS", unit: "%", group: "credit", note: "Where Oracle and most hyperscaler-adjacent IG debt sits." },
  { id: "DGS10", title: "10-year Treasury yield", unit: "%", group: "credit" },
  { id: "VIXCLS", title: "VIX", unit: "", group: "stress" },
  { id: "NFCI", title: "Chicago Fed financial conditions (NFCI)", unit: "", group: "stress", note: "Above 0 = tighter than average." },
  { id: "STLFSI4", title: "St. Louis Fed financial stress", unit: "", group: "stress", note: "Above 0 = above-average stress." },
  { id: "LNU04032237", title: "Unemployment: information industry", unit: "%", group: "labor", note: "White-collar displacement fingerprint." },
  { id: "LNU04032239", title: "Unemployment: professional & business services", unit: "%", group: "labor" },
  { id: "UNRATE", title: "Unemployment rate (all)", unit: "%", group: "labor" },
  { id: "ICSA", title: "Initial jobless claims", unit: "", group: "labor" },
  { id: "JTU5100JOL", title: "Job openings: information", unit: "k", group: "labor" },
  { id: "RPSGENAIUSAGESHAREALL", title: "US adults using generative AI", unit: "%", group: "economy", note: "Adoption is not the problem; monetization is." },
  { id: "PCU518210518210", title: "PPI: data processing & hosting", unit: "", group: "economy", note: "Falling prices = compute deflation." },
  { id: "IPG3344S", title: "Industrial production: semiconductors", unit: "", group: "economy" },
];

export const GPU_MODELS = ["B200", "H200", "H100 SXM", "H100 PCIE", "A100 SXM4"];

export const NEWS_FEEDS = [
  { id: "bubble", title: "AI bubble", query: '"AI bubble" OR "AI stocks selloff"' },
  { id: "capex", title: "Hyperscaler capex", query: 'hyperscaler capex OR "capital expenditure" (Microsoft OR Alphabet OR Meta OR Amazon) AI' },
  { id: "private-credit", title: "Private credit stress", query: '"private credit" (redemptions OR gate OR withdrawals OR markdown)' },
  { id: "spv", title: "Data center financing & SPVs", query: '"data center" (SPV OR "off-balance" OR financing OR bonds OR ABS)' },
  { id: "gpu", title: "GPU prices & neoclouds", query: '"GPU rental" OR "GPU prices" OR CoreWeave OR Nebius debt' },
  { id: "oracle", title: "Oracle & OpenAI financing", query: 'Oracle (debt OR "credit default swaps" OR bonds) OR OpenAI funding' },
  { id: "layoffs", title: "AI layoffs & enterprise ROI", query: '"AI layoffs" OR "AI ROI" OR "AI pilots" enterprise' },
];

// Non-traded private-credit funds whose tender offers (redemptions) we watch on EDGAR.
export const SEC_WATCH = [
  "Blue Owl",
  "Blackstone Private Credit",
  "Apollo Debt Solutions",
  "Ares Strategic Income",
  "HPS Corporate Lending",
  "Golub Capital Private Credit",
];

// SEC requires a descriptive User-Agent with a contact address.
export const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "AI Bubble Monitor ai-bubble-monitor@users.noreply.github.com";
