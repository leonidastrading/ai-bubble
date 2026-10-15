import data from "@/data/credit-stress.json";

/**
 * Reported credit prices for AI borrowers (CDS spreads and bond prices),
 * curated from dated reports. Live CDS data is paywalled, so this is updated
 * by the weekly review rather than fetched.
 */

export type CdsPoint = { date: string; bps: number; note?: string; source: string };
export type BondPrice = { name: string; price: number; yield: number | null; date: string; note?: string; source: string };
export type Borrower = { name: string; ticker: string; rating: string | null; cds: CdsPoint[]; bonds: BondPrice[] };

export const creditStress = data as { updated: string; notes: string; borrowers: Borrower[] };

/**
 * Market-implied chance of default within five years from a 5-year CDS spread,
 * using the standard rule of thumb: annual hazard = spread / (1 − recovery),
 * with 40% recovery. Risk-neutral, so it overstates real-world odds.
 */
export function impliedDefault5y(bps: number, recovery = 0.4): number {
  const hazard = bps / 10000 / (1 - recovery);
  return (1 - Math.exp(-5 * hazard)) * 100;
}

export const latestCds = (b: Borrower) => (b.cds.length ? b.cds[b.cds.length - 1] : null);
