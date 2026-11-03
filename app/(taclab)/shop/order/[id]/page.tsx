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
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 pb-16 pt-10 sm:px-8 md:pb-24 md:pt-16">
      <div className="flex flex-col gap-3">
        <span className="tl-mono text-[13px] tracking-[0.14em] text-tl-accent">ЗАКАЗ ПРИНЯТ</span>
        <h1 className="tl-display break-words text-4xl font-bold leading-none sm:text-5xl">Спасибо, {order.name.split(" ")[0]}!</h1>
        <p className="text-base leading-relaxed text-tl-soft sm:text-lg">
          Мы свяжемся с вами по телефону {order.phone}, подтвердим заказ и договоримся об оплате.
        </p>
      </div>
      <div className="rounded-[2px] border border-tl-line">
        <ul>
          {items.map((it, i) => (
            <li key={i} className="flex justify-between gap-4 border-b border-tl-line px-4 py-4 sm:px-5">
              <span>
                {it.crmName} <span className="tl-mono text-xs text-tl-muted">× {it.quantity}</span>
              </span>
              <span className="whitespace-nowrap">{rub(it.priceRub * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 break-words px-4 py-4 text-sm text-tl-muted sm:px-5">
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
