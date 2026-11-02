export class PricingError extends Error {}

export type PricingInput = {
  /** What the slicer says one piece takes: printing time and plastic. */
  sliced: { printHours: number; plasticGrams: number };
  /** Printer time, kopecks per hour. The other *Cents fields are kopecks too. */
  hourlyRateCents: number;
  spoolPriceCents: number;
  spoolWeightG: number;
  /** Flat charge for starting a job. */
  setupFeeCents: number;
  minPriceCents: number;
  /** Finish price multiplier, e.g. 1 for standard, 1.15 for sanded. Defaults to 1. */
  finishMultiplier?: number;
  /** Markup on the plastic over its spool price, %. Defaults to 0. */
  plasticMarkupPercent?: number;
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
  /** Printing time of one piece / of the whole order, hours (from the slicer). */
  printHoursPerUnit: number;
  printHoursTotal: number;
  /** Plastic use for the whole order, grams (from the slicer). */
  plasticGramsTotal: number;
};

/**
 * Pure pricing function shared by the live quote endpoint and order creation,
 * so a quoted price can never drift from the price actually charged. Time and plastic always
 * come from the slicer; a model it can't slice has no price (lib/pricing/options.ts).
 *
 * subtotal = (hours * hourlyRate + grams * spoolPrice / spoolWeight * (1 + markup%)) * finishMultiplier
 * unitPrice = max(minPrice, subtotal) + setupFee
 */
export function computePrice(input: PricingInput): PricingBreakdown {
  const { sliced, hourlyRateCents, spoolPriceCents, spoolWeightG, setupFeeCents, minPriceCents, quantity } = input;
  const finishMultiplier = input.finishMultiplier ?? 1;
  const plasticMarkup = 1 + (input.plasticMarkupPercent ?? 0) / 100;

  if (!(sliced.printHours >= 0) || !(sliced.plasticGrams >= 0)) throw new PricingError("slicer result must be non-negative");
  if (!(hourlyRateCents >= 0)) throw new PricingError("hourlyRateCents must be non-negative");
  if (!(spoolWeightG > 0)) throw new PricingError("spoolWeightG must be positive");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new PricingError("quantity must be a positive integer");
  }

  const timeCostCents = Math.round(sliced.printHours * hourlyRateCents * finishMultiplier);
  const plasticCostCents = Math.round(
    ((sliced.plasticGrams * spoolPriceCents) / spoolWeightG) * plasticMarkup * finishMultiplier,
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
    printHoursPerUnit: sliced.printHours,
    printHoursTotal: sliced.printHours * quantity,
    plasticGramsTotal: sliced.plasticGrams * quantity,
  };
}
