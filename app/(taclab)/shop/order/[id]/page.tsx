import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { getShopBase } from "@/lib/taclab/base";
import { rub, shopPath } from "@/lib/taclab/format";

export const metadata: Metadata = { title: "Заказ принят", robots: { index: false } };

type Item = { crmName: string; quantity: number; priceRub: number };

export default async function OrderDonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [base, order] = await Promise.all([getShopBase(), prisma.taclabOrder.findUnique({ where: { id } })]);
  // Ids are unguessable cuids: the page shows only what the customer just entered.
  if (!order) notFound();
  const items = (order.items as Item[]) ?? [];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 px-6 pb-24 pt-16 sm:px-8">
      <div className="flex flex-col gap-3">
        <span className="tl-mono text-[13px] tracking-[0.14em] text-tl-accent">ЗАКАЗ ПРИНЯТ</span>
        <h1 className="tl-display text-5xl font-bold leading-none">Спасибо, {order.name.split(" ")[0]}!</h1>
        <p className="text-lg leading-relaxed text-tl-soft">
          Мы свяжемся с вами по телефону {order.phone}, подтвердим заказ и договоримся об оплате.
        </p>
      </div>
      <div className="rounded-[2px] border border-tl-line">
        <ul>
          {items.map((it, i) => (
            <li key={i} className="flex justify-between gap-4 border-b border-tl-line px-5 py-4">
              <span>
                {it.crmName} <span className="tl-mono text-xs text-tl-muted">× {it.quantity}</span>
              </span>
              <span>{rub(it.priceRub * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 px-5 py-4 text-sm text-tl-muted">
          <span>
            {order.deliveryService}: {order.address}
          </span>
          {order.deliveryPriceRub !== null && <span>Доставка ≈ {rub(order.deliveryPriceRub)}</span>}
        </div>
      </div>
      <Link href={shopPath(base)} className="tl-btn tl-btn-outline self-start">
        На главную
      </Link>
    </div>
  );
}
