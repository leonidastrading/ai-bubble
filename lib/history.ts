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
  signals: Record<string, number>;
};

const PATH = "history/snapshots.json";

export const historyEnabled = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export async function readHistory(): Promise<Snapshot[]> {
  if (!historyEnabled()) return [];
  try {
    const res = await get(PATH, { access: "private", useCache: false });
    if (!res?.stream) return [];
    return (await new Response(res.stream).json()) as Snapshot[];
  } catch {
    return [];
  }
}

export async function appendSnapshot(snap: Snapshot): Promise<number> {
  const all = (await readHistory()).filter((s) => s.date !== snap.date);
  all.push(snap);
  all.sort((a, b) => a.date.localeCompare(b.date));
  await put(PATH, JSON.stringify(all), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return all.length;
}
