import type { Metadata } from "next";

import { CartCheckout } from "@/components/taclab/CartCheckout";
import { getPickup } from "@/lib/settings";
import { getShopBase } from "@/lib/taclab/base";

export const metadata: Metadata = { title: "Корзина" };

export default async function CartPage() {
  const [base, pickup] = await Promise.all([getShopBase(), getPickup()]);
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-16 pt-6 sm:px-8 md:pb-24 md:pt-10">
      <h1 className="tl-display mb-6 text-4xl font-bold sm:mb-8 sm:text-5xl">Корзина</h1>
      <CartCheckout base={base} pickup={pickup} />
    </div>
  );
}
