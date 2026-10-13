/**
 * Plain-language notes shown under each chart: what the chart measures, why
 * it matters for the bubble scenario, and what to watch for. Keyed by FRED
 * series id, ticker-group id, Trends group id, or a chart name.
 */
export type Explanation = { what: string; why: string; watch: string };

export const EXPLAIN: Record<string, Explanation> = {
  // ── Ticker groups (relative-performance chart + scoreboard) ──
  "ai-chips": {
    what: "Total return of the main AI chip and networking suppliers, each rebased to 100 at the start of the window; the dashed grey line is the S&P 500.",
    why: "Their earnings depend on hyperscaler capex continuing to grow. In the scenario a capex pause hits them first and hardest (40–60%).",
    watch: "The whole group falling below the S&P line together, especially right after a hyperscaler earnings call; Micron and Arista turning first (memory and networking are ordered earliest).",
  },
  hyperscalers: {
    what: "Total return of the big cloud spenders, rebased to 100, against the S&P 500.",
    why: "If investors start punishing the spenders rather than rewarding them, they doubt the capex will pay off. That's step 1 of the scenario.",
    watch: "A stock falling on the day it raises capex guidance, or rising when it cuts. Oracle has the most debt-funded exposure.",
  },
  neoclouds: {
    what: "Total return of GPU cloud providers that borrow against their GPUs, rebased to 100.",
    why: "They're leveraged and depend on a few customers (OpenAI, Microsoft, Meta). Their stocks move first when GPU rental prices or customer commitments wobble.",
    watch: "Sharp drops after contract news, new debt raised at higher rates, or falling GPU rental prices in the GPU section.",
  },
  "private-credit": {
    what: "Total return of the asset managers who lend to data-center SPVs and neoclouds, rebased to 100.",
    why: "Losses on off-balance-sheet AI debt land on these lenders, not on Big Tech. Their stocks price that risk before it shows in filings.",
    watch: "Blue Owl leading the group down, and the group underperforming the S&P while redemption requests rise.",
  },
  reits: {
    what: "Total return of data-center landlords and power/cooling suppliers, rebased to 100.",
    why: "Long leases protect REIT revenue, so the hit shows up as valuation multiples shrinking; power and cooling vendors are priced for the buildout to continue.",
    watch: "A drop of 25%+ while their own results are fine: that's multiple compression from slower expected leasing.",
  },
  market: {
    what: "The S&P 500, Nasdaq 100, the equal-weight S&P, high-yield bonds and the VIX, rebased to 100 (VIX shown as its level).",
    why: "AI names are a large share of index weight, so an AI unwind becomes a market-wide drawdown (step 6).",
    watch: "Nasdaq falling faster than the equal-weight S&P (the AI-heavy part leading), and high-yield bonds falling alongside stocks.",
  },
  scoreboard: {
    what: "Latest close and returns over 1 day, 1 month, 3 months and year to date. \"Off high\" is the distance below the 52-week high, shaded green to red.",
    why: "Drawdowns from the high show how much of the AI premium has already come out of each stock.",
    watch: "−20% or worse is bear-market territory; several names in one group past −30% at once.",
  },

  // ── Composite ──
  history: {
    what: "The composite stress score (0 = calm, 100 = crisis), one snapshot saved per day after the US close. Weekends repeat Friday's market data.",
    why: "One day's score is noisy; the direction over weeks is the signal. It moves slowly because it averages 21 signals, several of which update only weekly or monthly.",
    watch: "The score climbing steadily for several weeks, especially with the H100 price falling at the same time.",
  },
  historyGpu: {
    what: "The H100 on-demand rental price saved each day: the median of live Vast.ai marketplace offers, and the list prices RunPod and Lambda publish.",
    why: "Marketplace prices react first when GPUs sit idle; list prices move later and in steps. The weekly cross-provider median is in the GPU rental section.",
    watch: "The marketplace line falling below the list prices for weeks, then list-price cuts following.",
  },

  // ── Fundamentals ──
  capex: {
    what: "Each hyperscaler's trailing-twelve-month capital spending as a share of its revenue, from 10-Q/10-K filings, aligned to calendar quarters.",
    why: "Revenue has to grow into the buildout. A rising ratio means spending is outrunning the revenue that's supposed to pay for it.",
    watch: "Ratios still rising after revenue growth slows. Oracle above 100% means it spends more on capex than it brings in, so the gap is debt-funded.",
  },
  nvidia: {
    what: "Days sales outstanding (how long Nvidia waits to be paid) and days of inventory (how long product sits before it ships), by quarter.",
    why: "If Nvidia's sales are partly funded by its own investments in customers, collections slow and inventory builds before revenue falls.",
    watch: "Both rising together for two or more quarters, or DSO moving above about 70 days.",
  },

  // ── Deal web ──
  web: {
    what: "Who pays whom across AI chipmakers, clouds, labs and their investors. Arrows point the way money flows; line width is the disclosed amount.",
    why: "Money that loops back (an investment returning as a chip or cloud purchase) inflates reported revenue. If one link breaks, several companies' numbers fall together.",
    watch: "Large exposure circles (deals much bigger than the company), new round trips, and deals restructured from investments into guarantees.",
  },

  // ── BDCs & redemptions ──
  software: {
    what: "Total return of the software ETF (IGV) and the most-watched SaaS names, rebased to 100, against the S&P 500 (dashed).",
    why: "AI agents threaten per-seat software. The same fear lowers the value of private software companies, which are the biggest borrowers in private credit.",
    watch: "IGV making new lows while the S&P holds up; Salesforce and Adobe (most cited as AI-threatened) leading declines; seat-based tools falling after layoff news.",
  },
  softwareFacts: {
    what: "Sector-level figures on private-credit lending to software companies, from the BIS, Octus and Kamakura.",
    why: "Software is the largest single exposure in private credit. Loans made at 2021–23 valuations are coming due while AI pressures those companies' growth.",
    watch: "New research or BDC filings showing software non-accruals or markdowns, and refinancing trouble as the 2028–29 maturities approach.",
  },
  softwareBdc: {
    what: "Each public BDC's software share at fair value from its latest 10-Q or earnings presentation, next to its price / NAV. Companies define software differently, so compare levels loosely.",
    why: "If the market thinks software loans are marked too high, BDCs with more software should trade at bigger discounts to NAV.",
    watch: "The software-heavy group's median P/NAV dropping below the lighter group's, rising software non-accruals in new 10-Qs, or a BDC cutting its software share sharply (selling or writing down loans).",
  },
  bdcPnav: {
    what: "Each public BDC's share price divided by the net asset value it last reported. 1.0x means the market agrees with the BDC's own valuation of its loans.",
    why: "Private credit marks its own loans, so it can lag. A public BDC trading below NAV is the market saying the marks are too high.",
    watch: "The median falling below 0.85x (a 15%+ discount), or the biggest lenders (Blue Owl, Ares) trading at discounts.",
  },
  tenders: {
    what: "SEC filings where non-traded private-credit funds offer to buy back shares from investors (how they handle redemptions), last 120 days.",
    why: "When investors want out faster than the fund allows (usually 5% a quarter), the fund gates, which is the classic private-credit crack.",
    watch: "Amendments (TO-I/A) reporting requests above the 5% cap, and a rising count of filings.",
  },
  bdcPrices: {
    what: "BDC share prices rebased to 100, against the S&P 500 (dashed).",
    why: "Shows whether stress is in one lender or across the sector.",
    watch: "Most lines falling together while the S&P holds up.",
  },

  // ── GPU ──
  gpu: {
    what: "Median on-demand price per GPU-hour on the Vast.ai marketplace, with the 25th–75th percentile range and number of offers.",
    why: "GPU rental income is the collateral behind GPU-backed loans. If rental prices fall, the collateral is worth less than the debt.",
    watch: "H100 below about $1.50/hr, newer chips (B200) discounting fast, or the offer count jumping (idle capacity).",
  },

  // ── Concentration ──
  breadth: {
    what: "Equal-weight S&P 500 divided by the regular (cap-weighted) S&P 500, × 100.",
    why: "When it falls, a few giants (mostly AI) are carrying the index; a sharp rise usually means those giants are selling off.",
    watch: "A fast reversal upward while the S&P itself falls: that's money leaving AI mega-caps.",
  },

  // ── FRED series ──
  BAMLH0A0HYM2: {
    what: "The extra yield junk-rated companies pay over Treasuries (option-adjusted spread).",
    why: "Credit is how the AI shock spreads. Neoclouds and data-center developers borrow at junk-like rates.",
    watch: "A sustained move above about 4.5%, then 5–6.5% (credit squeeze); jumps of 1 point or more within a month.",
  },
  BAMLH0A3HYC: {
    what: "The spread for the riskiest junk borrowers (rated CCC and below).",
    why: "The weakest borrowers lose access to credit first, so this often widens before the broader high-yield spread does. Compare its year-over-year change with the high-yield card.",
    watch: "Above 12% and still rising while the high-yield spread is flat: stress concentrating in weak borrowers.",
  },
  BAMLC0A4CBBB: {
    what: "The spread for the lowest investment-grade tier (BBB).",
    why: "Oracle and much hyperscaler-adjacent debt sits near here. A downgrade to junk forces many funds to sell.",
    watch: "Above about 1.5%, or Oracle-specific downgrade news.",
  },
  DGS10: {
    what: "The yield on 10-year US Treasuries.",
    why: "It's the discount rate for long-dated AI payoffs and the base cost of financing data centers. Higher yields shrink valuations of far-future earnings and REITs.",
    watch: "Yields rising at the same time as credit spreads widen, which tightens financing from both sides.",
  },
  VIXCLS: {
    what: "The market's expected S&P 500 volatility over the next 30 days, from options prices.",
    why: "The standard fear gauge; spikes accompany selloffs.",
    watch: "Above 25 is elevated, above 35 is stress. A VIX that stays high for weeks matters more than a one-day spike.",
  },
  NFCI: {
    what: "The Chicago Fed's weekly index of 105 measures of risk, credit and leverage. Zero is the historical average.",
    why: "Shows whether money is easy or tight across the whole financial system, not just one market.",
    watch: "Crossing above 0 (tighter than average).",
  },
  STLFSI4: {
    what: "The St. Louis Fed's weekly stress index built from 18 yields, spreads and volatility measures. Zero is normal.",
    why: "A broad read on market strain that reacts faster than the economy.",
    watch: "Moving above 0, or a spike like April 2025's tariff shock.",
  },
  DFF: {
    what: "The overnight interest rate the Federal Reserve targets.",
    why: "Step 6: the Fed cuts when markets price in recession, but cuts can't restore earnings that were never going to arrive.",
    watch: "Rapid cuts during a selloff: the Fed reacting to stress rather than steering.",
  },
  T10Y3M: {
    what: "The 10-year Treasury yield minus the 3-month yield.",
    why: "An inverted curve (below 0) has preceded past recessions; the curve often re-steepens just as a recession starts.",
    watch: "A quick move from negative back above 0 alongside rising unemployment.",
  },
  RECPROUSM156N: {
    what: "A model's probability that the US is in recession, from employment, production, income and sales. Monthly, about two months behind.",
    why: "Confirms whether market stress is reaching the real economy.",
    watch: "Above 20%.",
  },
  LNU04032237: {
    what: "Unemployment rate for the information industry (software, telecom, media, publishing). Not seasonally adjusted, so it's noisy.",
    why: "The \"too successful too fast\" path: AI replaces white-collar work, layoffs cut spending, ad budgets and AI seat licences fall.",
    watch: "Rising year over year while corporate profit margins are at records.",
  },
  LNU04032239: {
    what: "Unemployment rate for professional and business services (consulting, legal, accounting, admin).",
    why: "These high earners drive a large share of consumer spending, and their work is the most exposed to AI substitution.",
    watch: "A sustained rise of 1 point or more from its low.",
  },
  UNRATE: {
    what: "The headline US unemployment rate.",
    why: "Shows whether AI-sector stress is spreading to the whole economy.",
    watch: "The three-month average rising 0.5 points above its 12-month low (the Sahm rule recession signal).",
  },
  ICSA: {
    what: "New weekly claims for unemployment benefits.",
    why: "The earliest weekly labor signal; layoffs show here before the monthly jobs report.",
    watch: "Sustained readings above about 250,000.",
  },
  JTU5100JOL: {
    what: "Job openings in the information industry (thousands).",
    why: "Companies stop hiring before they lay off; falling openings are an early warning.",
    watch: "A steady decline over several months.",
  },
  RPSGENAIUSAGESHAREALL: {
    what: "Share of US adults aged 18–64 who used generative AI, from the St. Louis Fed's Real-Time Population Survey.",
    why: "Adoption isn't the problem; getting people and companies to pay is. Usage can keep rising through a crash, as internet use did in 2000.",
    watch: "A plateau would weaken the growth story; continued growth with weak revenue would confirm a monetization gap.",
  },
  PCU518210518210: {
    what: "Producer price index for data processing and hosting: what cloud and hosting providers charge.",
    why: "Step 2, price deflation: if compute gets cheap, it's harder to earn a return on $50B clusters.",
    watch: "The index turning down year over year.",
  },
  IPG3344S: {
    what: "US industrial production of semiconductors and electronic components.",
    why: "Tracks the physical buildout; it rises with capex and rolls over when orders are cut.",
    watch: "A decline over two or three months after a long rise.",
  },

  // ── Google Trends ──
  "trends:assistants": {
    what: "Weekly worldwide search interest for the major AI assistants, scaled so 100 is the peak of any term in this chart.",
    why: "A proxy for consumer attention. Usage can keep rising through a bust; what matters is whether it converts to paid plans.",
    watch: "The leaders flattening or falling together; sudden spikes for a cheap challenger (as with DeepSeek in January 2025).",
  },
  "trends:ai": {
    what: "Weekly worldwide search interest for \"AI\", 100 = peak.",
    why: "The broadest read on public attention, and a hype-cycle indicator.",
    watch: "A plateau or rollover, which would mirror internet searches after 2000.",
  },
  "trends:fear": {
    what: "Weekly search interest for \"AI bubble\", \"AI stocks\", \"AI crash\" and \"AI layoffs\", 100 = peak of any of them.",
    why: "Retail fear tends to spike alongside selloffs and can feed them.",
    watch: "\"AI bubble\" and \"AI crash\" rising together, or \"AI layoffs\" trending up for several weeks.",
  },
  "trends:claude": {
    what: "Search interest over the last 12 months for Claude and its main competitors, 100 = peak.",
    why: "Shows shifts in attention between labs, which matter for their next funding rounds and valuations.",
    watch: "A fast-rising challenger, or the leader losing share.",
  },

  // ── SPV tracker ──
  spvDebt: {
    what: "Total debt in the SPVs tracked here, split by type and by the tenant that pays the lease (the first-named tenant signs it).",
    why: "This is debt that supports the AI buildout but doesn't appear on the tenants' balance sheets. If a tenant walks away, it falls to the SPV's lenders.",
    watch: "New vehicles for the same tenant in quick succession, and tenants whose stock or credit is already weak (Oracle) carrying the most.",
  },
  spvProviders: {
    what: "Every lender and equity investor named in the tracked SPVs, with how many vehicles they're in and the debt in those vehicles. Public firms show their stock's distance from its 52-week high.",
    why: "SPV losses land here. Concentration in one provider (Blue Owl appears in several) means one bad project can hit its funds' redemptions and its stock.",
    watch: "A provider's stock falling while its SPV loans trade below par, and providers appearing in more and more vehicles.",
  },
  spvTable: {
    what: "Each tracked vehicle: what it owns, who leases it, how it's funded, its rating, and the latest reported trading price of its loans.",
    why: "Loan prices are the first market verdict on a single project. A loan below par means lenders doubt the tenant will keep paying or that the asset covers the debt.",
    watch: "Any loan below about 95 cents, force-majeure or delay notices, and GPU vehicles whose customers are below investment grade.",
  },
  offBalance: {
    what: "Each hyperscaler's future lease payments and unrecorded purchase obligations (signed contracts not yet on the balance sheet), compared with its reported long-term debt.",
    why: "SPV deals appear in the tenant's filings as commitments, not debt. A ratio well above 1× means most of what it owes for the buildout sits off the balance sheet.",
    watch: "Fast quarter-to-quarter jumps in purchase obligations. Leases that haven't started yet are disclosed only in text, so the real total is higher.",
  },
  offBalanceTrend: {
    what: "Leases plus purchase obligations per company over time, in billions, aligned to calendar quarters.",
    why: "Shows how quickly off-balance-sheet commitments are piling up relative to each other.",
    watch: "A line steepening after capex guidance is cut: that would mean spending moved off the balance sheet rather than stopping.",
  },

  gpuSources: {
    what: "Today's price per GPU-hour from each source: the weekly market median across about 90 providers (with spot and 12-month reserved medians), the Vast.ai spot marketplace, and RunPod and Lambda list prices.",
    why: "No single source is the market. When list prices, marketplace offers and the cross-provider median all move the same way, the move is real.",
    watch: "The market median falling while list prices hold (discounting off the list), or the reserved price dropping below on-demand by a wide margin (lenders and buyers expect lower prices ahead).",
  },
  gpuMarket: {
    what: "Weekly median on-demand rental price for each GPU generation across about 90 cloud providers (GetDeploying open dataset).",
    why: "The rental price is the income that pays down GPU-backed loans. Each new generation should hold a premium; older ones decline as supply arrives.",
    watch: "Newest chips (B200) falling quickly toward H100 prices, or H100 falling below about $1.50 per hour.",
  },
  gpuH100: {
    what: "H100 weekly medians for on-demand, spot (interruptible) and 12-month reserved contracts.",
    why: "Reserved prices show what buyers will commit to for a year, the closest free proxy for the term contracts behind neocloud debt. Spot shows idle capacity.",
    watch: "Spot falling well below on-demand (excess capacity), or reserved prices dropping (buyers expect cheaper compute ahead).",
  },

  // ── AI buildout in GDP ──
  itShare: {
    what: "Business investment in information-processing equipment and software, as a share of GDP (BEA, quarterly).",
    why: "The cleanest comparison with the dot-com bubble: in 2000 this share peaked and then fell for years. A share well above that peak means the economy leans on the buildout more than it did then.",
    watch: "The share rolling over from a peak. In 2000–02 the decline came before the recession was obvious elsewhere.",
  },
  dcConstruction: {
    what: "Monthly US spending on data center construction, adjusted for inflation (Census value put in place, via Our World in Data).",
    why: "The physical buildout itself. It's the part of GDP growth the scenario says would reverse when capex is cut.",
    watch: "Two or three months of decline after a long rise, especially alongside hyperscaler capex guidance cuts.",
  },
  BB01RC1Q027SBEA: {
    what: "The computers component of GDP: final sales of computers to businesses, consumers, government and exports, in billions at an annual rate.",
    why: "Computer sales dipped in the dot-com bust and the financial crisis but never crashed outright. This line nets out imports, so when AI servers are mostly built abroad it can fall while business investment in computers (next card) soars: the buildout adds less to US output than its headline spending suggests.",
    watch: "A widening gap between this and computer investment (more of the buildout imported), or both falling together, which would mean the hardware cycle itself is turning.",
  },
  B935RC1Q027SBEA: {
    what: "Business investment in computers and peripheral equipment, in billions at an annual rate (includes servers and AI accelerators bought by companies).",
    why: "This is where GPU and server purchases for data centers land in GDP. In 2000–02 it fell about a quarter.",
    watch: "Quarter-over-quarter declines after the long climb, or a gap opening between this and hyperscaler capex guidance.",
  },
  B985RC1Q027SBEA: {
    what: "Business investment in software, in billions at an annual rate.",
    why: "Enterprise AI adoption should show up here. If AI spending is shifting from pilots to production, software investment should keep accelerating.",
    watch: "Software investment flattening while hardware investment keeps rising: buildout without the use that pays for it.",
  },
  TLPWRCONS: {
    what: "Construction spending on power projects (generation, transmission), billions at an annual rate.",
    why: "AI data centers need new power; utilities and generators are building for that demand.",
    watch: "A slowdown after AI demand forecasts are cut, leaving utilities with stranded investment.",
  },

  // ── Cost of intelligence ──
  openGap: {
    what: "The best score to date of any closed model and of any open-weight model on Epoch AI's Capabilities Index, which combines dozens of independent benchmarks.",
    why: "If downloadable models match the frontier, the labs' pricing power (and the return on their clusters) erodes. The scenario's step 2 is this gap closing for good.",
    watch: "The gap shrinking toward zero and staying there, or the lag (how many months open models trail) dropping below about three months.",
  },
  priceCuts: {
    what: "The price of the best closed model, the cheapest model within 10 points of the top, and day-to-day changes in API prices for the top 40 models (OpenRouter, blended 3:1 input:output).",
    why: "Revenue per token is what pays for the buildout. Price cuts at the frontier mean usage has to grow faster just to keep revenue flat.",
    watch: "Frontier labs cutting prices on recent models, and the price ratio between the frontier and near-frontier models widening.",
  },
  apiPrices: {
    what: "Leading models with their capability score, release date, open or closed weights, and API price per million tokens.",
    why: "Shows how much capability a dollar buys. Cheap open models near the top of the list are the deflation the scenario worries about.",
    watch: "Open-weight models climbing the ECI column while staying at the cheap end of the price columns.",
  },
  btos: {
    what: "Share of US businesses that used AI in any business function in the last two weeks, and the share expecting to within six months (Census Business Trends and Outlook Survey, biweekly).",
    why: "Enterprise use is what has to grow into the capex. Rising use with stagnant AI revenue points to the monetization gap; flat use is the stall in step 1.",
    watch: "The 'using' line flattening, or the 'expect to' line falling below it (businesses dropping AI rather than adding it).",
  },
  APU000072610: {
    what: "Average US retail price of electricity per kilowatt-hour (BLS, monthly).",
    why: "Power is a large and rising share of the cost of running AI. Data-center demand is also pushing up what households and businesses pay, which is turning into a political issue.",
    watch: "Accelerating increases, which raise inference costs and the risk of regulatory pushback on new data centers.",
  },
  WPU0543: {
    what: "Producer price index for industrial electric power: what industrial customers, including data centers, pay.",
    why: "Higher power costs squeeze the margin on every GPU-hour sold, just as rental prices are supposed to pay down GPU-backed debt.",
    watch: "Power prices rising while GPU rental rates fall: the margin squeeze that hurts neoclouds first.",
  },
  onprem: {
    what: "Total return of companies selling servers and storage for AI in customers' own data centers, rebased to 100, against the S&P 500.",
    why: "There's no public series for on-premises AI adoption; these vendors' orders and stock prices are the best available proxy.",
    watch: "The group lagging while cloud AI names rise (enterprises not following), or sharp drops after earnings on AI-server backlog.",
  },
};
