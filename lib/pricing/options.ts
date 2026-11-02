// Customer options on top of a material's pricing: model scale; and what a model the slicer
// can't price gets instead.

export const MIN_SCALE_PERCENT = 10;
export const MAX_SCALE_PERCENT = 500;

/** Scaling every side by s% scales the volume by (s/100)³. */
export function scaledVolume(volumeCm3: number, scalePercent: number): number {
  return volumeCm3 * (scalePercent / 100) ** 3;
}

/**
 * A model the slicer couldn't slice (doesn't fit the plate, Bambuddy down, no filament preset)
 * is still ordered, without a price: staff agree it with the customer, and it ships in this many days.
 */
export const PRICE_ON_REQUEST_LEAD_DAYS = 2;

/**
 * Rough weight of a model with no slicer result, grams: only for the delivery estimate (parcel
 * weight), never for a price. About 40% of a solid part is printed, at ~1.2 g/cm³.
 */
export function roughPlasticGrams(volumeCm3: number): number {
  return volumeCm3 * 0.5;
}
