import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CHECKOUT_SERVICES, PICKUP } from "@/lib/address";
import { prisma } from "@/lib/db";
import { pushTaclabOrderToLab, quoteDeliveryFromLab } from "@/lib/labClient";
import { isRateLimited } from "@/lib/rateLimit";
import { getPickup } from "@/lib/settings";
import { getShopCatalog } from "@/lib/taclab/catalog";

const OrderSchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().max(100),
        color: z.string().max(2),
        connector: z.string().max(2),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(30),
  name: z.string().trim().min(1).max(200),
  // Digits, spaces, +, -, () - at least 10 digits (a Russian number without the country code).
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s+()-]+$/)
    .refine((v) => v.replace(/\D/g, "").length >= 10),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  service: z.enum(CHECKOUT_SERVICES),
  // Empty for pickup (the workshop's address is used).
  address: z.string().trim().max(400),
  deliveryPoint: z.string().trim().max(50).optional(),
  comment: z.string().trim().max(1000).optional(),
});

// Places a shop order: prices and variants are checked against the CRM catalog (never taken from
// the browser), the order is saved here first and then sent to the CRM.
export async function POST(request: NextRequest) {
  if (isRateLimited(request, "taclab-order", 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много заказов подряд — попробуйте чуть позже." }, { status: 429 });
  }
  const parsed = OrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте имя, телефон и адрес." }, { status: 400 });
  }
  const data = parsed.data;
  // Pickup: the workshop's address, free; only while pickup is switched on.
  const isPickup = data.service === PICKUP;
  const pickup = isPickup ? await getPickup() : null;
  if (isPickup && !pickup) return NextResponse.json({ error: "Самовывоз сейчас недоступен." }, { status: 400 });
  if (!isPickup && data.address.length < 5) return NextResponse.json({ error: "Укажите адрес доставки." }, { status: 400 });
  const address = pickup ? pickup.address : data.address;

  const { products, crmReachable } = await getShopCatalog({ fresh: true });
  if (!crmReachable) {
    return NextResponse.json({ error: "Каталог временно недоступен — попробуйте через пару минут." }, { status: 503 });
  }
  const items = [];
  let weightG = 0;
  for (const line of data.items) {
    const p = products.find((x) => x.slug === line.slug);
    if (!p) return NextResponse.json({ error: "Одного из товаров больше нет в продаже — обновите корзину." }, { status: 409 });
    const color = p.colors.length ? p.colors.find((c) => c.letter === line.color) : undefined;
    const connector = p.connectors.length ? p.connectors.find((k) => k.letter === line.connector) : undefined;
    if ((p.colors.length && !color) || (p.connectors.length && !connector)) {
      return NextResponse.json({ error: `«${p.name}»: этого варианта больше нет — выберите заново.` }, { status: 409 });
    }
    items.push({
      crmName: p.crmName,
      modelId: p.modelId,
      color: color?.letter ?? "",
      connector: connector?.letter ?? "",
      quantity: line.qty,
      priceRub: p.priceRub,
    });
    weightG += p.weightG * line.qty;
  }
  const goodsTotalRub = items.reduce((sum, i) => sum + i.priceRub * i.quantity, 0);

  // Recalculated here for the point the customer saw it for, like the 3D-print checkout.
  const delivery = !isPickup && data.deliveryPoint
    ? await quoteDeliveryFromLab({
        service: data.service,
        address: data.address,
        point: data.deliveryPoint,
        phone: data.phone,
        weightG,
        goodsTotalRub,
      })
    : null;

  const order = await prisma.taclabOrder.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      deliveryService: data.service,
      address,
      deliveryPriceRub: isPickup ? 0 : delivery?.price ? Math.round(delivery.price.total) : null,
      goodsTotalRub: Math.round(goodsTotalRub),
      items,
      comment: data.comment || null,
    },
  });

  const sent = await pushTaclabOrderToLab({ ...order, items });
  if (sent) await prisma.taclabOrder.update({ where: { id: order.id }, data: { sentToCrm: true } });
  // The order is taken either way: if the CRM was down, the admin sends it again from the list.
  return NextResponse.json({ id: order.id }, { status: 201 });
}
