import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAG } from "@/lib/config";
import { getDashboardData, toSnapshot } from "@/lib/data";
import { appendSnapshot, historyEnabled, saveGpuArchive, savePriceLog, saveTrends, setFreshReads, type PricePoint } from "@/lib/history";

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
  // This run writes back what it reads, so it must see the latest Blob copies.
  setFreshReads(true);
  let data;
  try {
    data = await getDashboardData();
  } finally {
    setFreshReads(false);
  }

  let stored: number | string = "history disabled (no Blob store connected)";
  if (historyEnabled()) {
    try {
      // Reuse what getDashboardData already read; each file is written only if it changed.
      stored = await appendSnapshot(toSnapshot(data), data.history);
      const liveTrends = data.trends.filter((t) => t.live && t.data);
      if (liveTrends.length) await saveTrends(Object.fromEntries(liveTrends.map((t) => [t.id, t.data!])), data.saved.trends);
      if (data.gpuHistory.length) await saveGpuArchive(data.gpuHistory, data.saved.gpuArchive);
      // Append today's price for the top models only when it changed.
      if (data.intel.priced.length) {
        const log: Record<string, PricePoint[]> = { ...data.intel.priceLog };
        const today = data.generatedAt.slice(0, 10);
        for (const m of data.intel.priced.slice(0, 40)) {
          const hist = log[m.apiId] ?? [];
          const last = hist[hist.length - 1];
          if (!last || last.inPerM !== m.inPerM || last.outPerM !== m.outPerM)
            log[m.apiId] = [...hist, { date: today, inPerM: m.inPerM, outPerM: m.outPerM }];
        }
        await savePriceLog(log, data.intel.priceLog);
      }
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
