import { resolvePricing, type MaterialPricingRow, type ShopRates } from "./defaults";
import { computePrice, type PricingBreakdown } from "./engine";

type MaterialForPricing = MaterialPricingRow & {
  setupFeeCents: number;
  minPriceCents: number;
};

/**
 * Price of the slicer's result for one material: its stored (or recommended) rates + the shared
 * formula. A color with its own spool price (e.g. a composite like ABS-CF15) overrides the material's.
 */
export function computeMaterialPrice(
  material: MaterialForPricing,
  input: {
    sliced: { printHours: number; plasticGrams: number };
    finishMultiplier?: number;
    quantity: number;
  },
  color: { spoolPriceCents: number | null } | null | undefined,
  rates: ShopRates,
): PricingBreakdown {
  const pricing = resolvePricing(material, rates);
  return computePrice({
    hourlyRateCents: pricing.hourlyRateCents,
    plasticMarkupPercent: pricing.plasticMarkupPercent,
    spoolPriceCents: color?.spoolPriceCents ?? pricing.spoolPriceCents,
    spoolWeightG: pricing.spoolWeightG,
    setupFeeCents: material.setupFeeCents,
    minPriceCents: material.minPriceCents,
    ...input,
  });
}
