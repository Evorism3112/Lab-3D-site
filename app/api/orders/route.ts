import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { CHECKOUT_SERVICES, formatAddressLine, PICKUP } from "@/lib/address";
import { availableCatalog } from "@/lib/colorSync";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@/lib/generated/prisma/client";
import { pushOrderToLab, quoteDeliveryFromLab } from "@/lib/labClient";
import { PricingError } from "@/lib/pricing/engine";
import { computeMaterialPrice } from "@/lib/pricing/material";
import { MAX_SCALE_PERCENT, MIN_SCALE_PERCENT, roughPlasticGrams, scaledVolume } from "@/lib/pricing/options";
import { getInfillOptions, getPickup, getShopRates } from "@/lib/settings";
import { serializeOrder } from "@/lib/serializers";
import { getSliceResult } from "@/lib/slicing";

const OrderStatusValues = Object.values(OrderStatus) as [string, ...string[]];

const OrderItemSchema = z.object({
  fileId: z.string(),
  materialId: z.string(),
  finishId: z.string().optional(),
  colorId: z.string().optional(),
  quantity: z.number().int().min(1).max(1000).default(1),
  scalePercent: z.number().int().min(MIN_SCALE_PERCENT).max(MAX_SCALE_PERCENT).default(100),
  // Must be one of the admin's infill levels; omitted = the default level.
  infillPercent: z.number().int().min(1).max(100).optional(),
});

const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1),
  email: z.string().email(),
  shipping: z.object({
    name: z.string().trim().min(1).max(200),
    // Digits, spaces, +, -, () — at least 10 digits (a Russian number without the country code).
    phone: z
      .string()
      .trim()
      .regex(/^[\d\s+()-]+$/)
      .refine((v) => v.replace(/\D/g, "").length >= 10),
    service: z.enum(CHECKOUT_SERVICES),
    // Not needed for pickup; required for a carrier (checked below). The checkout sends the whole
    // address in one line; city / street / house are the older form.
    address: z.string().trim().max(400).default(""),
    city: z.string().trim().max(200).default(""),
    street: z.string().trim().max(200).default(""),
    house: z.string().trim().max(50).default(""),
    extra: z.string().trim().max(200).optional(),
    postal: z.string().trim().max(20).optional(),
    // The pickup point the checkout delivery estimate was calculated for (CRM point id).
    deliveryPoint: z.string().trim().max(50).optional(),
  })
  .refine((s) => s.service === PICKUP || s.address.length >= 5 || (s.city && s.street && s.house), { path: ["address"] }),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { items, email, shipping } = parsed.data;
  const session = await auth();

  const resolvedItems: {
    fileId: string;
    materialId: string;
    finishId: string | null;
    colorId: string | null;
    quantity: number;
    scalePercent: number;
    infillPercent: number;
    unitPriceCents: number;
    totalPriceCents: number;
    priceOnRequest: boolean;
  }[] = [];
  let plasticGrams = 0;

  const [infill, rates] = await Promise.all([getInfillOptions(), getShopRates()]);
  const available = await availableCatalog();
  // Once colors come from the Bambuddy inventory, a color is required — it is what we have in stock.
  const colorRequired = Object.keys(available.colors).length > 0;
  for (const item of items) {
    const [file, material, finish, color] = await Promise.all([
      prisma.uploadedFile.findUnique({ where: { id: item.fileId } }),
      prisma.material.findFirst({ where: { id: item.materialId, ...available.materials } }),
      item.finishId ? prisma.finish.findUnique({ where: { id: item.finishId } }) : null,
      item.colorId ? prisma.color.findFirst({ where: { id: item.colorId, ...available.colors } }) : null,
    ]);

    if (!file || file.status !== "READY" || file.volumeCm3 === null) {
      return NextResponse.json({ error: `File ${item.fileId} is not ready` }, { status: 400 });
    }
    if (!material) {
      return NextResponse.json({ error: `Material ${item.materialId} not found` }, { status: 404 });
    }
    // The color may have run out between the quote and the order.
    if ((item.colorId || colorRequired) && (!color || color.materialId !== material.id)) {
      return NextResponse.json({ error: "Color is not available for this material" }, { status: 400 });
    }
    const infillPercent = item.infillPercent ?? infill.defaultLevel;
    if (!infill.levels.includes(infillPercent)) {
      return NextResponse.json({ error: "Infill level is not available" }, { status: 400 });
    }

    // The slicer's result when it is ready — the same one the quote showed; never waits for it.
    const slice = await getSliceResult(file, material, infillPercent, item.scalePercent, { enqueue: false });
    const base = {
      fileId: file.id,
      materialId: material.id,
      finishId: finish?.id ?? null,
      colorId: color?.id ?? null,
      quantity: item.quantity,
      scalePercent: item.scalePercent,
      infillPercent,
    };
    if (slice.status !== "ready") {
      // No slicer price: the order still goes through, staff agree the price with the customer.
      resolvedItems.push({ ...base, unitPriceCents: 0, totalPriceCents: 0, priceOnRequest: true });
      plasticGrams += roughPlasticGrams(scaledVolume(Number(file.volumeCm3), item.scalePercent)) * item.quantity;
      continue;
    }

    try {
      const breakdown = computeMaterialPrice(
        material,
        { sliced: slice, finishMultiplier: finish ? Number(finish.multiplier) : 1, quantity: item.quantity },
        color,
        rates,
      );
      resolvedItems.push({
        ...base,
        unitPriceCents: breakdown.unitPriceCents,
        totalPriceCents: breakdown.totalPriceCents,
        priceOnRequest: false,
      });
      plasticGrams += breakdown.plasticGramsTotal;
    } catch (err) {
      if (err instanceof PricingError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const totalCents = resolvedItems.reduce((sum, i) => sum + i.totalPriceCents, 0);
  // Pickup: the workshop's address, free; only while pickup is switched on.
  const isPickup = shipping.service === PICKUP;
  const pickup = isPickup ? await getPickup() : null;
  if (isPickup && !pickup) {
    return NextResponse.json({ error: "Pickup is not available" }, { status: 400 });
  }
  const addressLine = pickup ? pickup.address : shipping.address || formatAddressLine(shipping);

  // Recalculated here rather than taken from the browser, for the point the customer saw it for.
  const delivery = !isPickup && shipping.deliveryPoint
    ? await quoteDeliveryFromLab({
        service: shipping.service,
        address: addressLine,
        point: shipping.deliveryPoint,
        phone: shipping.phone,
        weightG: plasticGrams,
        goodsTotalRub: totalCents / 100,
      })
    : null;

  const order = await prisma.order.create({
    data: {
      userId: session?.user?.id,
      status: "AWAITING_PAYMENT",
      email,
      shippingName: shipping.name,
      shippingPhone: shipping.phone,
      deliveryService: shipping.service,
      deliveryPointId: delivery?.price && delivery.point?.id ? delivery.point.id : null,
      // One line the CRM splits into city / street / house / extra (lib/address.ts). With a pickup
      // point priced at checkout it is that point's address: the CRM finds the point by it, while the
      // customer's own street rarely has one.
      shippingAddress: delivery?.price && delivery.point?.address ? delivery.point.address : addressLine,
      shippingCity: isPickup ? null : shipping.city || addressLine.split(",")[0].trim() || null,
      shippingPostal: shipping.postal || null,
      shippingCountry: "Россия",
      deliveryPriceRub: isPickup ? 0 : delivery?.price ? Math.round(delivery.price.total) : null,
      totalCents,
      items: { create: resolvedItems },
    },
    include: { items: { include: { file: true, material: true, color: true, finish: true } } },
  });

  const serialized = serializeOrder(order);
  await pushOrderToLab(serialized);

  return NextResponse.json({ order: serialized }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? 25), 100);
  const cursor = searchParams.get("cursor");

  const statusResult = statusParam ? z.enum(OrderStatusValues).safeParse(statusParam) : null;
  if (statusParam && !statusResult?.success) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: statusResult?.data ? { status: statusResult.data as OrderStatus } : undefined,
    include: { items: { include: { file: true, material: true, color: true, finish: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  return NextResponse.json({
    orders: orders.map(serializeOrder),
    nextCursor: orders.length === limit ? orders[orders.length - 1].id : null,
  });
}
