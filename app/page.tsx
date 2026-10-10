import { FilingsTable, Gauge, NewsList, Pct, QuoteTable, SignalTable } from "@/components/blocks";
import { HBarChart, HistoryChart, MultiSeriesChart, RelativeChart, SeriesChart, TrendsChart } from "@/components/charts";
import { FRED_SERIES, SEC_WATCH, TICKER_GROUPS, type FredSeries } from "@/lib/config";
import { getDashboardData } from "@/lib/data";
import { historyEnabled } from "@/lib/history";
import type { Quote } from "@/lib/yahoo";

// Rebuilt at most once a day, plus on demand by the daily cron (/api/refresh).
export const revalidate = 86400;
export const maxDuration = 120;

const REFS: Record<string, { y: number; label: string; tone: "calm" | "stress" | "watch" }[]> = {
  BAMLH0A0HYM2: [{ y: 6.5, label: "stress", tone: "stress" }],
  BAMLH0A3HYC: [{ y: 16, label: "stress", tone: "stress" }],
  VIXCLS: [{ y: 35, label: "stress", tone: "stress" }],
  NFCI: [{ y: 0, label: "avg", tone: "watch" }],
  STLFSI4: [{ y: 0, label: "avg", tone: "watch" }],
};

const SECTIONS = [
  { id: "signals", label: "Signals" },
  ...TICKER_GROUPS.map((g) => ({ id: g.id, label: g.title.split(" (")[0] })),
  { id: "capex", label: "Capex vs revenue" },
  { id: "circular", label: "Circular financing" },
  { id: "bdcs", label: "BDCs & redemptions" },
  { id: "gpu", label: "GPU rental" },
  { id: "credit", label: "Credit spreads" },
  { id: "fed", label: "Concentration & Fed" },
  { id: "labor", label: "Labor" },
  { id: "economy", label: "Adoption & compute" },
  { id: "trends", label: "Google Trends" },
  { id: "news", label: "News" },
  { id: "playbook", label: "Playbook" },
];

/** Keep the last year daily; thin older history to keep the page light. */
function thin<T>(points: T[], recent = 260, older = 260): T[] {
  if (points.length <= recent + older) return points;
  const head = points.slice(0, -recent);
  const step = Math.ceil(head.length / older);
  return [...head.filter((_, i) => i % step === 0), ...points.slice(-recent)];
}

function trim(q: Quote) {
  return { symbol: q.symbol, name: q.name, points: q.points.slice(-504) };
}

const usdB = (v: number) => `$${(v / 1e9).toLocaleString("en-US", { maximumFractionDigits: 0 })}B`;

function FredCard({ s, data }: { s: FredSeries; data: Awaited<ReturnType<typeof getDashboardData>>["fred"][string] | undefined }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>{s.title}</h3>
          <p className="sub">
            {data ? (
              <>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                  {data.last.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  {s.unit === "%" ? "%" : s.unit === "k" ? "k" : ""}
                </span>{" "}
                · {data.lastDate}
                {data.changeYoY != null && (
                  <>
                    {" "}
                    · YoY {data.changeYoY >= 0 ? "+" : ""}
                    {data.changeYoY.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </>
                )}
              </>
            ) : (
              "Unavailable today"
            )}
          </p>
        </div>
        <a className="faint" style={{ fontSize: 11 }} href={`https://fred.stlouisfed.org/series/${s.id}`} target="_blank" rel="noopener noreferrer">
          FRED {s.id} ↗
        </a>
      </div>
      {data && <SeriesChart points={thin(data.points)} unit={s.unit === "%" ? "%" : ""} refs={REFS[s.id]} />}
      {s.note && <p className="note">{s.note}</p>}
    </div>
  );
}

export default async function Page() {
  const d = await getDashboardData();
  const fredGroup = (g: FredSeries["group"]) => FRED_SERIES.filter((s) => s.group === g);

  const historyRows = d.history.map((h) => ({
    date: h.date,
    score: h.score,
    h100: h.gpu["H100 SXM"] ?? null,
    pnav: h.bdcPriceToNav,
  }));

  // Capex as % of revenue per company, aligned on quarter-end dates.
  const capexRows = (() => {
    const byEnd = new Map<string, Record<string, number | string | null>>();
    for (const c of d.capex)
      for (const p of c.series) {
        const row = byEnd.get(p.end) ?? { t: p.end };
        row[c.symbol] = +((p.capexTtm / p.revenueTtm) * 100).toFixed(1);
        byEnd.set(p.end, row);
      }
    return [...byEnd.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  })();

  // Equal-weight ÷ cap-weight S&P: falling = the index leans harder on a few (AI) giants.
  const breadth = (() => {
    const rsp = d.quotes.RSP?.points;
    const spy = new Map((d.quotes.SPY?.points ?? []).map((p) => [p.t, p.v]));
    if (!rsp || !spy.size) return [];
    return rsp.filter((p) => spy.has(p.t)).map((p) => ({ t: p.t, v: +((p.v / spy.get(p.t)!) * 100).toFixed(3) }));
  })();

  const updated = new Date(d.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>AI Bubble Monitor</h1>
          <p>
            Daily read on the path from a revenue gap to a financing squeeze: monetization stalls → price deflation →
            capex cuts → credit transmits the shock → circular deals unwind → macro spillover.
          </p>
        </div>
        <div className="stamp">Updated {updated} ET · refreshes daily</div>
      </header>

      <nav className="toc" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.label}
          </a>
        ))}
      </nav>

      <section id="signals" style={{ marginTop: 0 }}>
        <div className="grid hero">
          <div className="card">
            <h3>Composite bubble stress</h3>
            <p className="sub">Average of {d.signals.length} signals, each scaled 0 (calm) to 100 (crisis)</p>
            <Gauge score={d.score} />
            <p className="note">
              A heuristic, not a forecast. Any one signal alone is noise. A real crack is several at once: BDC discounts past
              15–20%, redemptions over caps, GPU rates dropping, Oracle credit spiking.
            </p>
          </div>
          <div className="card">
            <h3>Signals, most stressed first</h3>
            <p className="sub">Hover a row for what it measures</p>
            <SignalTable signals={d.signals} />
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>Score history</h3>
          {historyRows.length >= 2 ? (
            <>
              <p className="sub">Daily snapshots stored by the refresh job</p>
              <HistoryChart
                rows={historyRows}
                keys={[
                  { key: "score", label: "Composite score", color: "var(--stress)", axis: "left" },
                  { key: "h100", label: "H100 $/hr", color: "var(--s1)", axis: "right" },
                ]}
              />
            </>
          ) : (
            <p className="sub">
              {historyEnabled()
                ? `Collecting daily snapshots (${historyRows.length} so far). The chart appears after the second day.`
                : "Connect a Vercel Blob store to this project to record the score, GPU prices and BDC price/NAV every day and chart them here."}
            </p>
          )}
        </div>
      </section>

      {TICKER_GROUPS.map((g) => {
        const qs = g.tickers.map((t) => d.quotes[t.symbol]).filter(Boolean);
        const bench = g.benchmark ? d.quotes[g.benchmark] : undefined;
        const series = [...qs, ...(bench ? [bench] : [])].map(trim);
        return (
          <section id={g.id} key={g.id}>
            <h2>{g.title}</h2>
            <p className="blurb">{g.blurb}</p>
            <div className="grid g2">
              <div className="card">
                <h3>Relative performance{bench ? " vs S&P 500 (dashed)" : ""}</h3>
                {series.length ? <RelativeChart series={series} /> : <div className="empty">Unavailable today.</div>}
              </div>
              <div className="card">
                <h3>Scoreboard</h3>
                <p className="sub">Adjusted closes</p>
                <QuoteTable quotes={qs} />
              </div>
            </div>
          </section>
        );
      })}

      <section id="capex">
        <h2>Hyperscaler capex vs. revenue</h2>
        <p className="blurb">
          Step 1 of the scenario: revenue has to grow into the buildout. If trailing capex keeps growing much faster than
          revenue, the bet is being extended, not paid off. From 10-Q/10-K filings (SEC XBRL), trailing twelve months.
        </p>
        <div className="grid g2">
          <div className="card">
            <h3>Capex as % of revenue</h3>
            <p className="sub">
              {d.capexAggregate
                ? `Combined: ${(d.capexAggregate.capexToRevenue * 100).toFixed(0)}% · capex ${d.capexAggregate.capexYoY >= 0 ? "+" : ""}${d.capexAggregate.capexYoY.toFixed(0)}% YoY vs revenue ${d.capexAggregate.revenueYoY >= 0 ? "+" : ""}${d.capexAggregate.revenueYoY.toFixed(0)}%`
                : "Trailing twelve months"}
            </p>
            {capexRows.length ? (
              <MultiSeriesChart rows={capexRows} keys={d.capex.map((c) => c.symbol)} format="pct" />
            ) : (
              <div className="empty">SEC filings data is unavailable today.</div>
            )}
          </div>
          <div className="card">
            <h3>Latest trailing twelve months</h3>
            <p className="sub">Capex = purchases of property and equipment; excludes finance leases and SPV-funded builds</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Capex</th>
                    <th>Revenue</th>
                    <th>Capex/Rev</th>
                    <th>Capex YoY</th>
                    <th>Rev YoY</th>
                  </tr>
                </thead>
                <tbody>
                  {d.capex.map((c) => (
                    <tr key={c.symbol} title={`Quarter ending ${c.periodEnd}`}>
                      <td>
                        <span className="sym">{c.symbol}</span>
                        <span className="name">{c.periodEnd}</span>
                      </td>
                      <td>{usdB(c.capexTtm)}</td>
                      <td>{usdB(c.revenueTtm)}</td>
                      <td>{(c.capexToRevenue * 100).toFixed(0)}%</td>
                      <td><Pct v={c.capexYoY} digits={0} /></td>
                      <td><Pct v={c.revenueYoY} digits={0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              Off-balance-sheet SPV and lease commitments (about $1.65T by one count) are not in these numbers, so the real
              buildout is larger. Guidance revisions arrive on earnings calls; watch the &ldquo;Hyperscaler capex&rdquo; news
              feed.
            </p>
          </div>
        </div>
      </section>

      <section id="circular">
        <h2>Circular financing</h2>
        <p className="blurb">
          Step 5: chipmakers invest in customers who then buy their chips. If reported revenue is partly self-funded, the
          supplier&apos;s balance sheet shows it first: customers pay slower, inventory builds, and stakes in private AI
          companies grow. From Nvidia&apos;s 10-Q/10-K filings.
        </p>
        <div className="grid g2">
          <div className="card">
            <h3>Nvidia: days to collect and days of inventory</h3>
            {d.nvidia ? (
              <>
                <p className="sub">
                  Quarter ending {d.nvidia.periodEnd}: DSO {d.nvidia.dso.toFixed(0)} days
                  {d.nvidia.dio != null ? ` · DIO ${d.nvidia.dio.toFixed(0)} days` : ""}
                </p>
                <MultiSeriesChart
                  rows={d.nvidia.series.map((q) => ({ t: q.end, "Days sales outstanding": q.dso, "Days inventory": q.dio }))}
                  keys={["Days sales outstanding", "Days inventory"]}
                  format="days"
                />
              </>
            ) : (
              <div className="empty">SEC filings data is unavailable today.</div>
            )}
          </div>
          <div className="card">
            <h3>What to read into it</h3>
            {d.nvidia?.privateStakes != null && (
              <>
                <div className="big">{usdB(d.nvidia.privateStakes)}</div>
                <p className="sub">Nvidia&apos;s non-marketable equity stakes (mostly private AI companies), latest filing</p>
              </>
            )}
            <ul className="muted" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
              <li>Rising DSO: customers are taking longer to pay, or getting extended terms.</li>
              <li>Rising inventory days alongside: product is shipping slower than it&apos;s made.</li>
              <li>Growing private stakes: more of the customer base is funded by the supplier.</li>
              <li>
                Not automated: the share of revenue tied to these deals. It appears only in 10-K footnotes and deal
                announcements, so it&apos;s tracked through the &ldquo;Circular &amp; vendor financing&rdquo; news feed.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="bdcs">
        <h2>BDCs & private-credit redemptions</h2>
        <p className="blurb">
          Private-credit marks are self-reported and lag. Public BDCs trading at a widening discount to NAV, and non-traded
          funds facing tender requests above their 5% quarterly cap, are where the market forces a real price.
        </p>
        <div className="grid g2">
          <div className="card">
            <h3>Price / NAV</h3>
            <p className="sub">
              Median {d.bdcPriceToNav != null ? `${d.bdcPriceToNav.toFixed(2)}x` : "—"} · below 1.0x means the market doubts
              the marks
            </p>
            {d.bdcs.some((b) => b.priceToNav != null) ? (
              <HBarChart
                rows={d.bdcs.filter((b) => b.priceToNav != null).map((b) => ({ label: b.symbol, value: b.priceToNav! }))}
                reference={1}
                format="ratio"
                toneFor="pnav"
              />
            ) : (
              <div className="empty">NAV data from SEC EDGAR is unavailable today.</div>
            )}
            <div className="table-scroll" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>BDC</th>
                    <th>Price</th>
                    <th>NAV</th>
                    <th>NAV as of</th>
                    <th>3M</th>
                  </tr>
                </thead>
                <tbody>
                  {d.bdcs.map((b) => (
                    <tr key={b.symbol}>
                      <td>
                        <span className="sym">{b.symbol}</span>
                        <span className="name">{b.name}</span>
                      </td>
                      <td>{b.price?.toFixed(2) ?? "—"}</td>
                      <td>{b.nav?.toFixed(2) ?? "—"}</td>
                      <td className="faint">{b.navAsOf ?? "—"}</td>
                      <td><Pct v={d.quotes[b.symbol]?.chg3m} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h3>Tender offers (redemptions) on EDGAR, last 120 days</h3>
            <p className="sub">SC TO-I filings mentioning: {SEC_WATCH.join(", ")}</p>
            {d.tenderOffers ? (
              <>
                <div className="big">{d.tenderOffers.length}</div>
                <p className="sub">filings in window. Open the amendments (TO-I/A) to see whether requests exceeded the cap.</p>
                <FilingsTable filings={d.tenderOffers} />
              </>
            ) : (
              <div className="empty">SEC full-text search is unavailable today.</div>
            )}
          </div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <h3>BDC prices vs S&P 500</h3>
          <RelativeChart series={[...d.bdcs.map((b) => d.quotes[b.symbol]), d.quotes.SPY].filter(Boolean).map(trim)} />
        </div>
      </section>

      <section id="gpu">
        <h2>GPU rental market</h2>
        <p className="blurb">
          GPU rental rates are the collateral value behind GPU-backed SPVs and neocloud loans. If intelligence gets cheap, who
          earns a return on $50B clusters? Prices are the median on-demand $/GPU-hour on the Vast.ai marketplace; term contracts differ and a small marketplace is noisy day to day, so watch the trend, not one print.
        </p>
        <div className="grid g2">
          <div className="card">
            <h3>Median $/GPU-hour today</h3>
            {d.gpu.length ? (
              <HBarChart rows={d.gpu.map((g) => ({ label: g.model, value: +g.median.toFixed(2) }))} format="usd" />
            ) : (
              <div className="empty">Unavailable today.</div>
            )}
          </div>
          <div className="card">
            <h3>Distribution</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>GPU</th>
                    <th>25th pct</th>
                    <th>Median</th>
                    <th>75th pct</th>
                    <th>Offers</th>
                  </tr>
                </thead>
                <tbody>
                  {d.gpu.map((g) => (
                    <tr key={g.model}>
                      <td className="sym">{g.model}</td>
                      <td>${g.p25.toFixed(2)}</td>
                      <td style={{ fontWeight: 600 }}>${g.median.toFixed(2)}</td>
                      <td>${g.p75.toFixed(2)}</td>
                      <td className="muted">{g.offers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyRows.length >= 2 && (
              <>
                <h3 style={{ marginTop: 16 }}>H100 history</h3>
                <HistoryChart rows={historyRows} keys={[{ key: "h100", label: "H100 $/hr", color: "var(--s1)", axis: "left" }]} />
              </>
            )}
            <p className="note">
              For institutional-grade indices see Silicon Data&apos;s H100 rental index and Ornn. Both are paid.
            </p>
          </div>
        </div>
      </section>

      <section id="credit">
        <h2>Credit spreads & financial stress</h2>
        <p className="blurb">
          Much of the buildout is financed off balance sheet through private credit and GPU-backed loans. If the shock
          transmits through credit, it shows up in spreads and financial-conditions indices.
        </p>
        <div className="grid g3">
          {[...fredGroup("credit"), ...fredGroup("stress")].map((s) => (
            <FredCard key={s.id} s={s} data={d.fred[s.id]} />
          ))}
        </div>
      </section>

      <section id="fed">
        <h2>Concentration & the Fed</h2>
        <p className="blurb">
          Step 6: AI names are a large share of S&amp;P 500 weight, so their fall drags the index. The Fed can cut, but that
          can&apos;t restore earnings that were never going to arrive.
        </p>
        <div className="grid g3">
          <div className="card">
            <h3>Equal-weight ÷ cap-weight S&amp;P 500</h3>
            <p className="sub">
              RSP ÷ SPY × 100. Falling = the index depends more on a few giants; a sharp reversal often marks a mega-cap
              unwind.
            </p>
            {breadth.length ? <SeriesChart points={breadth} decimals={3} /> : <div className="empty">Unavailable today.</div>}
          </div>
          {fredGroup("fed").map((s) => (
            <FredCard key={s.id} s={s} data={d.fred[s.id]} />
          ))}
        </div>
      </section>

      <section id="labor">
        <h2>Labor: the &ldquo;too successful too fast&rdquo; path</h2>
        <p className="blurb">
          AI works, white-collar layoffs hit, consumer spending and ad budgets weaken, and hyperscalers cut capex anyway.
          Watch white-collar unemployment rising while corporate margins set records.
        </p>
        <div className="grid g3">
          {fredGroup("labor").map((s) => (
            <FredCard key={s.id} s={s} data={d.fred[s.id]} />
          ))}
        </div>
      </section>

      <section id="economy">
        <h2>Adoption & compute economy</h2>
        <p className="blurb">
          Usage keeps climbing even in a bust, as internet adoption did through the dot-com crash. The question is whether
          revenue grows as fast as capex and debt.
        </p>
        <div className="grid g3">
          {fredGroup("economy").map((s) => (
            <FredCard key={s.id} s={s} data={d.fred[s.id]} />
          ))}
        </div>
      </section>

      <section id="trends">
        <h2>Google Trends</h2>
        <p className="blurb">
          Worldwide search interest, weekly. Each chart is scaled on its own, so compare lines within a chart, not across
          charts.
        </p>
        <div className="grid g2">
          {d.trends.map((g) => (
            <div className="card" key={g.id}>
              <div className="card-head">
                <h3>{g.title}</h3>
                {g.data && !g.live && (
                  <span className="pill tone-watch" title="Google Trends rate-limited today's fetch">
                    saved {g.data.fetchedAt.slice(0, 10)}
                  </span>
                )}
              </div>
              <p className="sub">{g.blurb}</p>
              {g.data ? (
                <TrendsChart
                  keywords={g.data.keywords}
                  points={g.data.points}
                  ranges={g.data.time === "today 12-m" ? ["3M", "6M", "1Y"] : ["1Y", "2Y", "5Y"]}
                />
              ) : (
                <div className="empty">Google Trends is rate-limiting requests today. The chart returns on the next successful refresh.</div>
              )}
              <p className="note">
                <a
                  href={`https://trends.google.com/trends/explore?date=${encodeURIComponent(g.data?.time ?? "today 5-y")}&q=${encodeURIComponent((g.data?.keywords ?? []).join(","))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Trends ↗
                </a>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="news">
        <h2>News, last 7 days</h2>
        <p className="blurb">Google News searches, refreshed daily.</p>
        <div className="grid g3">
          {d.news.map((n) => (
            <div className="card" key={n.id}>
              <h3>{n.title}</h3>
              <NewsList items={n.items} />
            </div>
          ))}
        </div>
      </section>

      <section id="playbook">
        <h2>Playbook: what to check that this page can&apos;t automate</h2>
        <div className="grid g2">
          <div className="card">
            <h3>Quarterly, around earnings</h3>
            <ul className="muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Hyperscaler capex guidance: any &ldquo;pause to digest capacity&rdquo; language. Others tend to follow within weeks.</li>
              <li>Cloud AI revenue growth vs. capex growth. Revenue +30% against capex/debt +60% is the dot-com pattern.</li>
              <li>BDC 10-Qs: non-accruals, PIK income share, markdowns on data center and neocloud loans.</li>
              <li>10-K lease footnotes: firm commitments vs. renewal options and residual value guarantees.</li>
              <li>Circular financing: chipmaker investments in customers who then buy their chips.</li>
            </ul>
          </div>
          <div className="card">
            <h3>Market signals behind paywalls</h3>
            <ul className="muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Oracle 5-year CDS (Bloomberg; moves get reported in the financial press).</li>
              <li>Data center ABS and SPV bond spreads (FINRA TRACE for 144A trades).</li>
              <li>Short interest and borrow cost on OWL and CRWV (S3 Partners, Ortex).</li>
              <li>Fed Financial Stability Report (twice a year), IMF GFSR, BIS Quarterly Review.</li>
              <li>Enterprise AI seat churn and public licence cuts.</li>
            </ul>
          </div>
        </div>
        <p className="note">
          Data: Yahoo Finance (prices), FRED (spreads, labor, macro), SEC EDGAR (BDC NAV via XBRL; tender offers via
          full-text search), Vast.ai (GPU marketplace), Google News (headlines), Google Trends (search interest). Not investment advice.
        </p>
      </section>

      {d.errors.length > 0 && (
        <details className="errors">
          <summary>{d.errors.length} data feeds were unavailable on the last refresh</summary>
          <ul>
            {d.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
