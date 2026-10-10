import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import deals from "@/data/ai-deals.json";
import { mapLimit, settle } from "./http";
import { fetchSharesOutstanding } from "./sec";
import { fetchQuote, type Quote } from "./yahoo";

export type DealType = "hardware" | "investment" | "services" | "vc" | "credit";

export type DealEdge = {
  from: string;
  to: string;
  type: DealType;
  amountB: number | null;
  date: string;
  status: "announced" | "reported" | "loi";
  label: string;
  source: string;
};

export type SizeMode = "market" | "deals" | "exposure";

export type Placement = { x: number; y: number; r: number };

export type NetworkNode = {
  id: string;
  name: string;
  valueB: number | null;
  basis: "market" | "private" | "unknown";
  asOf: string | null;
  source: string | null;
  dealsB: number; // disclosed deal dollars in + out
  exposure: number | null; // dealsB / valueB
  layouts: Record<SizeMode, Placement>;
};

type Valued = Omit<NetworkNode, "layouts">;

export type RoundTrip = { a: string; b: string; aToB: DealEdge[]; bToA: DealEdge[]; knownB: number };

export type Network = {
  updated: string;
  notes: string;
  nodes: NetworkNode[];
  edges: DealEdge[];
  roundTrips: RoundTrip[];
  width: number;
  height: number;
};

type RawNode = {
  id: string;
  name: string;
  ticker?: string;
  currency?: string;
  shares?: number | null;
  private?: { valueB: number | null; asOf: string | null; source: string | null };
};

const WIDTH = 1000;
const HEIGHT = 820;

async function valueOf(
  n: RawNode,
  quotes: Map<string, Quote>,
  usdPerJpy: number | null,
  errors: string[],
): Promise<Pick<NetworkNode, "valueB" | "basis" | "asOf" | "source">> {
  if (n.ticker) {
    const q = quotes.get(n.ticker);
    let shares = n.shares ?? null;
    let asOf = q?.points[q.points.length - 1].t ?? null;
    if (n.currency !== "JPY") {
      const s = await settle(fetchSharesOutstanding(n.ticker));
      if (s.ok) shares = s.data.shares;
    }
    const fx = n.currency === "JPY" ? usdPerJpy : 1;
    if (q && shares && fx) {
      return { valueB: (q.last * shares * fx) / 1e9, basis: "market", asOf, source: `https://finance.yahoo.com/quote/${n.ticker}` };
    }
    errors.push(`Market value ${n.ticker}: ${!q ? "no price" : !shares ? "no share count" : "no FX rate"}`);
    asOf = null;
  }
  if (n.private?.valueB) {
    return { valueB: n.private.valueB, basis: "private", asOf: n.private.asOf, source: n.private.source };
  }
  return { valueB: null, basis: "unknown", asOf: null, source: null };
}

/** Deterministic force layout: same data in, same picture out. */
function layout(nodes: Valued[], edges: DealEdge[], metric: (n: Valued) => number | null): Placement[] {
  // Circle area proportional to the metric.
  const maxV = Math.max(...nodes.map((n) => metric(n) ?? 0), 1e-9);
  const radius = (v: number | null) => (v ? Math.max(16, Math.sqrt(v / maxV) * 92) : 14);
  type SimNode = SimulationNodeDatum & { id: string; r: number };
  const sim: SimNode[] = nodes.map((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    return { id: n.id, r: radius(metric(n)), x: WIDTH / 2 + Math.cos(a) * 300, y: HEIGHT / 2 + Math.sin(a) * 280 };
  });
  // Pin the two hubs the original chart is organised around.
  const hub = (id: string, x: number, y: number) => {
    const n = sim.find((s) => s.id === id);
    if (n) Object.assign(n, { x, y, fx: x, fy: y });
  };
  hub("NVDA", WIDTH * 0.55, HEIGHT * 0.55);
  hub("OPENAI", WIDTH * 0.3, HEIGHT * 0.3);

  const links = edges.map((e) => ({ source: e.from, target: e.to }));
  forceSimulation(sim)
    .force("link", forceLink<SimNode, { source: string; target: string }>(links).id((d) => d.id).distance(210).strength(0.25))
    .force("charge", forceManyBody().strength(-900))
    .force("collide", forceCollide<SimNode>().radius((d) => d.r + 34).iterations(3))
    .force("x", forceX(WIDTH / 2).strength(0.04))
    .force("y", forceY(HEIGHT / 2).strength(0.05))
    .stop()
    .tick(400);

  return nodes.map((_, i) => {
    const s = sim[i];
    const r = s.r;
    return {
      r,
      x: Math.max(r + 60, Math.min(WIDTH - r - 60, s.x ?? WIDTH / 2)),
      // Leave room above for labels drawn outside small circles.
      y: Math.max(r + 44, Math.min(HEIGHT - r - 16, s.y ?? HEIGHT / 2)),
    };
  });
}

export async function getNetwork(quotes: Map<string, Quote>, errors: string[]): Promise<Network> {
  const raw = deals.nodes as RawNode[];
  const edges = deals.edges as DealEdge[];

  // Prices for network tickers not already loaded by the dashboard, plus the yen rate.
  const missing = raw.filter((n) => n.ticker && !quotes.has(n.ticker)).map((n) => n.ticker!);
  const extra = await mapLimit([...missing, "JPY=X"], 3, (t) => settle(fetchQuote(t, t, "5d")));
  const all = new Map(quotes);
  [...missing, "JPY=X"].forEach((t, i) => {
    const r = extra[i];
    if (r.ok) all.set(t, r.data);
  });
  const jpyPerUsd = all.get("JPY=X")?.last;

  const valued: Valued[] = await mapLimit(raw, 2, async (n) => {
    const v = await valueOf(n, all, jpyPerUsd ? 1 / jpyPerUsd : null, errors);
    const dealsB = edges.filter((e) => e.from === n.id || e.to === n.id).reduce((t, e) => t + (e.amountB ?? 0), 0);
    return { id: n.id, name: n.name, ...v, dealsB, exposure: v.valueB && dealsB ? dealsB / v.valueB : null };
  });

  // Pairs with money flowing both ways: the "circular" part of the web.
  const roundTrips: RoundTrip[] = [];
  const ids = valued.map((n) => n.id);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const aToB = edges.filter((e) => e.from === a && e.to === b);
      const bToA = edges.filter((e) => e.from === b && e.to === a);
      if (aToB.length && bToA.length) {
        const knownB = [...aToB, ...bToA].reduce((s, e) => s + (e.amountB ?? 0), 0);
        roundTrips.push({ a, b, aToB, bToA, knownB });
      }
    }
  roundTrips.sort((x, y) => y.knownB - x.knownB);

  return {
    updated: deals.updated,
    notes: deals.notes,
    nodes: (() => {
      const market = layout(valued, edges, (n) => n.valueB);
      const dealsL = layout(valued, edges, (n) => n.dealsB || null);
      const exposure = layout(valued, edges, (n) => n.exposure);
      return valued.map((n, i) => ({ ...n, layouts: { market: market[i], deals: dealsL[i], exposure: exposure[i] } }));
    })(),
    edges,
    roundTrips,
    width: WIDTH,
    height: HEIGHT,
  };
}
