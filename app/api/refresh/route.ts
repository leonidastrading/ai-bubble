import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAG } from "@/lib/config";
import { getDashboardData, toSnapshot } from "@/lib/data";
import { appendSnapshot, historyEnabled, saveGpuArchive, saveTrends } from "@/lib/history";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Called daily by Vercel Cron (see vercel.json). Drops the cached upstream
 * data, re-fetches it, stores a snapshot for the history charts, and
 * rebuilds the page.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag(CACHE_TAG, { expire: 0 });
  const data = await getDashboardData();

  let stored: number | string = "history disabled (no Blob store connected)";
  if (historyEnabled()) {
    try {
      stored = await appendSnapshot(toSnapshot(data));
      const liveTrends = data.trends.filter((t) => t.live && t.data);
      if (liveTrends.length) await saveTrends(Object.fromEntries(liveTrends.map((t) => [t.id, t.data])));
      if (data.gpuHistory.length) await saveGpuArchive(data.gpuHistory);
    } catch (err) {
      stored = `history write failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  revalidatePath("/");

  return Response.json({
    ok: true,
    generatedAt: data.generatedAt,
    score: data.score,
    signals: data.signals.length,
    snapshots: stored,
    trends: Object.fromEntries(data.trends.map((t) => [t.id, t.live ? "live" : t.data ? "saved copy" : "unavailable"])),
    errors: data.errors,
  });
}
