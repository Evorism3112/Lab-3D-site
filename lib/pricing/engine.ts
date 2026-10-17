export class PricingError extends Error {}

export type PricingInput = {
  volumeCm3: number;
  /** Printer time, kopecks per hour. The other *Cents fields are kopecks too. */
  hourlyRateCents: number;
  /** Model volume the printer gets through per hour, cm³/h. */
  printSpeedCm3PerHour: number;
  spoolPriceCents: number;
  spoolWeightG: number;
  densityGcm3: number;
  /** Share of the solid volume that is actually printed, 1-100. */
  infillPercent: number;
  /** Flat charge for starting a job. */
  setupFeeCents: number;
  minPriceCents: number;
  /** Finish price multiplier, e.g. 1 for standard, 1.15 for sanded. Defaults to 1. */
  finishMultiplier?: number;
  /** Markup on the plastic over its spool price, %. Defaults to 0. */
  plasticMarkupPercent?: number;
  /** What the slicer says one piece takes; replaces the volume-based time and plastic estimate. */
  sliced?: { printHours: number; plasticGrams: number };
  quantity: number;
};

export type PricingBreakdown = {
  unitPriceCents: number;
  totalPriceCents: number;
  /** Time + plastic (after the finish multiplier), before the minimum-price floor and setup fee. */
  materialCostCents: number;
  timeCostCents: number;
  plasticCostCents: number;
  setupFeeCents: number;
  minPriceFloorApplied: boolean;
  /** Estimated printing time of one piece / of the whole order, hours. */
  printHoursPerUnit: number;
  printHoursTotal: number;
  /** Estimated plastic use for the whole order, grams. */
  plasticGramsTotal: number;
  /** Time and plastic come from the slicer rather than from the model volume. */
  sliced: boolean;
};

/**
 * Pure pricing function shared by the live quote endpoint and order creation,
 * so a quoted price can never drift from the price actually charged.
 *
 * hours    = volume / printSpeed       (or the slicer's time)
 * grams    = volume * infill% * density (or the slicer's plastic)
 * subtotal = (hours * hourlyRate + grams * spoolPrice / spoolWeight * (1 + markup%)) * finishMultiplier
 * unitPrice = max(minPrice, subtotal) + setupFee
 */
export function computePrice(input: PricingInput): PricingBreakdown {
  const {
    volumeCm3,
    hourlyRateCents,
    printSpeedCm3PerHour,
    spoolPriceCents,
    spoolWeightG,
    densityGcm3,
    infillPercent,
    setupFeeCents,
    minPriceCents,
    quantity,
  } = input;
  const finishMultiplier = input.finishMultiplier ?? 1;
  const plasticMarkup = 1 + (input.plasticMarkupPercent ?? 0) / 100;

  if (!(volumeCm3 > 0)) throw new PricingError("volumeCm3 must be positive");
  if (!(hourlyRateCents >= 0)) throw new PricingError("hourlyRateCents must be non-negative");
  if (!(printSpeedCm3PerHour > 0)) throw new PricingError("printSpeedCm3PerHour must be positive");
  if (!(spoolWeightG > 0)) throw new PricingError("spoolWeightG must be positive");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new PricingError("quantity must be a positive integer");
  }

  const { sliced } = input;
  const printHoursPerUnit = sliced ? sliced.printHours : volumeCm3 / printSpeedCm3PerHour;
  const plasticGramsPerUnit = sliced ? sliced.plasticGrams : ((volumeCm3 * infillPercent) / 100) * densityGcm3;

  const timeCostCents = Math.round(printHoursPerUnit * hourlyRateCents * finishMultiplier);
  const plasticCostCents = Math.round(
    ((plasticGramsPerUnit * spoolPriceCents) / spoolWeightG) * plasticMarkup * finishMultiplier,
  );
  const materialCostCents = timeCostCents + plasticCostCents;
  const minPriceFloorApplied = materialCostCents < minPriceCents;
  const unitPriceCents = Math.max(minPriceCents, materialCostCents) + setupFeeCents;

  return {
    unitPriceCents,
    totalPriceCents: unitPriceCents * quantity,
    materialCostCents,
    timeCostCents,
    plasticCostCents,
    setupFeeCents,
    minPriceFloorApplied,
    printHoursPerUnit,
    printHoursTotal: printHoursPerUnit * quantity,
    plasticGramsTotal: plasticGramsPerUnit * quantity,
    sliced: Boolean(sliced),
  };
}
