import { SEC_USER_AGENT } from "./config";
import { cachedFetch } from "./http";

export const secHeaders = { "User-Agent": SEC_USER_AGENT, Accept: "application/json" };

let tickerMap: Promise<Map<string, number>> | null = null;

export function loadTickerMap(): Promise<Map<string, number>> {
  tickerMap ??= cachedFetch("https://www.sec.gov/files/company_tickers.json", { headers: secHeaders })
    .then((r) => r.json() as Promise<Record<string, { ticker: string; cik_str: number }>>)
    .then((d) => new Map(Object.values(d).map((v) => [v.ticker, v.cik_str])))
    .catch((err) => {
      tickerMap = null;
      throw err;
    });
  return tickerMap;
}

export type Nav = { nav: number; asOf: string; form: string };

/** Latest NAV per share a BDC reported in a 10-Q/10-K (XBRL). */
export async function fetchNav(ticker: string): Promise<Nav> {
  const cik = (await loadTickerMap()).get(ticker);
  if (!cik) throw new Error(`No CIK for ${ticker}`);
  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${String(cik).padStart(10, "0")}/us-gaap/NetAssetValuePerShare.json`;
  const json = (await (await cachedFetch(url, { headers: secHeaders })).json()) as {
    units: Record<string, { end: string; val: number; form: string; filed: string }[]>;
  };
  const facts = (json.units["USD/shares"] ?? Object.values(json.units)[0] ?? [])
    .filter((f) => f.form === "10-Q" || f.form === "10-K")
    .sort((a, b) => a.end.localeCompare(b.end) || a.filed.localeCompare(b.filed));
  const latest = facts[facts.length - 1];
  if (!latest) throw new Error(`No NAV facts for ${ticker}`);
  return { nav: latest.val, asOf: latest.end, form: latest.form };
}

export type Filing = {
  company: string;
  form: string;
  filed: string;
  link: string;
};

/**
 * Issuer tender offers (SC TO-I and amendments) are how non-traded BDCs and
 * interval funds handle redemptions. A rising count, or amendments that
 * report requests above the 5% cap, are the earliest crack in private credit.
 */
export async function fetchTenderOffers(names: string[], days = 120): Promise<Filing[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const q = names.map((n) => `"${n}"`).join(" OR ");
  const url =
    `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}` +
    `&forms=SC%20TO-I,SC%20TO-I/A,SC%20TO-C&dateRange=custom` +
    `&startdt=${start.toISOString().slice(0, 10)}&enddt=${end.toISOString().slice(0, 10)}`;
  const json = (await (await cachedFetch(url, { headers: secHeaders })).json()) as {
    hits: {
      hits: {
        _id: string;
        _source: { display_names: string[]; form: string; file_date: string; ciks: string[]; adsh: string };
      }[];
    };
  };
  const seen = new Set<string>();
  const filings: Filing[] = [];
  for (const h of json.hits.hits) {
    const s = h._source;
    if (seen.has(s.adsh)) continue;
    seen.add(s.adsh);
    const cik = Number(s.ciks[0]);
    filings.push({
      company: (s.display_names[0] ?? "").replace(/\s*\(CIK \d+\)/, ""),
      form: s.form,
      filed: s.file_date,
      link: `https://www.sec.gov/Archives/edgar/data/${cik}/${s.adsh.replace(/-/g, "")}/${s.adsh}-index.html`,
    });
  }
  return filings.sort((a, b) => b.filed.localeCompare(a.filed));
}

export type Fact = { start?: string; end: string; val: number; form: string; filed: string; fy?: number; fp?: string };

/**
 * All 10-Q/10-K facts for the first of `concepts` the company reports.
 * Companies tag the same line item differently (e.g. Amazon's capex), so
 * callers pass fallbacks in order of preference.
 */
export async function fetchConcept(
  ticker: string,
  concepts: string[],
  unit = "USD",
): Promise<{ concept: string; facts: Fact[] }> {
  const cik = (await loadTickerMap()).get(ticker);
  if (!cik) throw new Error(`No CIK for ${ticker}`);
  const errors: string[] = [];
  for (const concept of concepts) {
    try {
      const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${String(cik).padStart(10, "0")}/us-gaap/${concept}.json`;
      const json = (await (await cachedFetch(url, { headers: secHeaders, retries: 1 })).json()) as {
        units: Record<string, Fact[]>;
      };
      const facts = (json.units[unit] ?? []).filter((f) => f.form === "10-Q" || f.form === "10-K");
      // A concept the company stopped using years ago is as good as missing.
      const recent = facts.some((f) => f.end >= new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10));
      if (recent) return { concept, facts };
      errors.push(`${concept}: stale`);
    } catch (err) {
      errors.push(`${concept}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`${ticker} ${errors.join("; ")}`);
}
