// Time-based pricing inputs of one material. In the database every field is optional:
// NULL means "use the recommended value for this material" (by slug), so existing rows work
// right after `prisma db push` and the admin only overrides what differs. The hour rate is the
// exception: NULL means the shop-wide rate (work + printer costs, admin → Prices).

/** Shop-wide rates (admin → Prices). */
export type ShopRates = {
  /** An hour of printing for the customer: work, printer wear, electricity — all in one, kopecks. */
  laborPerHourCents: number;
  /** Markup on the plastic over its cost, %. */
  plasticMarkupPercent: number;
};

/** The customer's price of an hour of printing. */
export const shopHourlyRateCents = (rates: ShopRates) => rates.laborPerHourCents;

export type ResolvedPricing = {
  /** Printer time for the customer, kopecks per hour. */
  hourlyRateCents: number;
  /** The material's own hour rate, or null when it uses the shop-wide one. */
  ownHourlyRateCents: number | null;
  /** Markup on the plastic, %. */
  plasticMarkupPercent: number;
  /** Price of one spool, kopecks. */
  spoolPriceCents: number;
  /** Grams of plastic on one spool. */
  spoolWeightG: number;
};

const rub = (n: number) => n * 100;

type MaterialDefaults = Omit<ResolvedPricing, "hourlyRateCents" | "ownHourlyRateCents" | "plasticMarkupPercent">;

const RECOMMENDED: Record<string, MaterialDefaults> = {
  pla: { spoolPriceCents: rub(1000), spoolWeightG: 1000 },
  petg: { spoolPriceCents: rub(1000), spoolWeightG: 1000 },
  abs: { spoolPriceCents: rub(1000), spoolWeightG: 1000 },
  pet: { spoolPriceCents: rub(1000), spoolWeightG: 1000 },
  tpu: { spoolPriceCents: rub(3000), spoolWeightG: 1000 },
  pa: { spoolPriceCents: rub(5500), spoolWeightG: 1000 },
  pc: { spoolPriceCents: rub(4500), spoolWeightG: 1000 },
  pp: { spoolPriceCents: rub(3500), spoolWeightG: 1000 },
};

const GENERIC: MaterialDefaults = RECOMMENDED.pla;

type Numeric = number | { toString(): string } | null | undefined;

export type MaterialPricingRow = {
  slug: string;
  hourlyRateCents: Numeric;
  spoolPriceCents: Numeric;
  spoolWeightG: Numeric;
};

const pick = (value: Numeric, fallback: number) => {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function resolvePricing(material: MaterialPricingRow, rates: ShopRates): ResolvedPricing {
  const base = RECOMMENDED[material.slug] ?? GENERIC;
  const own = material.hourlyRateCents === null || material.hourlyRateCents === undefined ? null : Number(material.hourlyRateCents);
  const ownHourlyRateCents = own !== null && Number.isFinite(own) ? own : null;
  return {
    hourlyRateCents: ownHourlyRateCents ?? shopHourlyRateCents(rates),
    ownHourlyRateCents,
    plasticMarkupPercent: rates.plasticMarkupPercent,
    spoolPriceCents: pick(material.spoolPriceCents, base.spoolPriceCents),
    spoolWeightG: pick(material.spoolWeightG, base.spoolWeightG),
  };
}
