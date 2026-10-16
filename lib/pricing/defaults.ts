// Time-based pricing inputs of one material. In the database every field is optional:
// NULL means "use the recommended value for this material" (by slug), so existing rows work
// right after `prisma db push` and the admin only overrides what differs. The hour rate is the
// exception: NULL means the shop-wide rate (work + printer costs, admin → Prices).

/** Shop-wide rates (admin → Prices), as in the owner's costing sheet. */
export type ShopRates = {
  /** What an hour of printing earns, kopecks. */
  laborPerHourCents: number;
  /** What an hour of printing costs: electricity, wear, kopecks. */
  machinePerHourCents: number;
  /** Markup on the plastic over its spool price, %. */
  plasticMarkupPercent: number;
};

/** The customer's price of an hour of printing. */
export const shopHourlyRateCents = (rates: ShopRates) => rates.laborPerHourCents + rates.machinePerHourCents;

export type ResolvedPricing = {
  /** Printer time for the customer, kopecks per hour. */
  hourlyRateCents: number;
  /** The material's own hour rate, or null when it uses the shop-wide one. */
  ownHourlyRateCents: number | null;
  /** Markup on the plastic, %. */
  plasticMarkupPercent: number;
  /** How many cm³ of the model get printed per hour. */
  printSpeedCm3PerHour: number;
  /** Price of one spool, kopecks. */
  spoolPriceCents: number;
  /** Grams of plastic on one spool. */
  spoolWeightG: number;
  /** g/cm³. */
  densityGcm3: number;
  /** Share of the solid volume that is actually printed (walls + infill), 1-100. */
  infillPercent: number;
};

const rub = (n: number) => n * 100;

type MaterialDefaults = Omit<ResolvedPricing, "hourlyRateCents" | "ownHourlyRateCents" | "plasticMarkupPercent">;

const RECOMMENDED: Record<string, MaterialDefaults> = {
  pla: { printSpeedCm3PerHour: 12, spoolPriceCents: rub(1000), spoolWeightG: 1000, densityGcm3: 1.24, infillPercent: 40 },
  petg: { printSpeedCm3PerHour: 12, spoolPriceCents: rub(1000), spoolWeightG: 1000, densityGcm3: 1.27, infillPercent: 40 },
  abs: { printSpeedCm3PerHour: 12, spoolPriceCents: rub(1000), spoolWeightG: 1000, densityGcm3: 1.04, infillPercent: 40 },
  pet: { printSpeedCm3PerHour: 12, spoolPriceCents: rub(1000), spoolWeightG: 1000, densityGcm3: 1.38, infillPercent: 40 },
  tpu: { printSpeedCm3PerHour: 6, spoolPriceCents: rub(3000), spoolWeightG: 1000, densityGcm3: 1.21, infillPercent: 40 },
  pa: { printSpeedCm3PerHour: 8, spoolPriceCents: rub(5500), spoolWeightG: 1000, densityGcm3: 1.14, infillPercent: 40 },
  pc: { printSpeedCm3PerHour: 8, spoolPriceCents: rub(4500), spoolWeightG: 1000, densityGcm3: 1.2, infillPercent: 40 },
  pp: { printSpeedCm3PerHour: 8, spoolPriceCents: rub(3500), spoolWeightG: 1000, densityGcm3: 0.9, infillPercent: 40 },
};

const GENERIC: MaterialDefaults = RECOMMENDED.pla;

type Numeric = number | { toString(): string } | null | undefined;

export type MaterialPricingRow = {
  slug: string;
  hourlyRateCents: Numeric;
  printSpeedCm3PerHour: Numeric;
  spoolPriceCents: Numeric;
  spoolWeightG: Numeric;
  densityGcm3: Numeric;
  infillPercent: Numeric;
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
    printSpeedCm3PerHour: pick(material.printSpeedCm3PerHour, base.printSpeedCm3PerHour),
    spoolPriceCents: pick(material.spoolPriceCents, base.spoolPriceCents),
    spoolWeightG: pick(material.spoolWeightG, base.spoolWeightG),
    densityGcm3: pick(material.densityGcm3, base.densityGcm3),
    infillPercent: pick(material.infillPercent, base.infillPercent),
  };
}
