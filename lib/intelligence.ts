import { strFromU8, unzipSync } from "fflate";
import { cachedFetch } from "./http";
import type { Point } from "./yahoo";

// ── Capabilities: Epoch Capabilities Index (ECI) ──

export type EciModel = { model: string; eci: number; date: string; org: string; open: boolean };

/** Minimal CSV parser that handles quoted fields with commas. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

/**
 * Epoch AI's Capabilities Index: one score per model combining many
 * independent benchmarks, with release date and open/closed weights.
 */
export async function fetchEci(): Promise<EciModel[]> {
  const zip = new Uint8Array(await (await cachedFetch("https://epoch.ai/data/benchmark_data.zip", { timeoutMs: 30000 })).arrayBuffer());
  const files = unzipSync(zip, { filter: (f) => f.name === "epoch_capabilities_index/eci_scores.csv" });
  const csv = files["epoch_capabilities_index/eci_scores.csv"];
  if (!csv) throw new Error("ECI scores missing from Epoch archive");
  return parseCsv(strFromU8(csv))
    .filter((r) => r.eci && r.date)
    .map((r) => ({
      model: r.Model,
      eci: Number(r.eci),
      date: r.date,
      org: r.Organization,
      open: r["Accessibility group"].startsWith("Open"),
    }))
    .filter((m) => Number.isFinite(m.eci))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type GapSummary = {
  series: { t: string; closed: number | null; open: number | null; gap: number | null }[];
  bestClosed: EciModel;
  bestOpen: EciModel;
  gap: number;
  /** Months between the closed frontier first reaching the best open model's score and that open model's release. */
  lagMonths: number | null;
  gapYearAgo: number | null;
};

/** Best closed and best open score to date, month by month. */
export function computeGap(models: EciModel[]): GapSummary {
  const months = new Map<string, { closed: EciModel | null; open: EciModel | null }>();
  let closed: EciModel | null = null;
  let open: EciModel | null = null;
  for (const m of models) {
    if (m.open) {
      if (!open || m.eci > open.eci) open = m;
    } else if (!closed || m.eci > closed.eci) closed = m;
    months.set(m.date.slice(0, 7), { closed, open });
  }
  // Fill every month up to today so the step lines reach the present.
  const series: GapSummary["series"] = [];
  const keys = [...months.keys()].sort();
  let cur = { closed: null as EciModel | null, open: null as EciModel | null };
  const d = new Date(`${keys[0]}-01T00:00:00Z`);
  const end = new Date().toISOString().slice(0, 7);
  while (d.toISOString().slice(0, 7) <= end) {
    const k = d.toISOString().slice(0, 7);
    cur = months.get(k) ?? cur;
    series.push({
      t: `${k}-01`,
      closed: cur.closed?.eci ?? null,
      open: cur.open?.eci ?? null,
      gap: cur.closed && cur.open ? +(cur.closed.eci - cur.open.eci).toFixed(1) : null,
    });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  if (!closed || !open) throw new Error("ECI: missing closed or open models");
  const firstReach = models.find((m) => !m.open && m.eci >= open!.eci);
  const lagMonths = firstReach
    ? Math.max(0, Math.round((Date.parse(open.date) - Date.parse(firstReach.date)) / (30.44 * 86400_000)))
    : null;
  const yearAgoKey = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 7);
  return {
    series,
    bestClosed: closed,
    bestOpen: open,
    gap: +(closed.eci - open.eci).toFixed(1),
    lagMonths,
    gapYearAgo: series.find((s) => s.t.startsWith(yearAgoKey))?.gap ?? null,
  };
}

// ── Prices: OpenRouter model list (no key) ──

export type ApiModel = { id: string; name: string; inPerM: number; outPerM: number; open: boolean };

export async function fetchOpenRouter(): Promise<ApiModel[]> {
  const json = (await (await cachedFetch("https://openrouter.ai/api/v1/models")).json()) as {
    data: { id: string; name: string; hugging_face_id?: string | null; pricing: { prompt: string; completion: string } }[];
  };
  return json.data
    .map((m) => ({
      id: m.id,
      name: m.name,
      inPerM: Number(m.pricing.prompt) * 1e6,
      outPerM: Number(m.pricing.completion) * 1e6,
      open: Boolean(m.hugging_face_id),
    }))
    .filter((m) => m.inPerM > 0 && m.outPerM > 0);
}

const norm = (s: string) => s.toLowerCase().split(":").pop()!.replace(/[^a-z0-9]/g, "");

export type PricedModel = EciModel & { apiId: string; inPerM: number; outPerM: number; blended: number };

/** Join capability scores to API prices by model name. Blended = 3:1 input:output tokens. */
export function priceModels(eci: EciModel[], api: ApiModel[]): PricedModel[] {
  const byName = new Map(api.map((m) => [norm(m.name), m]));
  const out: PricedModel[] = [];
  for (const m of eci) {
    const a = byName.get(norm(m.model));
    if (!a) continue;
    out.push({ ...m, apiId: a.id, inPerM: a.inPerM, outPerM: a.outPerM, blended: (3 * a.inPerM + a.outPerM) / 4 });
  }
  return out.sort((a, b) => b.eci - a.eci);
}

// ── Enterprise adoption: Census Business Trends and Outlook Survey ──

export type AdoptionSeries = { using: Point[]; expecting: Point[] };

const excelDate = (serial: number) => new Date(Date.UTC(1899, 11, 30) + serial * 86400_000).toISOString().slice(0, 10);

type Cell = { col: string; value: string };

export function sheetRows(xml: string): Cell[][] {
  const rows: Cell[][] = [];
  for (const r of xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Cell[] = [];
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const body = c[2] ?? "";
      const t = body.match(/<t[^>]*>([^<]*)<\/t>/) ?? body.match(/<v>([^<]*)<\/v>/);
      cells.push({ col: c[1], value: t ? t[1] : "" });
    }
    rows.push(cells);
  }
  return rows;
}

/**
 * Share of US businesses that used AI in the last two weeks, and that expect
 * to in the next six months. Biweekly since September 2023.
 */
export async function fetchBtosAi(): Promise<AdoptionSeries> {
  const buf = new Uint8Array(await (await cachedFetch("https://www.census.gov/hfp/btos/downloads/National.xlsx", { timeoutMs: 30000 })).arrayBuffer());
  const files = unzipSync(buf, { filter: (f) => f.name === "xl/worksheets/sheet1.xml" || f.name === "xl/worksheets/sheet5.xml" });
  const estimates = sheetRows(strFromU8(files["xl/worksheets/sheet1.xml"]));
  const dates = sheetRows(strFromU8(files["xl/worksheets/sheet5.xml"]));

  // Survey period code (e.g. 202620) -> reference-period end date.
  const header = dates[0].map((c) => [c.col, c.value] as const);
  const colOf = (name: string) => header.find(([, v]) => v === name)?.[0];
  const smpCol = colOf("Smpdt");
  const endCol = colOf("Ref End");
  const periodDate = new Map<string, string>();
  for (const r of dates.slice(1)) {
    const code = r.find((c) => c.col === smpCol)?.value;
    const end = Number(r.find((c) => c.col === endCol)?.value);
    if (code && Number.isFinite(end)) periodDate.set(code, excelDate(end));
  }

  const head = estimates[0];
  const series = (question: RegExp): Point[] => {
    const row = estimates.find((r) => r.some((c) => question.test(c.value)) && r.some((c) => c.value === "Yes"));
    if (!row) return [];
    const pts: Point[] = [];
    for (const c of row) {
      const code = head.find((h) => h.col === c.col)?.value ?? "";
      const date = periodDate.get(code);
      const v = parseFloat(c.value);
      if (date && /^\d{6}$/.test(code) && c.value.endsWith("%") && Number.isFinite(v)) pts.push({ t: date, v });
    }
    return pts.sort((a, b) => a.t.localeCompare(b.t));
  };
  const using = series(/did this business use Artificial Intelligence/);
  if (using.length < 2) throw new Error("BTOS: AI use question not found");
  return { using, expecting: series(/will be using Artificial Intelligence/) };
}
