import { resolvePricing, type MaterialPricingRow, type ShopRates } from "./defaults";
import { computePrice, type PricingBreakdown } from "./engine";

/** The color's plastic as priced: Bambuddy's cost per kg, else its own spool price. */
export type PricedColor = { bambuddyCostPerKgCents: number | null; spoolPriceCents: number | null };

/**
 * What a gram of plastic costs, kopecks: the spool's cost per kg from Bambuddy when it has one,
 * otherwise the color's own spool price (e.g. a composite like ABS-CF15) or the material's.
 */
export function plasticCentsPerGram(
  material: MaterialPricingRow,
  color: PricedColor | null | undefined,
  rates: ShopRates,
): number {
  if (color?.bambuddyCostPerKgCents != null) return color.bambuddyCostPerKgCents / 1000;
  const pricing = resolvePricing(material, rates);
  return (color?.spoolPriceCents ?? pricing.spoolPriceCents) / pricing.spoolWeightG;
}

/** Price of the slicer's result for one material and color: the shop's hour rate + plastic. */
export function computeMaterialPrice(
  material: MaterialPricingRow,
  input: {
    sliced: { printHours: number; plasticGrams: number };
    finishMultiplier?: number;
    quantity: number;
  },
  color: PricedColor | null | undefined,
  rates: ShopRates,
): PricingBreakdown {
  const pricing = resolvePricing(material, rates);
  return computePrice({
    hourlyRateCents: pricing.hourlyRateCents,
    plasticMarkupPercent: pricing.plasticMarkupPercent,
    plasticCentsPerGram: plasticCentsPerGram(material, color, rates),
    ...input,
  });
}
