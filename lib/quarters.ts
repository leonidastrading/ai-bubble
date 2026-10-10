/**
 * Snap a fiscal period end to the nearest calendar quarter, so companies with
 * different fiscal calendars (Oracle's quarters end Aug/Nov/Feb/May, Nvidia's
 * in late Jan/Apr/Jul/Oct) share one x position per quarter.
 */
export function calendarQuarter(end: string): { key: string; label: string; full: string } {
  const d = new Date(`${end}T00:00:00Z`);
  let best = { y: 0, q: 0, dist: Infinity };
  for (let y = d.getUTCFullYear() - 1; y <= d.getUTCFullYear() + 1; y++)
    for (let q = 1; q <= 4; q++) {
      const qEnd = Date.UTC(y, q * 3, 0); // day 0 of next month = last day of quarter
      const dist = Math.abs(qEnd - d.getTime());
      if (dist < best.dist) best = { y, q, dist };
    }
  return {
    key: `${best.y}-Q${best.q}`,
    label: `Q${best.q} '${String(best.y).slice(2)}`,
    full: `Q${best.q} ${best.y}`,
  };
}

/** Rows for a quarterly chart: one per calendar quarter, keeping each series' real period end. */
export function quarterRows(
  series: { key: string; points: { end: string; value: number | null }[] }[],
): Record<string, number | string | null>[] {
  const rows = new Map<string, Record<string, number | string | null>>();
  for (const s of series)
    for (const p of s.points) {
      const q = calendarQuarter(p.end);
      const row = rows.get(q.key) ?? { qKey: q.key, q: q.label, qFull: q.full };
      row[s.key] = p.value;
      row[`${s.key}__end`] = p.end;
      rows.set(q.key, row);
    }
  return [...rows.values()].sort((a, b) => String(a.qKey).localeCompare(String(b.qKey)));
}
