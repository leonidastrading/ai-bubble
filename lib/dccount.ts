import { cachedFetch } from "./http";

/**
 * Counts of US data center facilities by stage, from two public trackers that
 * update continuously. Neither publishes history, so the daily refresh saves
 * each reading to the snapshot archive and the page charts what accumulates.
 */

export type DcMapCounts = {
  operational: number;
  construction: number;
  planned: number;
  paused: number;
  gwOperational: number | null;
  gwConstruction: number | null;
  gwPlanned: number | null;
};

export type KadoaCounts = { sites: number | null; operational: number; construction: number };

const num = (s: string) => Number(s.replace(/,/g, ""));

function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
}

/** dcmap.us: facilities and projects by stage, plus reported power by stage. */
export async function fetchDcMap(): Promise<DcMapCounts> {
  const text = pageText(await (await cachedFetch("https://dcmap.us/", { timeoutMs: 20000 })).text());
  const stages = text.match(/Operational ([\d,]+) Under construction ([\d,]+) Planned ([\d,]+) Paused ([\d,]+)/);
  if (!stages) throw new Error("dcmap.us: stage counts not found");
  const gw = text.match(/Operational ([\d.]+) GW Under construction ([\d.]+) GW Planned ([\d.]+) GW/);
  return {
    operational: num(stages[1]),
    construction: num(stages[2]),
    planned: num(stages[3]),
    paused: num(stages[4]),
    gwOperational: gw ? Number(gw[1]) : null,
    gwConstruction: gw ? Number(gw[2]) : null,
    gwPlanned: gw ? Number(gw[3]) : null,
  };
}

/** Kadoa: sites with building permits showing construction under way, vs operational. */
export async function fetchKadoa(): Promise<KadoaCounts> {
  const text = pageText(await (await cachedFetch("https://www.kadoa.com/datacenter/report", { timeoutMs: 20000 })).text());
  const m = text.match(/([\d,]+) datacenter sites tracked across \d+ states: ([\d,]+) operational and ([\d,]+) under construction/);
  if (!m) throw new Error("Kadoa: counts not found");
  return { sites: num(m[1]), operational: num(m[2]), construction: num(m[3]) };
}
