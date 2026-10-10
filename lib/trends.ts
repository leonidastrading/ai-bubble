import { cachedFetch } from "./http";

export type TrendsData = {
  keywords: string[];
  time: string;
  geo: string;
  points: { t: string; values: number[] }[];
  fetchedAt: string;
};

// Trends serves only browser-like clients.
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * The API answers 429 to requests without the session cookie (NID) that the
 * Trends homepage sets, so pick one up first and reuse it for every group.
 */
let cookie: Promise<string> | null = null;

function sessionCookie(): Promise<string> {
  cookie ??= cachedFetch("https://trends.google.com/trends/?geo=US", { headers })
    .then((res) =>
      res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    )
    .catch((err) => {
      cookie = null;
      throw err;
    });
  return cookie;
}

/** Trends JSON is prefixed with an anti-XSSI guard like `)]}'`. */
function parseGuarded<T>(text: string): T {
  return JSON.parse(text.slice(text.indexOf("{"))) as T;
}

/**
 * Google Trends has no official API. This uses the same two calls the
 * Trends website makes: `explore` returns a token for the time-series
 * widget, and `widgetdata/multiline` returns the series.
 */
export async function fetchTrends(keywords: string[], time: string, geo: string): Promise<TrendsData> {
  const auth = { ...headers, Cookie: await sessionCookie() };
  const req = {
    comparisonItem: keywords.map((keyword) => ({ keyword, geo, time })),
    category: 0,
    property: "",
  };
  const explore = parseGuarded<{
    widgets: { id: string; token: string; request: unknown }[];
  }>(
    await (
      await cachedFetch(
        `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}`,
        { headers: auth, retries: 1 },
      )
    ).text(),
  );
  const widget = explore.widgets.find((w) => w.id === "TIMESERIES");
  if (!widget) throw new Error("No time-series widget in Trends response");

  const series = parseGuarded<{
    default: { timelineData: { time: string; value: number[]; isPartial?: boolean }[] };
  }>(
    await (
      await cachedFetch(
        `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=0` +
          `&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${encodeURIComponent(widget.token)}`,
        { headers: auth, retries: 1 },
      )
    ).text(),
  );

  const points = series.default.timelineData
    .filter((d) => !d.isPartial)
    .map((d) => ({ t: new Date(Number(d.time) * 1000).toISOString().slice(0, 10), values: d.value }));
  if (points.length < 2) throw new Error("Trends returned no data");
  return { keywords, time, geo, points, fetchedAt: new Date().toISOString() };
}
