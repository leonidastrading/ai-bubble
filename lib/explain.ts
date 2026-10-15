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
  banks: {
    what: "Total return of the big US banks, the Japanese megabanks (US-listed shares) and the regional bank ETF, rebased to 100, against the S&P 500.",
    why: "Banks underwrite the SPV loans and bonds, lend to private-credit funds, and give AI borrowers credit lines that get drawn in full before trouble. When they can't sell the debt on (the $38B Oracle-linked loan took months), it stays on their books.",
    watch: "MUFG, SMFG and JPMorgan underperforming their peers on data-center news; regional banks (KRE) falling with private-credit stocks.",
  },
  polymarket: {
    what: "Open Polymarket markets on an AI downturn, AI-company bankruptcies, a US recession, Fed hikes and the Anthropic IPO. Chance = the current price of a 'Yes' share; 1 week = change in percentage points.",
    why: "Markets with money at stake update faster than surveys or analysts, and they put explicit odds on the outcomes this page tracks indirectly. Thin markets (low volume) can be moved by a few traders.",
    watch: "The AI-bubble and CoreWeave-bankruptcy odds rising week after week alongside CDS spreads and loan prices; the recession odds moving with them would mean the market sees spillover.",
  },
  polymarketHistory: {
    what: "Daily odds for the most-traded market in a few key questions, from Polymarket's price history.",
    why: "The direction matters more than the level: a steady climb means bettors keep updating toward the bubble-pop scenario.",
    watch: "Several lines rising together, or a sudden jump after news like a loan pulled, a downgrade or a capex cut.",
  },
  gpuLoanPricing: {
    what: "The interest margin over SOFR on GPU-backed loans tracked in the SPV table, by date, with each loan's size and rating. Hover a loan for how it was priced.",
    why: "When the GPUs and the contracts behind them look riskier, lenders demand more. CoreWeave's margins went from +2.25% (investment grade, March) to +4.50% (May) to +5.50% (August, after price talk had to widen); Volta was marketed at +6.25–6.50% in October.",
    watch: "New GPU loans pricing wider still, issue prices falling further below par (97 cents and lower), or deals pulled because they can't be sold.",
  },
  usdAi: {
    what: "Stablecoin deposits in USD.AI, a crypto lending protocol that lends against GPUs to small and mid-sized AI clouds (total value locked, from DefiLlama, daily).",
    why: "It's one of the few GPU lenders whose funding is public every day. Depositors can withdraw on a 30-day cycle while the loans run about three years, the classic borrow-short, lend-long mismatch, so falling deposits are an early sign of funding stress for smaller GPU borrowers.",
    watch: "Sharp week-over-week drops, especially alongside neocloud stock and bond selloffs.",
  },
  creditStress: {
    what: "What the credit market charges to insure AI borrowers against default (5-year CDS, in basis points per year: 1,000 bp = $10 to insure $100 of debt) and what their bonds trade at, from dated news reports. The implied default odds are a rule-of-thumb conversion assuming 40% recovery.",
    why: "Stock prices can fall on growth worries; CDS and bond prices fall when lenders doubt they'll be repaid. That's the 'credit transmits' step. CoreWeave's GPU-backed loans and Oracle's SPV leases sit downstream of these names.",
    watch: "CoreWeave's spread staying above 1,000 bp or bonds sliding toward 60–70 cents (distressed), Oracle approaching junk-like spreads (above ~400 bp) or a downgrade below BBB-, and new names appearing here.",
  },
  bankExposure: {
    what: "Supervisory estimates of how much large US banks have committed to AI-adjacent borrowers (Chicago Fed, from Fed loan data), and Moody's count of hyperscaler leases that aren't yet on balance sheets. These are point-in-time studies, not live data.",
    why: "Banks sit at the base of the chain: they lend to AI companies directly, arrange the SPV debt, and lend to the private-credit funds that hold the rest. Unused credit lines are the hidden part: they get drawn exactly when borrowers are weakest.",
    watch: "A jump in C&I loans (credit section) while bank stocks fall, loan sales like Volta's pricing at deeper discounts or failing, and banks buying credit protection (significant risk transfers) on data-center loans.",
  },
  bubbleDebt: {
    what: "Four kinds of debt as a share of GDP (Fed Z.1, Fed H.8, FINRA, BEA): nonfinancial corporate debt, household mortgages, bank business loans, and margin debt. The table shows each one's peak around the 2000 and 2007 tops and its latest value; hover a number for its date.",
    why: "The dot-com bust was mostly an equity loss: companies had raised money by selling stock, so banks came through. The housing bust was a debt loss: mortgages sat on bank and investor balance sheets, which is why it became a banking crisis. The AI buildout started on cash and equity and is now moving to debt.",
    watch: "Corporate debt and bank business loans rising toward or past their 2000 and 2008 peaks while AI capex keeps growing. That would mean an AI bust looks more like 2008 than 2000 for lenders.",
  },
  dcCapacity: {
    what: "Data center capacity in the main US markets (Northern Virginia, Dallas, Silicon Valley, Chicago, Phoenix, New York, Atlanta, Hillsboro) that is operating vs. being built, in megawatts of IT power, from CBRE's twice-yearly reports. Lines skip editions that gave no total.",
    why: "Under-construction capacity is the pipeline of future supply. In 2018–2021 it was a few hundred MW; now it's about 70% of everything already operating. If demand stalls, that pipeline lands on a market priced for scarcity, which is what happened to telecom fiber after 2000.",
    watch: "Construction falling while vacancy rises (the pipeline finishing into weaker demand), the preleased share dropping below ~70%, or projects being paused.",
  },
  gdpGrowthShare: {
    what: "Year-over-year growth in nominal GDP, and how many percentage points of it came from business investment in IT equipment and software (computers, servers, networking, software), quarterly from BEA. Our calculation: the change in that investment ÷ GDP a year earlier.",
    why: "If a large share of growth comes from building AI capacity, the economy depends on that spending continuing. When the dot-com buildout stopped in 2001, this line went negative and pulled GDP down with it. Data-center buildings are counted separately (construction), so this understates the full AI buildout.",
    watch: "The share staying high while consumer spending slows, then the IT line turning negative: a capex cut showing up directly in GDP.",
  },
  DRTSCILM: {
    what: "Fed Senior Loan Officer Survey: the share of banks tightening standards on business loans to large and mid-sized firms, minus the share easing. Quarterly.",
    why: "This is credit transmission from the banks' side. Tightening above about 40% came before or during the 1990, 2001, 2008 and 2020 recessions.",
    watch: "A jump above 20–30%, especially if banks cite industry-specific problems or a worse outlook.",
  },
  BUSLOANS: {
    what: "Commercial and industrial loans on the books of all US commercial banks, monthly.",
    why: "Borrowers draw their credit lines in full when they see trouble coming, so a sudden jump in C&I loans is a stress signal, not a boom (March 2020, late 2008).",
    watch: "A spike of several percent in a month or two while markets are falling.",
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
    why: "One day's score is noisy; the direction over weeks is the signal. It moves slowly because it averages every signal in the table above, several of which update only weekly or monthly.",
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
  gaugesScorecard: {
    what: "Seven classic market-wide warning signs, each marked normal, elevated or flashing by fixed thresholds: CAPE, excess CAPE yield and the Buffett indicator (valuation); the yield curve and Fed hikes (rates); breadth and margin debt (structure).",
    why: "The biggest crashes had all three acts at once: extreme valuations, tightening money, and a narrow, leveraged market. In 2000, six of seven were flashing; 2008 and 2020 came from outside these gauges.",
    watch: "Act 2 joining Act 1: valuations already flashing while the Fed keeps hiking or the curve inverts, then breadth and margin debt rolling over.",
  },
  cape: {
    what: "Price ÷ 10-year average inflation-adjusted earnings (Shiller CAPE) next to price ÷ last 12 months of earnings (regular P/E), monthly. Dashed lines: the post-1990 average and the dot-com peak.",
    why: "CAPE smooths booms and busts, so it's the better bubble gauge; regular P/E spikes when profits collapse (2009) and looks tame at peaks (1929). Normal CAPE stepped up after 1990 with high-margin tech, which is why the post-1990 average is the yardstick here.",
    watch: "CAPE closing in on the dot-com peak (~44). A high CAPE says how much there is to lose, not when.",
  },
  ecy: {
    what: "Earnings yield (100 ÷ CAPE) minus the real return on safe bonds. Shiller method: 10-year Treasury minus the past 10 years' inflation. TIPS method: the 10-year TIPS yield, which already removes expected inflation.",
    why: "CAPE ignores interest rates. ECY asks whether stocks pay enough extra over safe bonds to be worth the risk. It was below zero in 1929 and 1999.",
    watch: "Below 2% is the danger zone; below zero, safe bonds are expected to beat stocks. Rising real yields shrink it even if prices don't move.",
  },
  buffett: {
    what: "Market value of US nonfinancial corporate equities (Federal Reserve Z.1) ÷ GDP, quarterly. Published with a lag of about one quarter.",
    why: "Companies earn their profits from the economy, so a market worth far more than a year of output suggests prices are ahead of reality. The line drifts up over decades because US firms earn more abroad and at higher margins, so compare against past peaks rather than 100%.",
    watch: "New records above the 2021 peak, and the first quarter it rolls over.",
  },
  yieldCurve: {
    what: "10-year Treasury yield minus 2-year yield. Monthly averages since 1976; today's reading is the latest daily spread.",
    why: "When short rates exceed long rates, lending stops paying, credit dries up and the economy slows. Inversions preceded the 1980, 1990, 2001 and 2008 recessions by 12–24 months; 2022–24's deep inversion has so far had no recession.",
    watch: "A new inversion, or a fast re-steepening after one: recessions often start after the curve turns positive again.",
  },
  hikes: {
    what: "Fed hiking cycles found in the monthly Fed funds rate (rises of at least 1 point, trough to peak), and the change in the daily rate from its low of the past two years.",
    why: "Bubbles grow on cheap money and have usually ended after a run of hikes: 1% → 5.25% before the housing crash, 0.25% → 5.5% before 2022.",
    watch: "A new cycle building past 1.5 points while valuations are flashing.",
  },
  marginDebt: {
    what: "Debit balances in FINRA member firms' customer margin accounts: money investors have borrowed to buy securities. Monthly, about six weeks after month end.",
    why: "Borrowing peaks late in bubbles, when confidence is highest, and forced selling on margin calls turns a dip into a crash.",
    watch: "Margin debt growing much faster than the market (the scorecard flashes at 20+ points), then a sharp monthly drop as leveraged positions unwind.",
  },
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
  UMCSENT: {
    what: "University of Michigan survey of how consumers feel about their finances and the economy, monthly (1966 = 100).",
    why: "Spending follows confidence. AI-driven white-collar layoffs or a stock drop would show up here within a month or two.",
    watch: "A fall toward the 50s–60s (2008, 2022 lows) together with rising unemployment rather than just inflation worries.",
  },
  PSAVERT: {
    what: "Share of disposable income households save, monthly (BEA).",
    why: "Savings are the cushion against job losses. A low saving rate means a spending pullback hits harder and faster.",
    watch: "A sudden jump: households cutting back out of fear, which is how a market shock turns into a spending recession.",
  },
  HDTGPDUSQ163N: {
    what: "Total household debt (mortgages, cards, auto, student loans) as a share of GDP, quarterly (BIS via FRED).",
    why: "The 2008 crisis was built on household debt, which peaked near 98% of GDP. A much lower level now means households are less likely to be the trigger this time.",
    watch: "A renewed climb, especially if paired with falling sentiment.",
  },
  TDSP: {
    what: "Required payments on household debt as a share of disposable income, quarterly (Federal Reserve).",
    why: "Measures how heavy the debt feels, not just its size. It peaked above 13% in 2007.",
    watch: "Rising as rates reset higher and incomes slow.",
  },
  TOTALSL: {
    what: "Consumer credit outstanding: credit cards, auto and student loans, excluding mortgages, monthly ($B).",
    why: "Fast growth while savings fall means households are borrowing to keep spending.",
    watch: "Growth that suddenly stops: lenders tightening, which cuts spending.",
  },
  MVLOASM: {
    what: "Auto loans outstanding, owned by lenders or packaged into securities, monthly ($B).",
    why: "Auto loans are the first place subprime stress usually shows, and they're widely sold to bond investors.",
    watch: "Balances growing while delinquencies rise, or reports of subprime auto lenders failing.",
  },
  DRCCLACBS: {
    what: "Share of credit card balances at US banks that are 30+ days past due, quarterly.",
    why: "Card delinquencies move first when household budgets crack. Banks hold this risk directly.",
    watch: "Above about 4%, which last happened around 2009–10.",
  },
  DRSFRMACBS: {
    what: "Share of single-family mortgages at US banks that are 30+ days past due, quarterly.",
    why: "This is where 2008 broke (it peaked above 11% in 2010). Low and steady now; it matters if an AI bust becomes a broad recession.",
    watch: "A sustained rise from today's low level.",
  },
  MORTGAGE30US: {
    what: "Freddie Mac average 30-year fixed mortgage rate, weekly.",
    why: "High rates freeze the housing market and raise payments for new buyers. A rate shock and a market drop together is the 2022 mix.",
    watch: "A move back above 7% while stocks fall.",
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
