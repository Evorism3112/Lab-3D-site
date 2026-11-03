"use client";

import Link from "next/link";

import { useCart } from "@/lib/taclab/cart";
import { shopPath } from "@/lib/taclab/format";

export function CartLink({ base }: { base: string }) {
  const count = useCart().reduce((n, l) => n + l.qty, 0);
  return (
    <Link
      href={shopPath(base, "/cart")}
      className="flex h-11 items-center gap-2.5 rounded-[2px] border border-white/12 px-4 text-sm font-medium hover:border-white/30"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 8H6.2" />
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
      </svg>
      Корзина
      <span className="tl-mono rounded-[2px] bg-tl-accent px-[7px] py-0.5 text-xs text-tl-bg" aria-label={`товаров: ${count}`}>
        {count}
      </span>
    </Link>
  );
}
