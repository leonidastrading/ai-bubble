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
    id: "banks",
    title: "Bank lenders",
    blurb:
      "The banks that arrange and hold data-center and GPU debt (JPMorgan, MUFG and SMBC lead the Oracle-linked loans), plus regional banks. They sit underneath private credit too, lending to the funds.",
    benchmark: "SPY",
    tickers: [
      { symbol: "JPM", name: "JPMorgan Chase" },
      { symbol: "GS", name: "Goldman Sachs" },
      { symbol: "MS", name: "Morgan Stanley" },
      { symbol: "BAC", name: "Bank of America" },
      { symbol: "C", name: "Citigroup" },
      { symbol: "WFC", name: "Wells Fargo" },
      { symbol: "MUFG", name: "Mitsubishi UFJ (ADR)" },
      { symbol: "SMFG", name: "Sumitomo Mitsui / SMBC (ADR)" },
      { symbol: "MFG", name: "Mizuho (ADR)" },
      { symbol: "KRE", name: "Regional bank ETF" },
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
    id: "onprem",
    title: "On-prem AI infrastructure",
    blurb:
      "Servers and storage that enterprises buy to run AI in their own data centers. Rising orders here mean adoption is moving beyond the hyperscalers' clouds.",
    benchmark: "SPY",
    tickers: [
      { symbol: "DELL", name: "Dell (AI servers)" },
      { symbol: "HPE", name: "HPE" },
      { symbol: "SMCI", name: "Supermicro" },
      { symbol: "NTAP", name: "NetApp (storage)" },
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

// Public software (SaaS) companies: AI agents threaten seat-based software, and
// private software borrowers are the largest single exposure in private credit.
// Rendered inside the "Software & private credit" section, not as its own group.
export const SOFTWARE_GROUP: TickerGroup = {
  id: "software",
  title: "Public software (SaaS)",
  blurb: "",
  benchmark: "SPY",
  tickers: [
    { symbol: "IGV", name: "iShares Expanded Tech-Software ETF" },
    { symbol: "CRM", name: "Salesforce" },
    { symbol: "ADBE", name: "Adobe" },
    { symbol: "NOW", name: "ServiceNow" },
    { symbol: "WDAY", name: "Workday" },
    { symbol: "TEAM", name: "Atlassian" },
    { symbol: "HUBS", name: "HubSpot" },
    { symbol: "MNDY", name: "Monday.com" },
    { symbol: "ZM", name: "Zoom" },
  ],
};

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
  group: "credit" | "stress" | "fed" | "labor" | "economy" | "gdp" | "energy" | "valuation";
  /** Years of history to fetch (default 5); long series get longer range options. */
  years?: number;
  /** Fetched only as an input to a derived chart, not shown as its own card. */
  hidden?: boolean;
};

export const FRED_SERIES: FredSeries[] = [
  { id: "APU000072610", title: "Electricity price, US city average", unit: "$/kWh", group: "energy", years: 25 },
  { id: "WPU0543", title: "Producer prices: industrial electric power", unit: "", group: "energy", years: 25 },
  { id: "BB01RC1Q027SBEA", title: "GDP: final sales of computers", unit: "$B", group: "gdp", years: 50 },
  { id: "B935RC1Q027SBEA", title: "Business investment: computers & peripherals", unit: "$B", group: "gdp", years: 50 },
  { id: "B985RC1Q027SBEA", title: "Business investment: software", unit: "$B", group: "gdp", years: 50 },
  { id: "TLPWRCONS", title: "Construction spending: power", unit: "$M", group: "gdp", years: 20 },
  { id: "A679RC1Q027SBEA", title: "Investment in IT equipment & software", unit: "$B", group: "gdp", years: 50, hidden: true },
  { id: "GDP", title: "GDP", unit: "$B", group: "gdp", years: 50, hidden: true },
  // Inputs for the classic bubble gauges (lib/valuation.ts); not shown as cards.
  { id: "GS10", title: "10-year Treasury yield (monthly)", unit: "%", group: "valuation", years: 65, hidden: true },
  { id: "GS2", title: "2-year Treasury yield (monthly)", unit: "%", group: "valuation", years: 52, hidden: true },
  { id: "FII10", title: "10-year TIPS yield (monthly)", unit: "%", group: "valuation", years: 25, hidden: true },
  { id: "DFII10", title: "10-year TIPS yield", unit: "%", group: "valuation", years: 1, hidden: true },
  { id: "CPIAUCSL", title: "CPI", unit: "", group: "valuation", years: 75, hidden: true },
  { id: "NCBEILQ027S", title: "Market value of nonfinancial corporate equities", unit: "$M", group: "valuation", years: 55, hidden: true },
  { id: "T10Y2Y", title: "10-year minus 2-year Treasury", unit: "%", group: "valuation", years: 1, hidden: true },
  { id: "BCNSDODNS", title: "Nonfinancial corporate debt (securities and loans)", unit: "$B", group: "valuation", years: 40, hidden: true },
  { id: "HHMSDODNS", title: "Household home-mortgage debt", unit: "$B", group: "valuation", years: 40, hidden: true },
  { id: "FEDFUNDS", title: "Fed funds rate (monthly)", unit: "%", group: "valuation", years: 60, hidden: true },
  { id: "DRTSCILM", title: "Banks tightening business-loan standards (net %)", unit: "%", group: "credit", years: 35 },
  { id: "BUSLOANS", title: "Business (C&I) loans at US banks", unit: "$B", group: "credit", years: 40 },
  { id: "BAMLH0A0HYM2", title: "High-yield OAS", unit: "%", group: "credit" },
  { id: "BAMLH0A3HYC", title: "CCC & lower OAS", unit: "%", group: "credit" },
  { id: "BAMLC0A4CBBB", title: "BBB corporate OAS", unit: "%", group: "credit" },
  { id: "DGS10", title: "10-year Treasury yield", unit: "%", group: "credit" },
  { id: "VIXCLS", title: "VIX", unit: "", group: "stress" },
  { id: "NFCI", title: "Chicago Fed financial conditions (NFCI)", unit: "", group: "stress" },
  { id: "STLFSI4", title: "St. Louis Fed financial stress", unit: "", group: "stress" },
  { id: "DFF", title: "Fed funds rate", unit: "%", group: "fed" },
  { id: "T10Y3M", title: "Yield curve (10y − 3m)", unit: "%", group: "fed" },
  { id: "RECPROUSM156N", title: "Recession probability (smoothed)", unit: "%", group: "fed" },
  { id: "LNU04032237", title: "Unemployment: information industry", unit: "%", group: "labor" },
  { id: "LNU04032239", title: "Unemployment: professional & business services", unit: "%", group: "labor" },
  { id: "UNRATE", title: "Unemployment rate (all)", unit: "%", group: "labor" },
  { id: "ICSA", title: "Initial jobless claims", unit: "", group: "labor" },
  { id: "JTU5100JOL", title: "Job openings: information", unit: "k", group: "labor" },
  { id: "RPSGENAIUSAGESHAREALL", title: "US adults using generative AI", unit: "%", group: "economy" },
  { id: "PCU518210518210", title: "PPI: data processing & hosting", unit: "", group: "economy" },
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
  { id: "circular", title: "Circular & vendor financing", query: '"circular financing" OR "vendor financing" OR "circular deals" (Nvidia OR OpenAI OR AMD OR CoreWeave)' },
  { id: "open-weight", title: "Open-weight models & price cuts", query: '"open-weight" OR "open source model" OR "inference price" OR "price cut" (LLM OR model) (DeepSeek OR Qwen OR Llama OR Mistral OR Kimi)' },
  { id: "software", title: "Software & private credit", query: '(software OR SaaS OR SaaSpocalypse) ("private credit" OR BDC OR "direct lending" OR "software loans")' },
  { id: "banks", title: "Banks & AI lending", query: '(bank OR banks OR JPMorgan OR MUFG OR SMBC) ("data center" OR "AI infrastructure" OR "significant risk transfer") (loan OR loans OR debt)' },
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

// Google Trends: up to 5 terms per group. Values are 0–100 relative to the
// peak of any term in the same group, so only compare lines within a chart.
export const TRENDS_GROUPS = [
  {
    id: "assistants",
    title: "AI assistants",
    blurb: "Consumer attention on the big chatbots. Adoption can keep rising through a bust, as internet use did in 2000.",
    keywords: ["ChatGPT", "Claude", "Gemini", "Copilot", "DeepSeek"],
    time: "today 5-y",
  },
  {
    id: "ai",
    title: "Interest in \"AI\"",
    blurb: "The broadest read on public attention. A plateau or rollover would mirror internet searches after 2000.",
    keywords: ["AI"],
    time: "today 5-y",
  },
  {
    id: "fear",
    title: "Bubble fear",
    blurb: "Spikes in these searches tend to coincide with selloffs. Kept apart from \"AI\" so its volume doesn't flatten them.",
    keywords: ["AI bubble", "AI stocks", "AI crash", "AI layoffs"],
    time: "today 5-y",
  },
  {
    id: "claude",
    title: "Claude vs. peers, last 12 months",
    blurb: "A tighter window to see share-of-attention shifts between labs.",
    keywords: ["Claude", "ChatGPT", "Gemini", "Grok", "Perplexity"],
    time: "today 12-m",
  },
];

// Empty string = worldwide; use e.g. "US" for one country.
export const TRENDS_GEO = "";

// Quarterly fundamentals from SEC XBRL filings.
export const CAPEX_COMPANIES = [
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "META", name: "Meta" },
  { symbol: "ORCL", name: "Oracle" },
];
