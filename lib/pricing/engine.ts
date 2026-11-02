export class PricingError extends Error {}

export type PricingInput = {
  /** What the slicer says one piece takes: printing time and plastic. */
  sliced: { printHours: number; plasticGrams: number };
  /** An hour of printing for the customer (work, printer and all), kopecks. */
  hourlyRateCents: number;
  /** What a gram of the plastic costs us, kopecks (from Bambuddy's cost per kg or the spool price). */
  plasticCentsPerGram: number;
  /** Finish price multiplier, e.g. 1 for standard, 1.15 for sanded. Defaults to 1. */
  finishMultiplier?: number;
  /** Markup on the plastic over its cost, %. Defaults to 0. */
  plasticMarkupPercent?: number;
  quantity: number;
};

export type PricingBreakdown = {
  unitPriceCents: number;
  totalPriceCents: number;
  timeCostCents: number;
  plasticCostCents: number;
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
 * unitPrice = (hours * hourlyRate + grams * plasticPerGram * (1 + markup%)) * finishMultiplier
 */
export function computePrice(input: PricingInput): PricingBreakdown {
  const { sliced, hourlyRateCents, plasticCentsPerGram, quantity } = input;
  const finishMultiplier = input.finishMultiplier ?? 1;
  const plasticMarkup = 1 + (input.plasticMarkupPercent ?? 0) / 100;

  if (!(sliced.printHours >= 0) || !(sliced.plasticGrams >= 0)) throw new PricingError("slicer result must be non-negative");
  if (!(hourlyRateCents >= 0)) throw new PricingError("hourlyRateCents must be non-negative");
  if (!(plasticCentsPerGram >= 0)) throw new PricingError("plasticCentsPerGram must be non-negative");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new PricingError("quantity must be a positive integer");
  }

  const timeCostCents = Math.round(sliced.printHours * hourlyRateCents * finishMultiplier);
  const plasticCostCents = Math.round(sliced.plasticGrams * plasticCentsPerGram * plasticMarkup * finishMultiplier);
  const unitPriceCents = timeCostCents + plasticCostCents;

  return {
    unitPriceCents,
    totalPriceCents: unitPriceCents * quantity,
    timeCostCents,
    plasticCostCents,
    printHoursPerUnit: sliced.printHours,
    printHoursTotal: sliced.printHours * quantity,
    plasticGramsTotal: sliced.plasticGrams * quantity,
  };
}
