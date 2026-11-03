import type { Metadata } from "next";

import { CartCheckout } from "@/components/taclab/CartCheckout";
import { getShopBase } from "@/lib/taclab/base";

export const metadata: Metadata = { title: "Корзина" };

export default async function CartPage() {
  const base = await getShopBase();
  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-24 pt-10 sm:px-8">
      <h1 className="tl-display mb-8 text-5xl font-bold">Корзина</h1>
      <CartCheckout base={base} />
    </div>
  );
}
