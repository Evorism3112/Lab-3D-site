import type { AddressSuggestion } from "@/lib/addressSuggest";
import { distanceKm } from "@/lib/geo";

/** Pickup as the checkout needs it (lib/settings.ts Pickup, passed down from the server). */
export type PickupInfo = { address: string; hours: string; lat: number | null; lon: number | null; radiusKm: number };

/**
 * How far the customer is from the workshop, km, when they are within its radius: measured from
 * the most precise point picked so far (house, else street, else the city centre). null when
 * farther, unknown, or pickup has no coordinates.
 */
export function pickupDistanceKm(pickup: PickupInfo | null, picked: (AddressSuggestion | null)[]): number | null {
  if (!pickup || pickup.lat === null || pickup.lon === null) return null;
  const point = picked.find((s) => s?.lat !== undefined && s?.lon !== undefined);
  if (!point) return null;
  const km = distanceKm({ lat: pickup.lat, lon: pickup.lon }, { lat: point.lat!, lon: point.lon! });
  return km <= pickup.radiusKm ? km : null;
}

/** "≈ 3 km" reads oddly below one: show at least 1. */
export const roundKm = (km: number) => Math.max(1, Math.round(km));
