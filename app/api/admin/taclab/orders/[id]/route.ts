import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { pushTaclabOrderToLab } from "@/lib/labClient";

type Item = { crmName: string; modelId: string | null; color: string; connector: string; quantity: number; priceRub: number };

/** Send an order the CRM didn't get (it was unreachable at checkout) once more. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await auth())?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const order = await prisma.taclabOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The CRM upserts by external id: a resend of an order it did get would replace its items (and the
  // serial numbers set there), so the admin offers this only for orders marked as not sent.
  if (order.sentToCrm) return NextResponse.json({ error: "Заказ уже в CRM" }, { status: 409 });
  const sent = await pushTaclabOrderToLab({ ...order, items: order.items as Item[] });
  if (!sent) return NextResponse.json({ error: "CRM не ответила" }, { status: 502 });
  await prisma.taclabOrder.update({ where: { id }, data: { sentToCrm: true } });
  return NextResponse.json({ ok: true });
}
