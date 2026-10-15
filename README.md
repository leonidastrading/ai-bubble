# AI Bubble Monitor

A one-page Next.js dashboard that tracks the signals behind one plausible AI-bubble-pop scenario:
**monetization stalls → price deflation → capex cuts → credit transmits the shock → circular deals unwind → macro spillover.**

It refreshes once a day on Vercel and needs no API keys.

## What's on the page

| Section | What it shows | Source |
| --- | --- | --- |
| Composite stress gauge | 31 signals, each scaled 0 (calm) to 100 (crisis), then averaged | derived |
| AI chips, hyperscalers, neoclouds, private credit, bank lenders, DC REITs & power, on-prem AI infrastructure, broad market | Relative-performance charts vs. S&P 500 and a scoreboard (1D/1M/3M/YTD/off 52-week high) | Yahoo Finance |
| Hyperscaler capex vs. revenue | Trailing-twelve-month capex, revenue, capex/revenue and YoY growth for MSFT, GOOGL, AMZN, META, ORCL | SEC EDGAR (XBRL) |
| Circular financing | Nvidia days sales outstanding, days of inventory, and non-marketable stakes in private companies | SEC EDGAR (XBRL) |
| AI money web | Live recreation of Bloomberg's Nvidia/OpenAI deal web: companies sized by market value (price × SEC share count) or last private round, arrows for each deal by type, round-trip pairs, full deal list with sources | `data/ai-deals.json` (curated, reviewed weekly), Yahoo, SEC |
| SPV tracker | GPU-backed loan pricing over SOFR by date, USD.AI stablecoin GPU-lending deposits (DefiLlama, live), data-center and GPU-backed SPVs: tenant, equity holders, lenders, debt, rating, terms, reported loan prices and events; lender rollup with stock drawdowns; hyperscaler lease and purchase obligations vs. reported debt | `data/ai-spvs.json` (curated, reviewed weekly), SEC EDGAR (XBRL) |
| Software & private credit | Public SaaS stocks and the IGV ETF vs. the S&P 500; sector facts on private-credit lending to software; each public BDC's software share next to its price / NAV | Yahoo, `data/bdc-software.json` (curated from 10-Qs, reviewed weekly), BIS, Octus, Kamakura |
| BDCs & redemptions | Price / NAV for public BDCs; SC TO-I tender-offer filings from non-traded private-credit funds | Yahoo, SEC EDGAR |
| GPU rental market | $/GPU-hour by source (weekly market median across ~90 providers with spot and 12-month reserved, Vast.ai marketplace, RunPod and Lambda list prices); weekly history charts, archived to Blob so they grow past the 53 free weeks | GetDeploying open dataset (CC BY 4.0), Vast.ai, RunPod API, Lambda pricing page |
| Cost of intelligence | Best open-weight vs. best closed model on Epoch's Capabilities Index over time (gap and lag), API price vs. capability for the top models, cheapest near-frontier price, automatic detection of API price changes, share of US businesses using AI, electricity prices | Epoch AI benchmark data, OpenRouter API, Census BTOS, FRED |
| Classic bubble gauges | A scorecard of seven market-wide warning signs (normal / elevated / flashing) and their history: Shiller CAPE vs P/E, excess CAPE yield (Shiller and TIPS methods), the Buffett indicator, the 10y−2y yield curve, Fed hiking cycles, breadth and margin debt | multpl.com (Shiller data), FRED, FINRA |
| Prediction markets | Polymarket odds on an AI bubble bursting, CoreWeave/OpenAI/Anthropic bankruptcy, a US recession, Fed hikes and the Anthropic IPO, with daily history | Polymarket (Gamma and CLOB APIs) |
| Credit spreads & stress | AI borrowers' reported 5-year CDS spreads and bond prices with implied default odds (`data/credit-stress.json`, curated weekly), Fed loan-officer survey (banks tightening business-loan standards), C&I loans, HY, CCC and BBB OAS, 10-year yield, VIX, NFCI, St. Louis Fed stress index | FRED |
| Concentration & Fed | Equal-weight ÷ cap-weight S&P 500, Fed funds rate, 10y−3m curve, recession probability | Yahoo, FRED |
| AI in GDP | US data center capacity operating vs. under construction (CBRE, `data/datacenters.json`), how much of GDP growth comes from IT equipment & software investment (vs. the dot-com era), IT investment share of GDP vs. the dot-com peak, monthly data-center construction, GDP final sales of computers, business investment in computers and software, power construction | FRED (BEA, Census), Our World in Data |
| Consumers & household debt | Consumer sentiment, saving rate, household debt % of GDP, debt payments % of income, consumer credit, auto loans, credit card and mortgage delinquency, 30-year mortgage rate | FRED |
| Labor | Information and professional-services unemployment, claims, job openings | FRED |
| Adoption & compute | Gen-AI adoption share, hosting PPI, semiconductor production | FRED |
| Google Trends | Search interest for AI assistants (ChatGPT, Claude, Gemini, ...), "AI", bubble-fear terms, and Claude vs. peers. The last good copy is saved to Blob in case Trends rate-limits a refresh | Google Trends (unofficial endpoints) |
| News | Eleven Google News searches over the last 7 days | Google News RSS |

All tickers, FRED series, news queries and scoring thresholds live in `lib/config.ts` and `lib/signals.ts`.

## Updating the deal web

The deals live in `data/ai-deals.json`. Arrows point the way money flows (payer → recipient). Each deal needs a `source` URL and a `status`: `announced` (company statement, drawn solid), `reported` (press reports) or `loi` (letter of intent), both drawn dashed. `data/ai-spvs.json` holds the SPV tracker in the same way; each vehicle can carry a `stress` price (cents on the dollar) from a dated report. `data/bdc-software.json` holds each BDC's software share with the filing it came from. A weekly scheduled Claude Code session reviews the news, edits these files and pushes; Vercel redeploys on push. Market values update daily without any edits.

## How the daily refresh works

- The page is statically generated with `revalidate = 86400`, and every upstream fetch is cached under one tag.
- `vercel.json` schedules a cron job at 21:30 UTC daily (after the US close) that calls `/api/refresh`. The job clears the cache tag, re-fetches everything, saves a snapshot, and rebuilds the page.
- Feeds fail independently. If one is down, its card says so and the rest of the page still renders. The failures are listed at the bottom of the page.

### Optional: history charts

Prices and FRED series have their own history. The GPU rental rates, BDC price/NAV and composite score don't, so the refresh job stores a daily snapshot of them in **Vercel Blob** when a store is connected:

1. In the Vercel project, go to **Storage → Create → Blob**. Pick a **private** store and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`.
2. Redeploy. The score-history and H100-history charts appear after the second daily run.

### Optional environment variables

- `CRON_SECRET`: if set, `/api/refresh` only accepts requests carrying it. Vercel Cron sends it automatically.
- `SEC_USER_AGENT`: SEC EDGAR requires a descriptive User-Agent with a contact email, for example `"Your Name you@example.com"`.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

Not investment advice. The composite score is a heuristic, not a forecast.
