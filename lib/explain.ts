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
    what: "The composite stress score (left axis) and the H100 rental price (right axis), from one snapshot saved per day.",
    why: "One day's score is noisy; the direction over weeks is the signal.",
    watch: "The score climbing steadily for several weeks, especially with the H100 price falling at the same time.",
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
};
