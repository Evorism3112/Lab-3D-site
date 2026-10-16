import type { NextRequest } from "next/server";

// A crude per-address limit for public endpoints that cost something (CRM orders, uploads, carrier
// API calls). In memory: it resets on restart, which is fine for keeping one visitor from flooding.
const buckets = new Map<string, number[]>();

/** true = over the limit; otherwise the call is counted. */
export function isRateLimited(request: NextRequest, name: string, max: number, windowMs: number): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const key = `${name}:${ip}`;
  const now = Date.now();
  const times = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= max) {
    buckets.set(key, times);
    return true;
  }
  times.push(now);
  buckets.set(key, times);
  return false;
}
