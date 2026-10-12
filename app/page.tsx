import { Explain, FilingsTable, Gauge, NewsList, Pct, QuoteTable, SignalTable } from "@/components/blocks";
import { NetworkGraph } from "@/components/network";
import { ResetSettings } from "@/components/reset-settings";
import { SortableTable } from "@/components/sortable-table";
import { DEAL_TYPES } from "@/lib/deal-types";
import { stressColor, toScore } from "@/lib/stress-color";
import { HBarChart, HistoryChart, MultiSeriesChart, RelativeChart, SeriesChart, TimeLinesChart, TrendsChart } from "@/components/charts";
import { FRED_SERIES, SEC_WATCH, SOFTWARE_GROUP, TICKER_GROUPS, type FredSeries } from "@/lib/config";
import softwareData from "@/data/bdc-software.json";
import { getDashboardData } from "@/lib/data";
import { historyEnabled } from "@/lib/history";
import { quarterRows } from "@/lib/quarters";
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
  { id: "web", label: "AI money web" },
  { id: "spv", label: "SPV tracker" },
  { id: "software", label: "Software & credit" },
  { id: "bdcs", label: "BDCs & redemptions" },
  { id: "gpu", label: "GPU rental" },
  { id: "intel", label: "Cost of intelligence" },
  { id: "credit", label: "Credit spreads" },
  { id: "fed", label: "Concentration & Fed" },
  { id: "gdp", label: "AI in GDP" },
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

const GPU_ROWS: { model: string; label: string; slug: string | null }[] = [
  { model: "B200", label: "B200", slug: "nvidia-b200" },
  { model: "H200", label: "H200", slug: "nvidia-h200" },
  { model: "H100 SXM", label: "H100 SXM", slug: "nvidia-h100" },
  { model: "H100 PCIE", label: "H100 PCIe", slug: null },
  { model: "A100 SXM4", label: "A100 80GB", slug: "nvidia-a100" },
];

function fmtFred(s: FredSeries, v: number) {
  if (s.unit === "$/kWh") return `${(v * 100).toFixed(1)}¢/kWh`;
  if (s.unit === "$B") return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}B`;
  if (s.unit === "$M") return `$${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })}B`;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}${s.unit === "%" ? "%" : s.unit === "k" ? "k" : ""}`;
}

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
                  {fmtFred(s, data.last)}
                </span>{" "}
                · {data.lastDate}
                {data.changeYoY != null && (
                  <>
                    {" "}
                    · YoY {data.changeYoY >= 0 ? "+" : ""}
                    {s.unit.startsWith("$")
                      ? `${((data.changeYoY / (data.last - data.changeYoY)) * 100).toFixed(1)}%`
                      : data.changeYoY.toLocaleString("en-US", { maximumFractionDigits: 2 })}
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
      {data && (
        <SeriesChart
          points={thin(s.unit === "$M" ? data.points.map((p) => ({ t: p.t, v: p.v / 1000 })) : data.points)}
          unit={s.unit === "%" ? "%" : ""}
          refs={REFS[s.id]}
          storageKey={`fred:${s.id}`}
          ranges={(s.years ?? 5) > 5 ? ["5Y", "10Y", "25Y", "All"] : undefined}
          defaultRange={(s.years ?? 5) > 5 ? "All" : undefined}
          decimals={1}
        />
      )}
      <Explain id={s.id} />
    </div>
  );
}

export default async function Page() {
  const d = await getDashboardData();
  const fredGroup = (g: FredSeries["group"]) => FRED_SERIES.filter((s) => s.group === g && !s.hidden);

  const historyRows = d.history.map((h) => ({
    date: h.date,
    score: h.score,
    h100: h.gpu["H100 SXM"] ?? null,
    pnav: h.bdcPriceToNav,
  }));

  // Capex as % of revenue per company, one slot per calendar quarter.
  const capexRows = quarterRows(
    d.capex.map((c) => ({
      key: c.symbol,
      points: c.series.map((p) => ({ end: p.end, value: +((p.capexTtm / p.revenueTtm) * 100).toFixed(1) })),
    })),
  );

  // Equal-weight ÷ cap-weight S&P: falling = the index leans harder on a few (AI) giants.
  const breadth = (() => {
    const rsp = d.quotes.RSP?.points;
    const spy = new Map((d.quotes.SPY?.points ?? []).map((p) => [p.t, p.v]));
    if (!rsp || !spy.size) return [];
    return rsp.filter((p) => spy.has(p.t)).map((p) => ({ t: p.t, v: +((p.v / spy.get(p.t)!) * 100).toFixed(3) }));
  })();

  // GPU market history, keyed by model.
  const gpuLatestWeek = d.gpuHistory.length ? d.gpuHistory[d.gpuHistory.length - 1].date : null;
  const gpuMarket: Record<string, { onDemand: number | null; spot: number | null; reserved12: number | null; providers: number | null; yoy: number | null }> = {};
  for (const slug of ["nvidia-b200", "nvidia-h200", "nvidia-h100", "nvidia-a100"]) {
    const ws = d.gpuHistory.filter((w) => w.slug === slug);
    const last = ws[ws.length - 1];
    if (!last) continue;
    const cutoff = new Date(Date.parse(last.date) - 364 * 86400_000).toISOString().slice(0, 10);
    const yearAgo = ws.find((w) => w.date >= cutoff && w.onDemand != null)?.onDemand;
    gpuMarket[slug] = {
      onDemand: last.onDemand,
      spot: last.spot,
      reserved12: last.reserved12,
      providers: last.providers,
      yoy: last.onDemand != null && yearAgo ? (last.onDemand / yearAgo - 1) * 100 : null,
    };
  }
  const gpuTrendRows = (() => {
    const byDate = new Map<string, Record<string, number | string | null>>();
    const label: Record<string, string> = { "nvidia-b200": "B200", "nvidia-h200": "H200", "nvidia-h100": "H100", "nvidia-a100": "A100" };
    for (const w of d.gpuHistory) {
      if (!label[w.slug] || w.onDemand == null) continue;
      const row = byDate.get(w.date) ?? { t: w.date };
      row[label[w.slug]] = w.onDemand;
      byDate.set(w.date, row);
    }
    return [...byDate.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  })();
  const h100Rows = d.gpuHistory
    .filter((w) => w.slug === "nvidia-h100")
    .map((w) => ({ t: w.date, "On-demand": w.onDemand, "12-month reserved": w.reserved12, Spot: w.spot }));

  // IT equipment & software investment as a share of GDP (both quarterly, $B SAAR).
  const itShare = (() => {
    const gdp = new Map((d.fred.GDP?.points ?? []).map((p) => [p.t, p.v]));
    return (d.fred.A679RC1Q027SBEA?.points ?? [])
      .filter((p) => gdp.get(p.t))
      .map((p) => ({ t: p.t, v: +((p.v / gdp.get(p.t)!) * 100).toFixed(2) }));
  })();

  // Software & private credit: curated exposure joined with live price / NAV.
  type BdcSoftware = { symbol: string; pct: number; label: string; asOf: string; priorPct: number | null; source: string; note: string | null };
  const softwareRows = (softwareData.bdcs as BdcSoftware[]).map((b) => {
    const live = d.bdcs.find((x) => x.symbol === b.symbol);
    return { ...b, name: live?.name ?? b.symbol, pnav: live?.priceToNav ?? null };
  });
  const softwareAsOf = [...new Set(softwareRows.map((r) => r.asOf))].sort().join(" to ");
  const softwareCompare = (() => {
    const xs = softwareRows.filter((r) => r.pnav != null);
    if (xs.length < 4) return null;
    const med = (v: number[]) => {
      const s = [...v].sort((a, b) => a - b);
      return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    };
    const cut = med(xs.map((r) => r.pct));
    const heavy = xs.filter((r) => r.pct >= cut).map((r) => r.pnav!);
    const light = xs.filter((r) => r.pct < cut).map((r) => r.pnav!);
    return heavy.length && light.length ? { heavy: med(heavy), light: med(light) } : null;
  })();
  const softwareBench = d.quotes[SOFTWARE_GROUP.benchmark!];
  const softwareSeries = [...SOFTWARE_GROUP.tickers.map((t) => d.quotes[t.symbol]).filter(Boolean), ...(softwareBench ? [softwareBench] : [])].map(trim);

  // Cost of intelligence.
  const gapRows = (d.intel.gap?.series ?? [])
    .filter((p) => p.t >= "2023-01-01")
    .map((p) => ({ t: p.t, "Best closed model": p.closed, "Best open-weight model": p.open }));
  const priceChanges = Object.entries(d.intel.priceLog)
    .flatMap(([id, hist]) =>
      hist.slice(1).map((p, i) => {
        const prev = hist[i];
        const blend = (x: { inPerM: number; outPerM: number }) => (3 * x.inPerM + x.outPerM) / 4;
        return { id, date: p.date, from: blend(prev), to: blend(p), change: (blend(p) / blend(prev) - 1) * 100 };
      }),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const priceLogStart = Object.values(d.intel.priceLog).flat().map((p) => p.date).sort()[0] ?? null;
  const adoptionRows = (() => {
    const by = new Map<string, Record<string, number | string | null>>();
    for (const p of d.intel.adoption?.using ?? []) by.set(p.t, { ...(by.get(p.t) ?? { t: p.t }), "Using AI now": p.v });
    for (const p of d.intel.adoption?.expecting ?? []) by.set(p.t, { ...(by.get(p.t) ?? { t: p.t }), "Expect to in 6 months": p.v });
    return [...by.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  })();
  const usd2 = (v: number | null | undefined) => (v == null ? "—" : v >= 10 ? `$${v.toFixed(1)}` : `$${v.toFixed(2)}`);

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
        <div className="stamp">
          Updated {updated} ET · refreshes daily · <ResetSettings />
        </div>
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
          <Explain id="history" />
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
                {series.length ? <RelativeChart series={series} storageKey={`rel:${g.id}`} /> : <div className="empty">Unavailable today.</div>}
                <Explain id={g.id} />
              </div>
              <div className="card">
                <h3>Scoreboard</h3>
                <p className="sub">Adjusted closes</p>
                <QuoteTable quotes={qs} storageKey={`table:score:${g.id}`} />
                <Explain id="scoreboard" />
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
              <MultiSeriesChart rows={capexRows} keys={d.capex.map((c) => c.symbol)} format="pct" storageKey="multi:capex" />
            ) : (
              <div className="empty">SEC filings data is unavailable today.</div>
            )}
            <Explain id="capex" />
          </div>
          <div className="card">
            <h3>Latest trailing twelve months</h3>
            <p className="sub">Capex = purchases of property and equipment; excludes finance leases and SPV-funded builds</p>
            <SortableTable
              storageKey="table:capex"
              columns={[
                { label: "Company" },
                { label: "Capex", firstDir: "desc" },
                { label: "Revenue", firstDir: "desc" },
                { label: "Capex/Rev", firstDir: "desc" },
                { label: "Capex YoY", firstDir: "desc" },
                { label: "Rev YoY", firstDir: "desc" },
              ]}
              rows={d.capex.map((c) => ({
                key: c.symbol,
                title: `Quarter ending ${c.periodEnd}`,
                sort: [c.symbol, c.capexTtm, c.revenueTtm, c.capexToRevenue, c.capexYoY, c.revenueYoY],
                cells: [
                  <>
                    <span className="sym">{c.symbol}</span>
                    <span className="name">{c.periodEnd}</span>
                  </>,
                  usdB(c.capexTtm),
                  usdB(c.revenueTtm),
                  `${(c.capexToRevenue * 100).toFixed(0)}%`,
                  <Pct v={c.capexYoY} digits={0} />,
                  <Pct v={c.revenueYoY} digits={0} />,
                ],
              }))}
            />
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
                  rows={quarterRows([
                    { key: "Days sales outstanding", points: d.nvidia.series.map((q) => ({ end: q.end, value: q.dso })) },
                    { key: "Days inventory", points: d.nvidia.series.map((q) => ({ end: q.end, value: q.dio })) },
                  ])}
                  keys={["Days sales outstanding", "Days inventory"]}
                  format="days"
                  storageKey="multi:nvidia"
                />
              </>
            ) : (
              <div className="empty">SEC filings data is unavailable today.</div>
            )}
            <Explain id="nvidia" />
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

      <section id="web">
        <h2>The AI money web</h2>
        <p className="blurb">
          A live version of Bloomberg&apos;s &ldquo;How Nvidia and OpenAI fuel the AI money machine&rdquo;. Size the circles by
          exposure (deal dollars relative to company value), by deal dollars, or by market value as in the original. Deals are
          curated from announcements and press reports and reviewed weekly; your chart settings are remembered on this
          device.
        </p>
        {d.network ? (
          <>
            <div className="card">
              <div className="card-head">
                <h3>Who pays whom</h3>
                <span className="faint" style={{ fontSize: 12 }}>
                  {d.network.edges.length} deals · deal list reviewed {d.network.updated}
                </span>
              </div>
              <NetworkGraph nodes={d.network.nodes} edges={d.network.edges} width={d.network.width} height={d.network.height} />
              <Explain id="web" />
            </div>
            <div className="grid g2" style={{ marginTop: 14 }}>
              <div className="card">
                <h3>Round trips: money flowing both ways</h3>
                <p className="sub">
                  Pairs where one side funds the other and gets paid back for chips or compute. Known headline amounts
                  only; many deals don&apos;t disclose a figure.
                </p>
                <SortableTable
                  storageKey="table:roundtrips"
                  columns={[
                    { label: "Pair" },
                    { label: "One way", align: "left" },
                    { label: "Back", align: "left" },
                    { label: "Known $", firstDir: "desc" },
                  ]}
                  rows={d.network.roundTrips.map((rt) => {
                    const name = (id: string) => d.network!.nodes.find((n) => n.id === id)?.name ?? id;
                    const kinds = (es: { type: string }[]) =>
                      [...new Set(es.map((e) => DEAL_TYPES.find((t) => t.type === e.type)?.label.split(" ")[0]))].join(", ");
                    return {
                      key: `${rt.a}-${rt.b}`,
                      sort: [`${name(rt.a)} ⇄ ${name(rt.b)}`, kinds(rt.aToB), kinds(rt.bToA), rt.knownB || null],
                      cells: [
                        <span className="sym">
                          {name(rt.a)} ⇄ {name(rt.b)}
                        </span>,
                        <span className="muted">{kinds(rt.aToB)}</span>,
                        <span className="muted">{kinds(rt.bToA)}</span>,
                        rt.knownB ? `$${rt.knownB.toFixed(0)}B` : "—",
                      ],
                    };
                  })}
                />
              </div>
              <div className="card">
                <h3>Values and exposure</h3>
                <p className="sub">Value = price × shares outstanding (SEC filings), or last private round. Exposure = disclosed deal dollars ÷ value.</p>
                <SortableTable
                  storageKey="table:values"
                  columns={[
                    { label: "Company" },
                    { label: "Value", firstDir: "desc" },
                    { label: "Basis" },
                    { label: "As of", firstDir: "desc" },
                    { label: "Deals", title: "Disclosed deal dollars in and out", firstDir: "desc" },
                    { label: "Exposure", title: "Deal dollars ÷ value", firstDir: "desc" },
                  ]}
                  rows={[...d.network.nodes]
                    .sort((a, b) => (b.exposure ?? -1) - (a.exposure ?? -1))
                    .map((n) => ({
                      key: n.id,
                      sort: [n.name, n.valueB, n.basis, n.asOf, n.dealsB || null, n.exposure],
                      cells: [
                        <span className="sym">{n.name}</span>,
                        n.valueB == null ? "—" : n.valueB >= 1000 ? `$${(n.valueB / 1000).toFixed(2)}T` : `$${n.valueB.toFixed(0)}B`,
                        <span className="muted">
                          {n.source ? (
                            <a href={n.source} target="_blank" rel="noopener noreferrer">
                              {n.basis === "market" ? "market" : n.basis === "private" ? "private round" : "n/a"}
                            </a>
                          ) : n.basis === "unknown" ? (
                            "undisclosed"
                          ) : (
                            n.basis
                          )}
                        </span>,
                        <span className="faint">{n.asOf ?? "—"}</span>,
                        n.dealsB ? `$${n.dealsB.toFixed(0)}B` : "—",
                        <strong>{n.exposure != null ? `${n.exposure.toFixed(2)}×` : "—"}</strong>,
                      ],
                    }))}
                />
              </div>
            </div>
            <details className="card" style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>All {d.network.edges.length} deals, newest first</summary>
              <SortableTable
                storageKey="table:deals"
                scrollStyle={{ marginTop: 10 }}
                columns={[
                  { label: "Date", firstDir: "desc" },
                  { label: "Payer → recipient", align: "left" },
                  { label: "Type", align: "left" },
                  { label: "Amount", firstDir: "desc" },
                  { label: "Deal", align: "left", className: "wrap-cell" },
                  { label: "Status", align: "left" },
                ]}
                rows={[...d.network.edges]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((e) => {
                    const name = (id: string) => d.network!.nodes.find((n) => n.id === id)?.name ?? id;
                    const type = DEAL_TYPES.find((t) => t.type === e.type)?.label ?? e.type;
                    return {
                      key: `${e.from}-${e.to}-${e.type}-${e.date}`,
                      sort: [e.date, `${name(e.from)} → ${name(e.to)}`, type, e.amountB, e.label, e.status],
                      cells: [
                        <span className="faint">{e.date}</span>,
                        <span className="sym">
                          {name(e.from)} → {name(e.to)}
                        </span>,
                        <span className="muted">{type}</span>,
                        e.amountB != null ? `$${e.amountB}B` : "—",
                        <>
                          {e.label}{" "}
                          <a href={e.source} target="_blank" rel="noopener noreferrer">
                            ↗
                          </a>
                        </>,
                        <span className="muted">{e.status === "loi" ? "LOI" : e.status}</span>,
                      ],
                    };
                  })}
              />
            </details>
          </>
        ) : (
          <div className="empty">The deal network couldn&apos;t be built on this refresh.</div>
        )}
      </section>

      <section id="spv">
        <h2>SPV tracker</h2>
        <p className="blurb">
          Special purpose vehicles hold data centers or GPUs and carry the debt that paid for them, so it stays off the
          tenant&apos;s balance sheet. Losses land on the lenders, not Big Tech. Vehicles are curated from filings and press
          reports and reviewed weekly (last {d.spv.updated}); tenant obligations come from SEC filings automatically.
        </p>
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Key terms</h3>
          <dl className="explain glossary">
            <dt>SPV</dt>
            <dd>
              Special purpose vehicle: a separate company set up to own one asset (a data center campus or a pool of GPUs)
              and borrow against it. The tech company leases the asset instead of owning it, so the debt sits in the SPV.
            </dd>
            <dt>Residual value guarantee</dt>
            <dd>
              A promise by the tenant to pay the SPV if the asset is worth less than the debt when a lease ends or
              isn&apos;t renewed. It&apos;s what lets the SPV borrow at the tenant&apos;s credit rating, and it caps what the
              tenant owes if it walks away.
            </dd>
            <dt>DDTL</dt>
            <dd>
              Delayed-draw term loan: a loan drawn in stages as GPUs are bought, secured by the GPUs and the customer
              contracts they serve. CoreWeave numbers its vehicles (DDTL 4.0, 5.0, …).
            </dd>
            <dt>Cents on the dollar</dt>
            <dd>
              The price of a loan or bond in secondary trading. 100 is par (full value); 90 means buyers want a 10%
              discount because they doubt full repayment.
            </dd>
            <dt>Purchase obligations</dt>
            <dd>
              Contracts a company has signed but not yet recorded as liabilities, such as future lease payments and
              capacity commitments. This is where SPV deals show up in the tenant&apos;s own filings.
            </dd>
          </dl>
        </div>

        <div className="grid g2">
          <div className="card">
            <h3>Debt in tracked vehicles</h3>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "4px 0 10px" }}>
              <div>
                <div className="big">${d.spv.totalDebtB.toFixed(0)}B</div>
                <p className="sub" style={{ margin: 0 }}>{d.spv.spvs.length} vehicles</p>
              </div>
              {d.spv.byType.map((t) => (
                <div key={t.type}>
                  <div className="big" style={{ fontSize: 20 }}>${t.debtB.toFixed(0)}B</div>
                  <p className="sub" style={{ margin: 0 }}>
                    {t.type} · {t.count}
                  </p>
                </div>
              ))}
              {d.spv.worstPrice && (
                <div>
                  <div className="big" style={{ fontSize: 20, color: stressColor(toScore(d.spv.worstPrice.price, 98, 80)) }}>
                    {d.spv.worstPrice.price}¢
                  </div>
                  <p className="sub" style={{ margin: 0 }}>weakest loan price · {d.spv.worstPrice.spv}</p>
                </div>
              )}
            </div>
            <h3 style={{ marginTop: 6 }}>By tenant (who pays the lease)</h3>
            <HBarChart rows={d.spv.byTenant.map((t) => ({ label: t.tenant, value: +t.debtB.toFixed(1) }))} format="usdB" />
            <Explain id="spvDebt" />
          </div>
          <div className="card">
            <h3>Who funds them</h3>
            <p className="sub">Lenders and equity holders, with the debt in vehicles they&apos;re part of</p>
            <SortableTable
              storageKey="table:spv-providers"
              columns={[
                { label: "Provider" },
                { label: "Role", align: "left" },
                { label: "Vehicles", firstDir: "desc" },
                { label: "Debt in vehicles", title: "Total debt of the vehicles this provider is part of (not its own share)", firstDir: "desc" },
                { label: "Off high", title: "Stock distance below its 52-week high, for public providers", firstDir: "asc" },
              ]}
              rows={d.spv.providers.map((p) => ({
                key: p.name,
                sort: [p.name, p.role, p.vehicles, p.debtInVehiclesB, p.drawdown],
                cells: [
                  <>
                    <span className="sym">{p.name}</span>
                    {p.ticker && <span className="name">{p.ticker}</span>}
                  </>,
                  <span className="muted">{p.role}</span>,
                  p.vehicles,
                  `$${p.debtInVehiclesB.toFixed(1)}B`,
                  p.drawdown != null ? (
                    <span style={{ color: p.drawdown > -3 ? "var(--muted)" : stressColor(toScore(p.drawdown, -3, -40)) }}>
                      {p.drawdown.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="faint">—</span>
                  ),
                ],
              }))}
            />
            <Explain id="spvProviders" />
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>Vehicles</h3>
          <SortableTable
            storageKey="table:spvs"
            columns={[
              { label: "Vehicle", className: "wrap-cell" },
              { label: "Type", align: "left" },
              { label: "Tenant", align: "left" },
              { label: "Debt", firstDir: "desc" },
              { label: "Equity", firstDir: "desc" },
              { label: "Funded by", align: "left", className: "wrap-cell" },
              { label: "Rating", align: "left" },
              { label: "Loan price", title: "Latest reported secondary price, cents on the dollar", firstDir: "asc" },
              { label: "Status", align: "left" },
              { label: "Date", firstDir: "desc" },
            ]}
            rows={d.spv.spvs.map((v) => ({
              key: v.id,
              title: v.terms,
              sort: [v.name, v.type, v.tenants.join(", "), v.debtB, v.equityB, [...v.equity.map((e) => e.name), ...v.lenders].join(", "), v.rating, v.stress?.price ?? null, v.status, v.date],
              cells: [
                <>
                  <a href={v.source} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                    {v.name}
                  </a>
                  <div className="faint" style={{ fontSize: 11 }}>{v.project}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{v.terms}</div>
                </>,
                <span className="muted">{v.type === "gpu" ? "GPU-backed" : "Data center"}</span>,
                v.tenants.join(", "),
                v.debtB != null ? `$${v.debtB}B` : "—",
                v.equityB != null ? `$${v.equityB}B` : "—",
                <span className="muted">
                  {v.equity.length > 0 && <>Equity: {v.equity.map((e) => (e.share ? `${e.name} ${Math.round(e.share * 100)}%` : e.name)).join(", ")}<br /></>}
                  {v.lenders.length > 0 && <>Debt: {v.lenders.join(", ")}</>}
                </span>,
                <span className="muted">{v.rating ?? "—"}</span>,
                v.stress ? (
                  <a href={v.stress.source} target="_blank" rel="noopener noreferrer" title={`${v.stress.note} (${v.stress.asOf})`}>
                    <strong style={{ color: stressColor(toScore(v.stress.price, 98, 80)) }}>{v.stress.price}¢</strong>
                  </a>
                ) : (
                  <span className="faint">—</span>
                ),
                <span className="muted">{v.status}</span>,
                <span className="faint">{v.date ?? "—"}</span>,
              ],
            }))}
          />
          <Explain id="spvTable" />
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Timeline of SPV events</summary>
            <ul className="news" style={{ marginTop: 6 }}>
              {d.spv.spvs
                .flatMap((v) => v.events.map((e) => ({ ...e, spv: v.name })))
                .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                .map((e, i) => (
                  <li key={i}>
                    <strong>{e.spv}</strong> · {e.text}{" "}
                    <a href={e.source} target="_blank" rel="noopener noreferrer">
                      ↗
                    </a>
                    <div className="meta">{e.date ?? "date not reported"}</div>
                  </li>
                ))}
            </ul>
          </details>
        </div>

        <div className="grid g2" style={{ marginTop: 14 }}>
          <div className="card">
            <h3>Tenant commitments vs. reported debt</h3>
            <p className="sub">Future lease payments + unrecorded purchase obligations, from 10-Q/10-K filings</p>
            {d.offBalance.length ? (
              <SortableTable
                storageKey="table:offbalance"
                columns={[
                  { label: "Company" },
                  { label: "Op. leases", firstDir: "desc" },
                  { label: "Fin. leases", firstDir: "desc" },
                  { label: "Purchase oblig.", firstDir: "desc" },
                  { label: "Debt", firstDir: "desc" },
                  { label: "Commit ÷ debt", firstDir: "desc" },
                ]}
                rows={d.offBalance.map((o) => {
                  const f = (v: number | null) => (v != null ? `$${v.toFixed(0)}B` : "—");
                  return {
                    key: o.symbol,
                    sort: [o.symbol, o.operatingLeasesB, o.financeLeasesB, o.purchaseObligationsB, o.debtB, o.ratio],
                    cells: [
                      <>
                        <span className="sym">{o.symbol}</span>
                        <span className="name">{o.periodEnd}</span>
                      </>,
                      f(o.operatingLeasesB),
                      f(o.financeLeasesB),
                      f(o.purchaseObligationsB),
                      f(o.debtB),
                      <strong>{o.ratio != null ? `${o.ratio.toFixed(1)}×` : "—"}</strong>,
                    ],
                  };
                })}
              />
            ) : (
              <div className="empty">SEC filings data is unavailable today.</div>
            )}
            <Explain id="offBalance" />
          </div>
          <div className="card">
            <h3>Commitments over time</h3>
            <p className="sub">Leases + purchase obligations, $B, by calendar quarter</p>
            {d.offBalance.length ? (
              <MultiSeriesChart
                rows={quarterRows(d.offBalance.map((o) => ({ key: o.symbol, points: o.series.map((p) => ({ end: p.end, value: +p.totalB.toFixed(1) })) })))}
                keys={d.offBalance.map((o) => o.symbol)}
                format="usdB"
                storageKey="multi:offbalance"
              />
            ) : (
              <div className="empty">SEC filings data is unavailable today.</div>
            )}
            <Explain id="offBalanceTrend" />
          </div>
        </div>
      </section>

      <section id="software">
        <h2>Software &amp; private credit</h2>
        <p className="blurb">
          The bridge between the AI trade and the credit trade. AI agents threaten seat-based software; private-equity
          firms bought hundreds of software companies with private-credit loans, mostly in 2021–2023; those loans sit
          inside BDCs and non-traded funds. The chain to watch: AI hits SaaS → software loans get marked down → fund
          investors redeem → less private credit for AI data centers.
        </p>
        <div className="grid g2">
          <div className="card">
            <h3>Key facts</h3>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "4px 0 10px" }}>
              <div>
                <div className="big">$500B+</div>
                <p className="sub" style={{ margin: 0 }}>private-credit loans to SaaS, end-2025 (≈$8B in 2015)</p>
              </div>
              <div>
                <div className="big" style={{ fontSize: 20 }}>19%</div>
                <p className="sub" style={{ margin: 0 }}>of all direct loans</p>
              </div>
              <div>
                <div className="big" style={{ fontSize: 20 }}>~32%</div>
                <p className="sub" style={{ margin: 0 }}>of BDC investments, Q1 2026</p>
              </div>
              <div>
                <div className="big" style={{ fontSize: 20 }}>35%</div>
                <p className="sub" style={{ margin: 0 }}>of BDC software principal matures 2028–29</p>
              </div>
            </div>
            <ul className="facts">
              <li>
                Software stocks fell almost 30% from October 2025 to February 2026 (the &ldquo;SaaSpocalypse&rdquo;); BDC
                stocks fell about 10%, and BDCs with more software lagged peers by about 5 points.{" "}
                <a href="https://www.bis.org/publ/qtrpdf/r_qt2603v.htm" target="_blank" rel="noreferrer">BIS, Mar 2026</a>
              </li>
              <li>
                BDCs have lent about $115B to software firms: about a fifth of their lending and over 80% of their tech
                book.{" "}
                <a href="https://www.bis.org/publications/bulletin-128-ai-disruption-private-credit-exposure-software-firms-bdcs" target="_blank" rel="noreferrer">
                  BIS Bulletin 128, Jul 2026
                </a>
              </li>
              <li>
                Across 175 BDC portfolios, software was about 32% of investments at March 31, 2026, and 35% of software
                principal comes due in 2028–29: a refinancing wall if lenders pull back.{" "}
                <a href="https://octus.com/resources/articles/private-credit-software-exposure-hits-32-q126-bdc-analysis/" target="_blank" rel="noreferrer">
                  Octus, Jul 2026
                </a>
              </li>
              <li>
                Default risk on listed software companies roughly doubled between December 2025 and June 2026.{" "}
                <a href="https://www.kamakuraco.com/?p=19255" target="_blank" rel="noreferrer">Kamakura, Jul 2026</a>
              </li>
            </ul>
            <p className="sub" style={{ marginTop: 8 }}>
              Estimates differ by method: BIS counts SaaS firms (15–20% of BDC loans), Octus a broader software
              definition (32%).
            </p>
            <h3 style={{ marginTop: 12 }}>Most exposed vs. more resilient</h3>
            <dl className="explain glossary">
              <dt>Exposed</dt>
              <dd>
                Per-seat pricing (AI-driven layoffs mean fewer seats); commoditized dashboard-style tools AI can replace;
                labor-heavy services revenue; weak pricing power; stretched balance sheets from 2021–23 buyouts.
              </dd>
              <dt>Resilient</dt>
              <dd>
                Systems of record that are data-rich and deeply embedded: payroll, compliance, core finance, and regulated
                verticals like healthcare and financial services with high switching costs.{" "}
                <a href="https://alternativecreditinvestor.com/2026/07/06/managers-hunt-for-software-winners-and-losers-amid-ai-panic/" target="_blank" rel="noreferrer">
                  Alternative Credit Investor
                </a>
              </dd>
            </dl>
            <Explain id="softwareFacts" />
          </div>
          <div className="card">
            <h3>BDC software exposure vs. price / NAV</h3>
            <p className="sub">
              Software share of each BDC&apos;s portfolio at fair value, from its latest quarterly report
              {softwareAsOf && ` (quarter ended ${softwareAsOf})`}; reviewed weekly, last {softwareData.updated}
              {softwareCompare && (
                <>
                  {" "}· median P/NAV: software-heavy <strong>{softwareCompare.heavy.toFixed(2)}x</strong> vs. lighter{" "}
                  <strong>{softwareCompare.light.toFixed(2)}x</strong>
                </>
              )}
            </p>
            {softwareRows.length ? (
              <>
                <HBarChart
                  rows={[...softwareRows].sort((a, b) => b.pct - a.pct).map((r) => ({ label: r.symbol, value: r.pct }))}
                  format="pct"
                  toneFor="softwareShare"
                />
                <SortableTable
                  storageKey="table:bdcSoftware"
                  scrollStyle={{ marginTop: 8 }}
                  columns={[
                    { label: "BDC" },
                    { label: "Software", title: "Software share of the portfolio at fair value", firstDir: "desc" },
                    { label: "P/NAV", title: "Price ÷ NAV", firstDir: "asc" },
                    { label: "3M", firstDir: "desc" },
                    { label: "Source" },
                  ]}
                  rows={softwareRows.map((r) => ({
                    key: r.symbol,
                    sort: [r.symbol, r.pct, r.pnav, d.quotes[r.symbol]?.chg3m ?? null, r.label],
                    cells: [
                      <>
                        <span className="sym">{r.symbol}</span>
                        <span className="name">{r.name}</span>
                      </>,
                      <strong style={{ color: stressColor(toScore(r.pct, 10, 35)) }}>{r.pct.toFixed(1)}%</strong>,
                      r.pnav != null ? `${r.pnav.toFixed(2)}x` : "—",
                      <Pct v={d.quotes[r.symbol]?.chg3m} />,
                      <a href={r.source} target="_blank" rel="noreferrer" title={`${r.label}, as of ${r.asOf}. ${r.note ?? ""}`}>
                        10-Q
                      </a>,
                    ],
                  }))}
                />
              </>
            ) : (
              <div className="empty">No exposure data yet.</div>
            )}
            <Explain id="softwareBdc" />
          </div>
        </div>
        <div className="grid g2" style={{ marginTop: 14 }}>
          <div className="card">
            <h3>Public software vs S&amp;P 500 (dashed)</h3>
            {softwareSeries.length ? (
              <RelativeChart series={softwareSeries} storageKey="rel:software" />
            ) : (
              <div className="empty">Unavailable today.</div>
            )}
            <Explain id="software" />
          </div>
          <div className="card">
            <h3>Scoreboard</h3>
            <p className="sub">Adjusted closes · IGV is the sector ETF</p>
            <QuoteTable quotes={SOFTWARE_GROUP.tickers.map((t) => d.quotes[t.symbol]).filter(Boolean)} storageKey="table:score:software" />
            <Explain id="scoreboard" />
          </div>
        </div>
      </section>

      <section id="bdcs">
        <h2>BDCs & private-credit redemptions</h2>
        <p className="blurb">
          Private-credit marks are self-reported and lag. Public BDCs trading at a widening discount to NAV, and non-traded
          funds facing tender requests above their 5% quarterly cap, are where the market forces a real price.
        </p>
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Key terms</h3>
          <dl className="explain glossary">
            <dt>BDC</dt>
            <dd>
              Business development company: a US fund that lends to mid-sized private companies and trades on the stock
              exchange like a stock (Ares Capital, Blue Owl Capital Corp). It must pay out most of its income as dividends.
              Public BDCs are the only private-credit funds with a market price every day.
            </dd>
            <dt>NAV</dt>
            <dd>
              Net asset value per share: what the fund says its loans and other assets are worth, minus its debts, divided
              by its shares. Reported each quarter in its 10-Q/10-K. The fund values its own loans, so NAV can lag reality.
            </dd>
            <dt>Price / NAV</dt>
            <dd>
              Share price ÷ NAV. 1.0x means the market agrees with the fund&apos;s valuation; 0.85x means investors think the
              loans are worth about 15% less than the fund says. Main Street (MAIN) and Hercules (HTGC) usually trade above
              1.0x because they&apos;re internally managed with long track records, which is why the dashboard uses the median.
            </dd>
            <dt>Non-traded fund</dt>
            <dd>
              The same kind of lending fund sold to wealthy individuals without a stock listing (e.g. Blackstone Private
              Credit Fund, Blue Owl Credit Income). There&apos;s no market price; investors can only exit through the
              fund&apos;s periodic buybacks.
            </dd>
            <dt>Tender offer</dt>
            <dd>
              The SEC filing (SC TO-I) a non-traded fund makes when it offers to buy back shares: its redemption window.
            </dd>
            <dt>Gate</dt>
            <dd>
              When redemption requests exceed the cap (usually 5% of shares per quarter) and the fund pays out only part,
              pro rata. Repeated gating is the classic sign of private-credit stress.
            </dd>
          </dl>
        </div>
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
            <SortableTable
              storageKey="table:bdcs"
              scrollStyle={{ marginTop: 8 }}
              columns={[
                { label: "BDC" },
                { label: "Price", firstDir: "desc" },
                { label: "NAV", title: "Net asset value per share, from the latest 10-Q/10-K", firstDir: "desc" },
                { label: "P/NAV", title: "Price ÷ NAV", firstDir: "asc" },
                { label: "NAV as of", firstDir: "desc" },
                { label: "3M", firstDir: "desc" },
              ]}
              rows={d.bdcs.map((b) => ({
                key: b.symbol,
                sort: [b.symbol, b.price, b.nav, b.priceToNav, b.navAsOf, d.quotes[b.symbol]?.chg3m ?? null],
                cells: [
                  <>
                    <span className="sym">{b.symbol}</span>
                    <span className="name">{b.name}</span>
                  </>,
                  b.price?.toFixed(2) ?? "—",
                  b.nav?.toFixed(2) ?? "—",
                  <strong>{b.priceToNav != null ? `${b.priceToNav.toFixed(2)}x` : "—"}</strong>,
                  <span className="faint">{b.navAsOf ?? "—"}</span>,
                  <Pct v={d.quotes[b.symbol]?.chg3m} />,
                ],
              }))}
            />
            <Explain id="bdcPnav" />
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
            <Explain id="tenders" />
          </div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <h3>BDC prices vs S&P 500</h3>
          <RelativeChart
            series={[...d.bdcs.map((b) => d.quotes[b.symbol]), d.quotes.SPY].filter(Boolean).map(trim)}
            storageKey="rel:bdcs"
          />
          <Explain id="bdcPrices" />
        </div>
      </section>

      <section id="gpu">
        <h2>GPU rental market</h2>
        <p className="blurb">
          GPU rental rates are the collateral value behind GPU-backed SPVs and neocloud loans. If intelligence gets cheap, who
          earns a return on $50B clusters? Three live sources (a spot marketplace and two list-price clouds) plus a weekly
          market median across about 90 providers, with history.
        </p>

        <div className="card">
          <h3>Price by source, $/GPU-hour</h3>
          <p className="sub">
            Market = weekly median across providers (week of {gpuLatestWeek ?? "—"}). Vast.ai is a spot marketplace; RunPod and
            Lambda are list prices.
          </p>
          <SortableTable
            storageKey="table:gpu-sources"
            columns={[
              { label: "GPU" },
              { label: "Market", title: "Weekly median on-demand price across providers (GetDeploying)", firstDir: "desc" },
              { label: "1y", title: "Change in the market median over 52 weeks", firstDir: "desc" },
              { label: "12-mo reserved", title: "Weekly median 12-month reservation price", firstDir: "desc" },
              { label: "Market spot", title: "Weekly median spot/interruptible price", firstDir: "desc" },
              { label: "Vast.ai", title: "Median on-demand offer on the Vast.ai marketplace today", firstDir: "desc" },
              { label: "RunPod", title: "RunPod secure cloud list price", firstDir: "desc" },
              { label: "RunPod comm.", title: "RunPod community cloud list price", firstDir: "desc" },
              { label: "Lambda", title: "Lambda on-demand list price (lowest per-GPU across instance sizes)", firstDir: "desc" },
              { label: "Providers", title: "Providers in this week's market median", firstDir: "desc" },
            ]}
            rows={GPU_ROWS.map((g) => {
              const m = gpuMarket[g.slug ?? ""];
              const vast = d.gpu.find((x) => x.model === g.model)?.median ?? null;
              const rp = d.runpod?.[g.model];
              const lb = d.lambda?.[g.model]?.onDemand ?? null;
              const usd = (v: number | null | undefined) => (v != null ? `$${v.toFixed(2)}` : "—");
              return {
                key: g.model,
                sort: [g.label, m?.onDemand ?? null, m?.yoy ?? null, m?.reserved12 ?? null, m?.spot ?? null, vast, rp?.onDemand ?? null, rp?.community ?? null, lb, m?.providers ?? null],
                cells: [
                  <span className="sym">{g.label}</span>,
                  <strong>{usd(m?.onDemand)}</strong>,
                  <Pct v={m?.yoy} digits={0} />,
                  usd(m?.reserved12),
                  usd(m?.spot),
                  usd(vast),
                  usd(rp?.onDemand),
                  usd(rp?.community),
                  usd(lb),
                  <span className="muted">{m?.providers ?? "—"}</span>,
                ],
              };
            })}
          />
          <Explain id="gpuSources" />
        </div>

        <div className="grid g2" style={{ marginTop: 14 }}>
          <div className="card">
            <h3>Market median on-demand, weekly</h3>
            <p className="sub">Across about 90 cloud providers · $/GPU-hour</p>
            {gpuTrendRows.length ? (
              <TimeLinesChart rows={gpuTrendRows} keys={["B200", "H200", "H100", "A100"]} storageKey="gpu:market" />
            ) : (
              <div className="empty">Market history is unavailable today.</div>
            )}
            <Explain id="gpuMarket" />
          </div>
          <div className="card">
            <h3>H100: on-demand vs. spot vs. 12-month reserved</h3>
            <p className="sub">Weekly medians · $/GPU-hour</p>
            {h100Rows.length ? (
              <TimeLinesChart rows={h100Rows} keys={["On-demand", "12-month reserved", "Spot"]} storageKey="gpu:h100" />
            ) : (
              <div className="empty">Market history is unavailable today.</div>
            )}
            <Explain id="gpuH100" />
          </div>
        </div>

        <details className="card" style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Vast.ai marketplace detail</summary>
          <div className="grid g2" style={{ marginTop: 10 }}>
            <div>
              {d.gpu.length ? (
                <HBarChart rows={d.gpu.map((g) => ({ label: g.model, value: +g.median.toFixed(2) }))} format="usd" />
              ) : (
                <div className="empty">Unavailable today.</div>
              )}
            </div>
            <div>
              <SortableTable
                storageKey="table:gpu"
                columns={[
                  { label: "GPU" },
                  { label: "25th pct", firstDir: "desc" },
                  { label: "Median", firstDir: "desc" },
                  { label: "75th pct", firstDir: "desc" },
                  { label: "Offers", firstDir: "desc" },
                ]}
                rows={d.gpu.map((g) => ({
                  key: g.model,
                  sort: [g.model, g.p25, g.median, g.p75, g.offers],
                  cells: [
                    <span className="sym">{g.model}</span>,
                    `$${g.p25.toFixed(2)}`,
                    <strong>${g.median.toFixed(2)}</strong>,
                    `$${g.p75.toFixed(2)}`,
                    <span className="muted">{g.offers}</span>,
                  ],
                }))}
              />
              {historyRows.length >= 2 && (
                <>
                  <h3 style={{ marginTop: 16 }}>Vast.ai H100, daily snapshots</h3>
                  <HistoryChart rows={historyRows} keys={[{ key: "h100", label: "H100 $/hr", color: "var(--s1)", axis: "left" }]} />
                </>
              )}
            </div>
          </div>
        </details>
        <p className="note">
          Weekly market data: <a href="https://getdeploying.com/dataset/gpu-prices" target="_blank" rel="noopener noreferrer">GetDeploying GPU rental price history</a> (CC BY 4.0). The free files cover 53 trailing weeks; this dashboard archives each week so the history keeps growing.
        </p>
      </section>

      <section id="intel">
        <h2>Cost of intelligence</h2>
        <p className="blurb">
          Step 2 of the scenario: an open-weight model matches the frontier at a fraction of the price, and it sticks. If
          intelligence gets cheap, who earns a return on $50B GPU clusters? Capability scores from Epoch AI&apos;s
          independent evaluations; prices from OpenRouter; adoption from the Census Bureau.
        </p>

        <div className="grid g2">
          <div className="card">
            <h3>Open-weight vs. frontier capability</h3>
            {d.intel.gap ? (
              <>
                <p className="sub">
                  Best closed: <strong>{d.intel.gap.bestClosed.model}</strong> {d.intel.gap.bestClosed.eci.toFixed(1)} · best
                  open: <strong>{d.intel.gap.bestOpen.model}</strong> {d.intel.gap.bestOpen.eci.toFixed(1)} · gap{" "}
                  <strong>{d.intel.gap.gap.toFixed(1)}</strong>
                  {d.intel.gap.gapYearAgo != null && ` (a year ago ${d.intel.gap.gapYearAgo.toFixed(1)})`}
                  {d.intel.gap.lagMonths != null && ` · open models ~${d.intel.gap.lagMonths} months behind`}
                </p>
                <TimeLinesChart
                  rows={gapRows}
                  keys={["Best closed model", "Best open-weight model"]}
                  unit="pts"
                  dateLabel="Month of"
                  ranges={["1Y", "2Y", "5Y"]}
                  defaultRange="5Y"
                  storageKey="intel:gap"
                />
              </>
            ) : (
              <div className="empty">Epoch capability data is unavailable today.</div>
            )}
            <Explain id="openGap" />
          </div>

          <div className="card">
            <h3>What near-frontier intelligence costs</h3>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "4px 0 10px" }}>
              <div>
                <div className="big">{usd2(d.intel.frontierBlended)}</div>
                <p className="sub" style={{ margin: 0 }}>per M tokens, top closed model</p>
              </div>
              {d.intel.cheapestNearFrontier && (
                <div>
                  <div className="big" style={{ color: "var(--up)" }}>{usd2(d.intel.cheapestNearFrontier.blended)}</div>
                  <p className="sub" style={{ margin: 0 }}>
                    cheapest within 10 pts: {d.intel.cheapestNearFrontier.model}
                    {d.intel.cheapestNearFrontier.open ? " (open)" : ""}
                  </p>
                </div>
              )}
              {d.intel.frontierBlended && d.intel.cheapestNearFrontier && (
                <div>
                  <div className="big">{(d.intel.frontierBlended / d.intel.cheapestNearFrontier.blended).toFixed(0)}×</div>
                  <p className="sub" style={{ margin: 0 }}>price ratio</p>
                </div>
              )}
            </div>
            <h3 style={{ marginTop: 8 }}>Recent API price changes</h3>
            {priceChanges.length ? (
              <ul className="news">
                {priceChanges.slice(0, 8).map((c) => (
                  <li key={c.id + c.date}>
                    <strong>{c.id}</strong> · {usd2(c.from)} → {usd2(c.to)} per M tokens{" "}
                    <Pct v={c.change} digits={0} />
                    <div className="meta">{c.date}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sub">
                {priceLogStart
                  ? `Tracking daily prices of the top 40 models since ${priceLogStart}. No changes yet.`
                  : "Daily price tracking starts with the next refresh; cuts will be listed here as they happen."}
              </p>
            )}
            <Explain id="priceCuts" />
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>Price vs. capability, top models</h3>
          <p className="sub">Blended price assumes 3 input tokens per output token · $ per million tokens</p>
          {d.intel.priced.length ? (
            <SortableTable
              storageKey="table:intel"
              columns={[
                { label: "Model" },
                { label: "Organization", align: "left" },
                { label: "Weights", align: "left" },
                { label: "ECI", title: "Epoch Capabilities Index", firstDir: "desc" },
                { label: "Released", firstDir: "desc" },
                { label: "Input", firstDir: "asc" },
                { label: "Output", firstDir: "asc" },
                { label: "Blended", firstDir: "asc" },
                { label: "ECI per $", title: "ECI points per blended $ per million tokens", firstDir: "desc" },
              ]}
              rows={d.intel.priced.slice(0, 30).map((m) => ({
                key: m.apiId,
                sort: [m.model, m.org, m.open ? "open" : "closed", m.eci, m.date, m.inPerM, m.outPerM, m.blended, m.eci / m.blended],
                cells: [
                  <span className="sym">{m.model}</span>,
                  <span className="muted">{m.org}</span>,
                  <span className={m.open ? "up" : "muted"}>{m.open ? "Open" : "Closed"}</span>,
                  <strong>{m.eci.toFixed(1)}</strong>,
                  <span className="faint">{m.date}</span>,
                  usd2(m.inPerM),
                  usd2(m.outPerM),
                  <strong>{usd2(m.blended)}</strong>,
                  (m.eci / m.blended).toFixed(0),
                ],
              }))}
            />
          ) : (
            <div className="empty">Price or capability data is unavailable today.</div>
          )}
          <Explain id="apiPrices" />
        </div>

        <div className="grid g3" style={{ marginTop: 14 }}>
          <div className="card">
            <h3>US businesses using AI</h3>
            <p className="sub">
              {d.intel.adoption ? (
                <>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>
                    {d.intel.adoption.using[d.intel.adoption.using.length - 1].v.toFixed(1)}%
                  </span>{" "}
                  · two weeks to {d.intel.adoption.using[d.intel.adoption.using.length - 1].t}
                </>
              ) : (
                "Unavailable today"
              )}
            </p>
            {adoptionRows.length > 0 && (
              <TimeLinesChart
                rows={adoptionRows}
                keys={["Using AI now", "Expect to in 6 months"]}
                unit="%"
                dateLabel="Two weeks to"
                ranges={["1Y", "2Y", "5Y"]}
                defaultRange="5Y"
                storageKey="intel:btos"
              />
            )}
            <p className="note">
              <a href="https://www.census.gov/hfp/btos/data_downloads" target="_blank" rel="noopener noreferrer">
                Census Business Trends and Outlook Survey ↗
              </a>
            </p>
            <Explain id="btos" />
          </div>
          {fredGroup("energy").map((s) => (
            <FredCard key={s.id} s={s} data={d.fred[s.id]} />
          ))}
        </div>
        <p className="note">
          On-premises adoption has no public time series; the <a href="#onprem">On-prem AI infrastructure</a> section tracks
          the server and storage vendors that sell into it.
        </p>
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
            {breadth.length ? <SeriesChart points={breadth} decimals={3} storageKey="series:breadth" /> : <div className="empty">Unavailable today.</div>}
            <Explain id="breadth" />
          </div>
          {fredGroup("fed").map((s) => (
            <FredCard key={s.id} s={s} data={d.fred[s.id]} />
          ))}
        </div>
      </section>

      <section id="gdp">
        <h2>The AI buildout in GDP</h2>
        <p className="blurb">
          Step 6 of the scenario says data-center construction has carried a large share of recent GDP growth. These are the
          national-accounts lines that would show the buildout and its reversal, with history back to the dot-com era for
          comparison.
        </p>
        <div className="grid g3">
          <div className="card">
            <h3>IT investment as a share of GDP</h3>
            <p className="sub">
              {itShare.length ? (
                <>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>{itShare[itShare.length - 1].v.toFixed(2)}%</span> ·{" "}
                  {itShare[itShare.length - 1].t} · dot-com peak{" "}
                  {Math.max(...itShare.filter((p) => p.t >= "1998" && p.t <= "2002").map((p) => p.v)).toFixed(2)}%
                </>
              ) : (
                "Unavailable today"
              )}
            </p>
            {itShare.length > 0 && (
              <SeriesChart points={itShare} unit="%" storageKey="series:itshare" ranges={["5Y", "10Y", "25Y", "All"]} defaultRange="All" />
            )}
            <Explain id="itShare" />
          </div>
          <div className="card">
            <h3>Data center construction (monthly)</h3>
            <p className="sub">
              {d.dcConstruction ? (
                <>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>
                    ${d.dcConstruction[d.dcConstruction.length - 1].v.toFixed(2)}B
                  </span>{" "}
                  · {d.dcConstruction[d.dcConstruction.length - 1].t.slice(0, 7)} · inflation-adjusted
                </>
              ) : (
                "Unavailable today"
              )}
            </p>
            {d.dcConstruction && (
              <SeriesChart points={d.dcConstruction} storageKey="series:dc" ranges={["2Y", "5Y", "10Y", "All"]} defaultRange="All" />
            )}
            <p className="note">
              <a href="https://ourworldindata.org/grapher/monthly-spending-data-center-us" target="_blank" rel="noopener noreferrer">
                Census via Our World in Data ↗
              </a>
            </p>
            <Explain id="dcConstruction" />
          </div>
          {fredGroup("gdp").map((s) => (
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
              {g.data ? (
                <TrendsChart
                  keywords={g.data.keywords}
                  points={g.data.points}
                  ranges={g.data.time === "today 12-m" ? ["3M", "6M", "1Y"] : ["1Y", "2Y", "5Y"]}
                  storageKey={`trends:${g.id}`}
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
              <Explain id={`trends:${g.id}`} />
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
