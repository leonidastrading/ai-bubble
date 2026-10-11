import { cachedFetch } from "./http";
import type { Point } from "./yahoo";

/**
 * US monthly construction spending on data centers, inflation-adjusted
 * (Census value put in place, republished by Our World in Data). Values in
 * $ billions per month.
 */
export async function fetchDataCenterConstruction(): Promise<Point[]> {
  const csv = await (
    await cachedFetch(
      "https://ourworldindata.org/grapher/monthly-spending-data-center-us.csv?v=1&csvType=full&useColumnShortNames=true",
    )
  ).text();
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header.split(",");
  const iMonth = cols.indexOf("month");
  const iVal = cols.length - 1;
  const points: Point[] = [];
  for (const line of lines) {
    const c = line.split(",");
    const v = Number(c[iVal]);
    if (c[iMonth] && Number.isFinite(v)) points.push({ t: `${c[iMonth]}-01`, v: +(v / 1e9).toFixed(3) });
  }
  if (points.length < 12) throw new Error("Data center construction: too little data");
  return points;
}
