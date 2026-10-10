import type { Filing } from "@/lib/sec";
import type { NewsItem } from "@/lib/news";
import { scoreLabel, type Signal } from "@/lib/signals";
import { EXPLAIN } from "@/lib/explain";
import { SortableTable } from "./sortable-table";
import { stressColor, stressColorDim, toScore } from "@/lib/stress-color";
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

const toneVar = (score: number) => stressColor(score);

/** Semicircle gauge for the composite score. */
export function Gauge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const { label } = scoreLabel(s);
  const r = 80;
  const cx = 100;
  const cy = 96;
  const angle = Math.PI * (1 - s / 100);
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    return `M ${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)}`;
  };
  // The arc is drawn as short segments so it can shade continuously from
  // green to red; the part beyond the score stays faint.
  const STEP = 2;
  const segments = Array.from({ length: 100 / STEP }, (_, i) => i * STEP);
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 200 110" width="100%" style={{ maxWidth: 280 }} role="img" aria-label={`Bubble stress score ${s} of 100, ${label}`}>
        {segments.map((a) => {
          const filled = score != null && a < s;
          return (
            <path
              key={a}
              d={arc(a, Math.min(100, a + STEP + 0.4))}
              // Opaque muted tint of the same hue, so overlapping segments leave no seams.
              stroke={filled ? stressColor(a + STEP / 2) : stressColorDim(a + STEP / 2)}
              strokeWidth={14}
              fill="none"
            />
          );
        })}
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
      <div style={{ fontWeight: 650, fontSize: 15, color: stressColor(s) }}>{label}</div>
    </div>
  );
}

export function SignalTable({ signals }: { signals: Signal[] }) {
  const sorted = [...signals].sort((a, b) => b.score - a.score);
  return (
    <SortableTable
      storageKey="table:signals"
      columns={[
        { label: "Signal" },
        { label: "Scenario step", align: "left" },
        { label: "Now", title: "Values have different units, so this sorts within like signals only" },
        { label: "Stress", align: "left", firstDir: "desc" },
        { label: "Calm → Crisis" },
      ]}
      rows={sorted.map((s) => ({
        key: s.id,
        title: s.detail,
        sort: [s.label, s.stage, parseFloat(s.value.replace(/[^0-9.-]/g, "")), s.score, s.calm],
        cells: [
          <>
            <div style={{ fontWeight: 600 }}>{s.label}</div>
            <div className="faint" style={{ fontSize: 11, whiteSpace: "normal", maxWidth: 320 }}>
              {s.detail}
            </div>
          </>,
          <span className="muted">{s.stage}</span>,
          s.value,
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: 140 }}>
            <div className="bar" style={{ flex: 1 }}>
              <span style={{ width: `${Math.max(3, s.score)}%`, background: toneVar(s.score) }} />
            </div>
            <span style={{ color: toneVar(s.score), width: 24 }}>{s.score}</span>
          </div>,
          <span className="faint" style={{ fontSize: 11 }}>
            {s.calm} → {s.stress}
          </span>,
        ],
      }))}
    />
  );
}

function fmtPrice(v: number) {
  return v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2);
}

export function QuoteTable({ quotes, storageKey }: { quotes: Quote[]; storageKey?: string }) {
  if (!quotes.length) return <div className="empty">Price data unavailable today.</div>;
  return (
    <SortableTable
      storageKey={storageKey}
      columns={[
        { label: "Ticker" },
        { label: "Last", firstDir: "desc" },
        { label: "1D", firstDir: "desc" },
        { label: "1M", firstDir: "desc" },
        { label: "3M", firstDir: "desc" },
        { label: "YTD", firstDir: "desc" },
        { label: "Off high", title: "Distance below 52-week high", firstDir: "asc" },
      ]}
      rows={quotes.map((q) => ({
        key: q.symbol,
        sort: [q.symbol, q.last, q.chg1d, q.chg1m, q.chg3m, q.chgYtd, q.drawdown],
        cells: [
          <>
            <span className="sym">{q.symbol}</span>
            <span className="name">{q.name}</span>
          </>,
          fmtPrice(q.last),
          <Pct v={q.chg1d} />,
          <Pct v={q.chg1m} />,
          <Pct v={q.chg3m} />,
          <Pct v={q.chgYtd} />,
          <span style={{ color: q.drawdown > -3 ? "var(--muted)" : stressColor(toScore(q.drawdown, -3, -40)) }}>
            {q.drawdown.toFixed(1)}%
          </span>,
        ],
      }))}
    />
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
    <SortableTable
      storageKey="table:filings"
      scrollStyle={{ maxHeight: 360, overflowY: "auto" }}
      columns={[{ label: "Fund", className: "wrap-cell" }, { label: "Form" }, { label: "Filed", firstDir: "desc" }]}
      rows={filings.slice(0, 40).map((f) => ({
        key: f.link,
        sort: [f.company, f.form, f.filed],
        cells: [
          <a href={f.link} target="_blank" rel="noopener noreferrer">
            {f.company}
          </a>,
          f.form,
          f.filed,
        ],
      }))}
    />
  );
}

/** What / why / watch notes under a chart (text lives in lib/explain.ts). */
export function Explain({ id }: { id: string }) {
  const e = EXPLAIN[id];
  if (!e) return null;
  return (
    <dl className="explain">
      <dt>What it is</dt>
      <dd>{e.what}</dd>
      <dt>Why it matters</dt>
      <dd>{e.why}</dd>
      <dt>Watch for</dt>
      <dd>{e.watch}</dd>
    </dl>
  );
}
