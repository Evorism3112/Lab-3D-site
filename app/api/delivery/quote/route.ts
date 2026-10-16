import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DELIVERY_SERVICES } from "@/lib/address";
import { quoteDeliveryFromLab } from "@/lib/labClient";
import { isRateLimited } from "@/lib/rateLimit";

const DeliveryQuoteSchema = z.object({
  service: z.enum(DELIVERY_SERVICES),
  address: z.string().trim().min(3).max(400),
  point: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(30).optional(),
  // From the item quote the customer already sees (/api/quote): plastic grams and the price.
  weightG: z.number().min(0).max(100_000),
  goodsTotalRub: z.number().min(0).max(10_000_000),
});

// Checkout delivery estimate — a proxy to the CRM calculator (lib/labClient.ts).
export async function POST(request: NextRequest) {
  // Each call hits the CDEK / Ozon APIs.
  if (isRateLimited(request, "delivery-quote", 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = DeliveryQuoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ quote: await quoteDeliveryFromLab(parsed.data) });
}
