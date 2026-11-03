import Link from "next/link";

import { CartLink } from "@/components/taclab/CartLink";
import { shopPath } from "@/lib/taclab/format";

// Phone: logo and cart in the first row, the menu below across the full width; from md up all
// three sit in one row.
export function ShopHeader({ base }: { base: string }) {
  return (
    <header className="border-b border-tl-line">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-3 sm:px-8 sm:py-4">
        <Link href={shopPath(base)} aria-label="TACLAB — на главную" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/taclab/logo-white.svg" alt="TACLAB" className="block h-7 w-auto sm:h-[34px]" />
        </Link>
        {/* Phone: a fixed row across the full width (no sideways scrolling) - the long item is
            shortened to fit 320 px; from sm up the full label. */}
        <nav
          aria-label="Основное меню"
          className="order-last flex w-full justify-between whitespace-nowrap text-sm font-medium tracking-[0.02em] text-tl-soft sm:justify-start sm:gap-x-7 md:order-none md:w-auto"
        >
          <Link href={`${shopPath(base)}#catalog`} className="py-2 hover:text-white">Каталог</Link>
          <Link href={`${shopPath(base)}#how`} className="py-2 hover:text-white">Производство</Link>
          <Link href={`${shopPath(base)}#info`} className="py-2 hover:text-white">
            Доставка<span className="hidden sm:inline"> и гарантия</span>
          </Link>
        </nav>
        <CartLink base={base} />
      </div>
    </header>
  );
}
