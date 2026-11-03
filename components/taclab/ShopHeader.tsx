import Link from "next/link";

import { CartLink } from "@/components/taclab/CartLink";
import { shopPath } from "@/lib/taclab/format";

// Phone: logo and cart in the first row, the menu below as one scrollable line; from md up all
// three sit in one row.
export function ShopHeader({ base }: { base: string }) {
  return (
    <header className="border-b border-tl-line">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-3 sm:px-8 sm:py-4">
        <Link href={shopPath(base)} aria-label="TACLAB — на главную" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/taclab/logo-white.svg" alt="TACLAB" className="block h-7 w-auto sm:h-[34px]" />
        </Link>
        <nav
          aria-label="Основное меню"
          className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-x-6 overflow-x-auto whitespace-nowrap px-4 text-sm font-medium tracking-[0.02em] text-tl-soft md:order-none md:mx-0 md:w-auto md:gap-x-7 md:overflow-visible md:px-0"
        >
          <Link href={`${shopPath(base)}#catalog`} className="py-1 hover:text-white">Каталог</Link>
          <Link href={`${shopPath(base)}#how`} className="py-1 hover:text-white">Производство</Link>
          <Link href={`${shopPath(base)}#info`} className="py-1 hover:text-white">Доставка и гарантия</Link>
        </nav>
        <CartLink base={base} />
      </div>
    </header>
  );
}
