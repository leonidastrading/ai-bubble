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

/**
 * Page renders and builds read through Blob's cache (writes set a 60-second
 * max-age, so it's never stale for long). Only the daily refresh, which
 * writes back what it reads, needs a guaranteed-latest read.
 */
let freshReads = false;
export function setFreshReads(on: boolean) {
  freshReads = on;
}

async function readJson<T>(path: string): Promise<T | null> {
  if (!historyEnabled()) return null;
  try {
    const res = await get(path, { access: "private", useCache: !freshReads });
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
    cacheControlMaxAge: 60,
  });
}

/** Writes only when the content changed; each write is a billed Blob operation. */
async function writeIfChanged(path: string, data: unknown, previous: unknown): Promise<boolean> {
  if (JSON.stringify(data) === JSON.stringify(previous)) return false;
  await writeJson(path, data);
  return true;
}

export async function readHistory(): Promise<Snapshot[]> {
  return (await readJson<Snapshot[]>(PATH)) ?? [];
}

/** `existing` is the history already read by this refresh, to avoid a second read. */
export async function appendSnapshot(snap: Snapshot, existing?: Snapshot[]): Promise<number> {
  // An empty copy may mean the earlier read failed; re-read rather than overwrite the archive.
  const base = existing?.length ? existing : await readHistory();
  const all = base.filter((s) => s.date !== snap.date);
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

export async function saveTrends<T>(groups: Record<string, T>, existing?: Record<string, T>): Promise<boolean> {
  const prev = existing && Object.keys(existing).length ? existing : await readSavedTrends<T>();
  return writeIfChanged(TRENDS_PATH, { ...prev, ...groups }, prev);
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

export async function saveGpuArchive<T>(rows: T[], existing?: T[]): Promise<boolean> {
  return writeIfChanged(GPU_PATH, rows, existing?.length ? existing : await readGpuArchive<T>());
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

export async function savePriceLog(log: Record<string, PricePoint[]>, existing?: Record<string, PricePoint[]>): Promise<boolean> {
  return writeIfChanged(PRICE_PATH, log, existing && Object.keys(existing).length ? existing : await readPriceLog());
}
