"use client";

import { useMemo, useState } from "react";
import { DEAL_TYPES } from "@/lib/deal-types";
import { usePersistedChoice, usePersistedSet } from "./persisted";
import type { DealEdge, DealType, NetworkNode, Placement, SizeMode } from "@/lib/network";

const colorOf = (t: DealType) => DEAL_TYPES.find((d) => d.type === t)?.color ?? "var(--faint)";

function fmtValue(v: number | null) {
  if (v == null) return "n/a";
  return v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}T` : `$${v.toFixed(0)}B`;
}

function fmtAmount(e: DealEdge) {
  return e.amountB != null ? `$${e.amountB >= 10 ? e.amountB.toFixed(0) : e.amountB.toFixed(1)}B` : "undisclosed";
}

/** Curved path between circle edges; the bend keeps A→B and B→A apart. */
export const SIZE_MODES: { mode: SizeMode; label: string; hint: string }[] = [
  { mode: "exposure", label: "Exposure", hint: "Disclosed deal dollars ÷ company value. Big circles have bet a large share of themselves on these deals." },
  { mode: "deals", label: "Deal dollars", hint: "Total disclosed deal dollars flowing in and out of each company." },
  { mode: "market", label: "Market value", hint: "Market cap for public companies, last priced round for private ones (as in Bloomberg's original)." },
];

function fmtMetric(n: NetworkNode, mode: SizeMode) {
  if (mode === "market") return fmtValue(n.valueB);
  if (mode === "deals") return n.dealsB ? `${fmtValue(n.dealsB)} deals` : "undisclosed";
  return n.exposure != null ? `${n.exposure >= 1 ? n.exposure.toFixed(1) : n.exposure.toFixed(2)}× value` : "n/a";
}

/** Line width proportional to the disclosed amount; undisclosed deals are hairlines. */
function edgeWidth(e: DealEdge, maxAmount: number) {
  return e.amountB ? Math.max(1.4, (e.amountB / maxAmount) * 18) : 1;
}

/**
 * Curved edge between circle rims. The bend keeps A→B and B→A apart. The
 * arrowhead is drawn as its own triangle, sized to the line, and the curve
 * stops at its base so thick lines don't poke through the tip.
 */
function edgePath(a: Placement, b: Placement, width: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bend = Math.min(60, len * 0.18);
  const mx = (a.x + b.x) / 2 - uy * bend;
  const my = (a.y + b.y) / 2 + ux * bend;
  const toward = (n: Placement, tx: number, ty: number, pad: number) => {
    const vx = tx - n.x;
    const vy = ty - n.y;
    const l = Math.hypot(vx, vy) || 1;
    return [n.x + (vx / l) * (n.r + pad), n.y + (vy / l) * (n.r + pad)];
  };
  const [sx, sy] = toward(a, mx, my, 2);
  const [tx, ty] = toward(b, mx, my, 3); // arrow tip
  // Direction at the end of a quadratic curve runs from the control point to the end.
  const vx = tx - mx;
  const vy = ty - my;
  const vl = Math.hypot(vx, vy) || 1;
  const dirx = vx / vl;
  const diry = vy / vl;
  const head = Math.min(24, Math.max(10, width * 2.2));
  const half = Math.min(15, Math.max(5, width * 1.3));
  const bx = tx - dirx * head;
  const by = ty - diry * head;
  return {
    d: `M${sx},${sy} Q${mx},${my} ${bx + dirx},${by + diry}`,
    arrow: `M${tx},${ty} L${bx - diry * half},${by + dirx * half} L${bx + diry * half},${by - dirx * half} Z`,
  };
}

type Hover = { kind: "node"; id: string } | { kind: "edge"; i: number } | null;

export function NetworkGraph({
  nodes,
  edges,
  width,
  height,
}: {
  nodes: NetworkNode[];
  edges: DealEdge[];
  width: number;
  height: number;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const [pinned, setPinned] = useState<Hover>(null);
  const [off, setOff] = usePersistedSet<DealType>("web:hidden-types");
  const [mode, setMode] = usePersistedChoice<SizeMode>("web:size", "exposure", ["exposure", "deals", "market"]);
  const at = (n: NetworkNode) => n.layouts[mode];
  const active = pinned ?? hover;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const maxAmount = useMemo(() => Math.max(1, ...edges.map((e) => e.amountB ?? 0)), [edges]);

  const visible = edges.map((e, i) => ({ e, i })).filter(({ e }) => !off.has(e.type) && byId.has(e.from) && byId.has(e.to));
  const lit = (e: DealEdge, i: number) =>
    !active ||
    (active.kind === "node" && (e.from === active.id || e.to === active.id)) ||
    (active.kind === "edge" && active.i === i);
  const nodeLit = (id: string) =>
    !active ||
    (active.kind === "node" && (active.id === id || visible.some(({ e }) => (e.from === active.id && e.to === id) || (e.to === active.id && e.from === id)))) ||
    (active.kind === "edge" && (edges[active.i].from === id || edges[active.i].to === id));

  const panel = (() => {
    if (!active) return null;
    if (active.kind === "edge") {
      const e = edges[active.i];
      return { title: `${byId.get(e.from)?.name} → ${byId.get(e.to)?.name}`, deals: [e] };
    }
    const n = byId.get(active.id);
    return {
      title: n
        ? `${n.name} · ${fmtValue(n.valueB)}${n.basis === "private" ? " (private round)" : ""} · ${n.dealsB ? `${fmtValue(n.dealsB)} in disclosed deals` : "no disclosed amounts"}${n.exposure != null ? ` · exposure ${n.exposure.toFixed(2)}×` : ""}`
        : "",
      deals: visible.filter(({ e }) => e.from === active.id || e.to === active.id).map(({ e }) => e),
    };
  })();

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", marginBottom: 8 }}>
        <div className="seg" role="radiogroup" aria-label="Size circles by">
          {SIZE_MODES.map((m) => (
            <label key={m.mode} className="seg-radio" title={m.hint}>
              <input
                type="radio"
                name="size-mode"
                value={m.mode}
                checked={mode === m.mode}
                onChange={() => setMode(m.mode)}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
        <span className="sub" style={{ margin: 0 }}>
          {SIZE_MODES.find((m) => m.mode === mode)?.hint}
          {mode !== "market" && " Undisclosed amounts count as zero."}
        </span>
      </div>
      <div className="legend" style={{ marginTop: 0, marginBottom: 8 }}>
        {DEAL_TYPES.map((t) => (
          <button
            key={t.type}
            aria-pressed={!off.has(t.type)}
            onClick={() =>
              setOff((s) => {
                const n = new Set(s);
                if (n.has(t.type)) n.delete(t.type);
                else n.add(t.type);
                return n;
              })
            }
          >
            <i style={{ background: t.color, width: 14 }} />
            {t.label}
          </button>
        ))}
        <span className="faint">· arrows point the way money flows · line width = disclosed amount (hairline = undisclosed) · click to pin</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          role="img"
          aria-label="Network of AI deals between chipmakers, clouds and model labs"
          style={{ display: "block", touchAction: "manipulation" }}
          onClick={() => setPinned(null)}
        >
          {visible.map(({ e, i }) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const w = edgeWidth(e, maxAmount);
            const { d, arrow } = edgePath(at(a), at(b), w);
            const on = lit(e, i);
            return (
              <g key={i} opacity={on ? 0.85 : 0.08}>
                <path
                  d={d}
                  fill="none"
                  stroke={colorOf(e.type)}
                  strokeWidth={w}
                  // Dashes scale with the line so thick unconfirmed deals stay readable.
                  strokeDasharray={e.status === "announced" ? undefined : `${Math.max(5, w * 1.8)} ${Math.max(4, w * 1.1)}`}
                />
                <path d={arrow} fill={colorOf(e.type)} />
                {/* Wide invisible stroke so thin curves are easy to hover. */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(14, w + 6)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover({ kind: "edge", i })}
                  onMouseLeave={() => setHover(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setPinned({ kind: "edge", i });
                  }}
                />
              </g>
            );
          })}
          {nodes.map((node) => {
            const n = { ...node, ...at(node) };
            const on = nodeLit(n.id);
            // Label inside the circle only when it fits.
            const inside = n.r >= 40 && n.name.length * 8.6 < n.r * 2 - 10;
            return (
              <g
                key={n.id}
                style={{ cursor: "pointer" }}
                opacity={on ? 1 : 0.25}
                onMouseEnter={() => setHover({ kind: "node", id: n.id })}
                onMouseLeave={() => setHover(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setPinned({ kind: "node", id: n.id });
                }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill="var(--panel-2)"
                  stroke={n.basis === "private" ? "var(--text)" : "var(--faint)"}
                  strokeWidth={n.basis === "private" ? 1.6 : 1}
                  strokeDasharray={n.basis === "unknown" ? "3 3" : undefined}
                />
                <text
                  x={n.x}
                  y={inside ? n.y - 2 : n.y - n.r - 18}
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="var(--panel)"
                  strokeWidth={4}
                  strokeLinejoin="round"
                  fill="var(--text)"
                  fontSize={inside ? 15 : 12}
                  fontWeight={600}
                >
                  {n.name}
                </text>
                <text
                  x={n.x}
                  y={inside ? n.y + 16 : n.y - n.r - 5}
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="var(--panel)"
                  strokeWidth={4}
                  strokeLinejoin="round"
                  fill="var(--muted)"
                  fontSize={inside ? 13 : 11}
                >
                  {fmtMetric(node, mode)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="card" style={{ background: "var(--panel-2)", minHeight: 96 }}>
          {panel ? (
            <>
              <h3>{panel.title}</h3>
              <ul className="news" style={{ marginTop: 6 }}>
                {panel.deals.map((e, k) => (
                  <li key={k}>
                    <span style={{ color: colorOf(e.type), fontWeight: 600 }}>
                      {byId.get(e.from)?.name} → {byId.get(e.to)?.name}
                    </span>{" "}
                    · {fmtAmount(e)} · {e.label}
                    <div className="meta">
                      {e.date} · {e.status === "loi" ? "letter of intent" : e.status}
                      {" · "}
                      <a href={e.source} target="_blank" rel="noopener noreferrer">
                        source ↗
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="sub" style={{ margin: 0 }}>
              Hover or tap a company or an arrow to see the deals. Solid arrows are company-announced; dashed ones are press
              reports or letters of intent.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
