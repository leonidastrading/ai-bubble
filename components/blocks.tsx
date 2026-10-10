import type { Filing } from "@/lib/sec";
import type { NewsItem } from "@/lib/news";
import { scoreLabel, type Signal } from "@/lib/signals";
import type { Quote } from "@/lib/yahoo";

export function Pct({ v, digits = 1 }: { v: number | null | undefined; digits?: number }) {
  if (v == null || !Number.isFinite(v)) return <span className="faint">—</span>;
  return (
    <span className={v > 0 ? "up" : v < 0 ? "down" : undefined}>
      {v > 0 ? "+" : ""}
      {v.toFixed(digits)}%
    </span>
  );
}

function toneVar(score: number) {
  return `var(--${scoreLabel(score).tone})`;
}

/** Semicircle gauge for the composite score. */
export function Gauge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const { label, tone } = scoreLabel(s);
  const r = 80;
  const cx = 100;
  const cy = 96;
  const angle = Math.PI * (1 - s / 100);
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    return `M ${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)}`;
  };
  const bands: [number, number, string][] = [
    [0, 25, "calm"],
    [25, 45, "watch"],
    [45, 65, "elevated"],
    [65, 100, "stress"],
  ];
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 200 110" width="100%" style={{ maxWidth: 280 }} role="img" aria-label={`Bubble stress score ${s} of 100, ${label}`}>
        {bands.map(([a, b, t]) => (
          <path key={t} d={arc(a + 0.6, b - 0.6)} stroke={`var(--${t})`} strokeOpacity={0.28} strokeWidth={14} fill="none" />
        ))}
        {score != null && <path d={arc(0.01, Math.max(0.5, s))} stroke={`var(--${tone})`} strokeWidth={14} fill="none" strokeLinecap="round" />}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 22) * Math.cos(angle)}
          y2={cy - (r - 22) * Math.sin(angle)}
          stroke="var(--text)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill="var(--text)" />
      </svg>
      <div className="big" style={{ fontSize: 40, marginTop: -6 }}>
        {score ?? "—"}
        <span className="faint" style={{ fontSize: 16 }}> / 100</span>
      </div>
      <div className={`tone-${tone}`} style={{ fontWeight: 650, fontSize: 15 }}>
        {label}
      </div>
    </div>
  );
}

export function SignalTable({ signals }: { signals: Signal[] }) {
  const sorted = [...signals].sort((a, b) => b.score - a.score);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Signal</th>
            <th style={{ textAlign: "left" }}>Scenario step</th>
            <th>Now</th>
            <th style={{ textAlign: "left" }}>Stress</th>
            <th>Calm → Crisis</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.id} title={s.detail}>
              <td>
                <div style={{ fontWeight: 600 }}>{s.label}</div>
                <div className="faint" style={{ fontSize: 11, whiteSpace: "normal", maxWidth: 320 }}>
                  {s.detail}
                </div>
              </td>
              <td style={{ textAlign: "left" }} className="muted">
                {s.stage}
              </td>
              <td>{s.value}</td>
              <td style={{ textAlign: "left", width: 140 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="bar" style={{ flex: 1 }}>
                    <span style={{ width: `${Math.max(3, s.score)}%`, background: toneVar(s.score) }} />
                  </div>
                  <span style={{ color: toneVar(s.score), width: 24 }}>{s.score}</span>
                </div>
              </td>
              <td className="faint" style={{ fontSize: 11 }}>
                {s.calm} → {s.stress}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtPrice(v: number) {
  return v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2);
}

export function QuoteTable({ quotes }: { quotes: Quote[] }) {
  if (!quotes.length) return <div className="empty">Price data unavailable today.</div>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Last</th>
            <th>1D</th>
            <th>1M</th>
            <th>3M</th>
            <th>YTD</th>
            <th title="Distance below 52-week high">Off high</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.symbol}>
              <td>
                <span className="sym">{q.symbol}</span>
                <span className="name">{q.name}</span>
              </td>
              <td>{fmtPrice(q.last)}</td>
              <td><Pct v={q.chg1d} /></td>
              <td><Pct v={q.chg1m} /></td>
              <td><Pct v={q.chg3m} /></td>
              <td><Pct v={q.chgYtd} /></td>
              <td>
                <span style={{ color: q.drawdown < -30 ? "var(--stress)" : q.drawdown < -15 ? "var(--elevated)" : q.drawdown < -7 ? "var(--watch)" : "var(--muted)" }}>
                  {q.drawdown.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ago(iso: string) {
  if (!iso) return "";
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function NewsList({ items }: { items: NewsItem[] }) {
  if (!items.length) return <div className="empty">No headlines in the last 7 days, or the feed is unavailable.</div>;
  return (
    <ul className="news">
      {items.map((n) => (
        <li key={n.link}>
          <a href={n.link} target="_blank" rel="noopener noreferrer">
            {n.title}
          </a>
          <div className="meta">
            {n.source}
            {n.source && n.date ? " · " : ""}
            {ago(n.date)}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FilingsTable({ filings }: { filings: Filing[] }) {
  if (!filings.length) return <div className="empty">No matching tender-offer filings in the window.</div>;
  return (
    <div className="table-scroll" style={{ maxHeight: 360, overflowY: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Fund</th>
            <th>Form</th>
            <th>Filed</th>
          </tr>
        </thead>
        <tbody>
          {filings.slice(0, 40).map((f) => (
            <tr key={f.link}>
              <td className="wrap-cell">
                <a href={f.link} target="_blank" rel="noopener noreferrer">
                  {f.company}
                </a>
              </td>
              <td>{f.form}</td>
              <td>{f.filed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
