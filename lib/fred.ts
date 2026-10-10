import { cachedFetch } from "./http";
import type { Point } from "./yahoo";

export type FredData = {
  id: string;
  points: Point[];
  last: number;
  lastDate: string;
  changeYoY: number | null; // absolute change vs ~1 year earlier
  min1y: number;
  max1y: number;
};

/** FRED's public CSV endpoint needs no API key. */
export async function fetchFred(id: string, years = 5): Promise<FredData> {
  const start = new Date();
  start.setFullYear(start.getFullYear() - years);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start.toISOString().slice(0, 10)}`;
  const text = await (await cachedFetch(url)).text();
  const points: Point[] = [];
  for (const line of text.trim().split("\n").slice(1)) {
    const [t, raw] = line.split(",");
    const v = Number(raw);
    if (t && raw && raw !== "." && Number.isFinite(v)) points.push({ t, v });
  }
  if (!points.length) throw new Error(`No observations for ${id}`);

  const last = points[points.length - 1];
  const yearAgo = new Date(last.t);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const cutoff = yearAgo.toISOString().slice(0, 10);
  const prior = [...points].reverse().find((p) => p.t <= cutoff);
  const lastYear = points.filter((p) => p.t > cutoff).map((p) => p.v);

  return {
    id,
    points,
    last: last.v,
    lastDate: last.t,
    changeYoY: prior ? last.v - prior.v : null,
    min1y: Math.min(...lastYear),
    max1y: Math.max(...lastYear),
  };
}
