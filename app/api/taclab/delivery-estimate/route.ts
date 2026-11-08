import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { quoteDeliveryFromLab } from "@/lib/labClient";
import { MAX_ORDER_QTY } from "@/lib/taclab/limits";
import { isRateLimited } from "@/lib/rateLimit";
import { getShopCatalog } from "@/lib/taclab/catalog";

const EstimateSchema = z.object({
  slug: z.string().max(100),
  qty: z.number().int().min(1).max(MAX_ORDER_QTY),
  // As it goes into an address line: "г Екатеринбург".
  city: z.string().trim().min(2).max(120),
});

// "Price with delivery to <city>" on a product page: CDEK to a pickup point in that city. A city
// alone gives the CRM calculator pickup points but no price, so the first point is priced - close
// enough for an estimate; the cart prices the customer's own point. Weight and price come from the
// catalog, never from the browser.
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: Estimate | null }>();
type Estimate = { totalRub: number; deliveryRub: number; daysMin: number | null; daysMax: number | null };

async function estimate(city: string, weightG: number, goodsTotalRub: number, items: { name: string; qty: number }[]): Promise<Estimate | null> {
  const base = { service: "СДЭК", address: city, weightG, goodsTotalRub, items };
  let quote = await quoteDeliveryFromLab(base);
  if (quote && !quote.price && quote.candidates.length > 0) {
    quote = await quoteDeliveryFromLab({ ...base, point: quote.candidates[0].id });
  }
  if (!quote?.price) return null;
  return {
    totalRub: Math.round(goodsTotalRub + quote.price.total),
    deliveryRub: Math.round(quote.price.total),
    daysMin: quote.price.period_min ?? null,
    daysMax: quote.price.period_max ?? null,
  };
}

export async function POST(request: NextRequest) {
  // Each miss is up to two CDEK calls.
  if (isRateLimited(request, "taclab-delivery-estimate", 40, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = EstimateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { slug, qty, city } = parsed.data;

  const { products } = await getShopCatalog();
  const product = products.find((p) => p.slug === slug);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const weightG = product.weightG * qty;
  const goodsTotalRub = product.priceRub * qty;

  const key = `${city.toLowerCase()}|${product.crmName}|${qty}|${weightG}|${goodsTotalRub}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ estimate: hit.value });
  const value = await estimate(city, weightG, goodsTotalRub, [{ name: product.crmName, qty }]);
  if (cache.size > 2000) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return NextResponse.json({ estimate: value });
}
