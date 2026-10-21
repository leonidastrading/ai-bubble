import { get, put } from "@vercel/blob";

/**
 * Optional daily snapshots in Vercel Blob. Prices and FRED series come with
 * their own history; these are the derived numbers that don't (GPU rental
 * rates, BDC price/NAV, the composite score). Without a Blob store connected
 * the dashboard still works; it just can't chart these over time.
 */

export type Snapshot = {
  date: string;
  score: number | null;
  bdcPriceToNav: number | null;
  gpu: Record<string, number>;
  /** Daily list prices by source and model (added Oct 2026; absent in older snapshots). */
  gpuList?: Record<string, Record<string, number>>;
  /** Cost of intelligence (added Oct 2026). */
  intel?: { gap: number; frontierBlended: number | null; cheapestNearFrontier: number | null };
  /** US data center facility counts by stage (added Oct 2026). */
  dcCounts?: {
    dcmap?: { operational: number; construction: number; planned: number; paused: number };
    kadoa?: { operational: number; construction: number };
  };
  signals: Record<string, number>;
};

const PATH = "history/snapshots.json";

export const historyEnabled = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

async function readJson<T>(path: string): Promise<T | null> {
  if (!historyEnabled()) return null;
  try {
    const res = await get(path, { access: "private", useCache: false });
    if (!res?.stream) return null;
    return (await new Response(res.stream).json()) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await put(path, JSON.stringify(data), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

export async function readHistory(): Promise<Snapshot[]> {
  return (await readJson<Snapshot[]>(PATH)) ?? [];
}

export async function appendSnapshot(snap: Snapshot): Promise<number> {
  const all = (await readHistory()).filter((s) => s.date !== snap.date);
  all.push(snap);
  all.sort((a, b) => a.date.localeCompare(b.date));
  await writeJson(PATH, all);
  return all.length;
}

/**
 * Last good copy of each Google Trends group. Trends rate-limits cloud IPs
 * unpredictably, so the page falls back to this when a live fetch fails.
 */
const TRENDS_PATH = "history/trends.json";

export async function readSavedTrends<T>(): Promise<Record<string, T>> {
  return (await readJson<Record<string, T>>(TRENDS_PATH)) ?? {};
}

export async function saveTrends<T>(groups: Record<string, T>): Promise<void> {
  const merged = { ...(await readSavedTrends<T>()), ...groups };
  await writeJson(TRENDS_PATH, merged);
}

/**
 * Our own archive of the weekly GPU market history. The free dataset only
 * covers the trailing 53 weeks, so each refresh merges it in here and the
 * history keeps growing.
 */
const GPU_PATH = "history/gpu-weekly.json";

export async function readGpuArchive<T>(): Promise<T[]> {
  return (await readJson<T[]>(GPU_PATH)) ?? [];
}

export async function saveGpuArchive<T>(rows: T[]): Promise<void> {
  await writeJson(GPU_PATH, rows);
}

/**
 * Daily API prices per model (only appended when a price changes), so the
 * page can list frontier price cuts as they happen.
 */
export type PricePoint = { date: string; inPerM: number; outPerM: number };
const PRICE_PATH = "history/api-prices.json";

export async function readPriceLog(): Promise<Record<string, PricePoint[]>> {
  return (await readJson<Record<string, PricePoint[]>>(PRICE_PATH)) ?? {};
}

export async function savePriceLog(log: Record<string, PricePoint[]>): Promise<void> {
  await writeJson(PRICE_PATH, log);
}
