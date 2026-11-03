import Link from "next/link";

import { CartLink } from "@/components/taclab/CartLink";
import { shopPath } from "@/lib/taclab/format";

export function ShopHeader({ base }: { base: string }) {
  return (
    <header className="border-b border-tl-line">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-6 py-4 sm:px-8">
        <Link href={shopPath(base)} aria-label="TACLAB — на главную" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/taclab/logo-white.svg" alt="TACLAB" className="block h-[34px] w-auto" />
        </Link>
        <nav aria-label="Основное меню" className="flex flex-wrap gap-x-7 gap-y-2 text-sm font-medium tracking-[0.02em] text-tl-soft">
          <Link href={`${shopPath(base)}#catalog`} className="hover:text-white">Каталог</Link>
          <Link href={`${shopPath(base)}#how`} className="hover:text-white">Производство</Link>
          <Link href={`${shopPath(base)}#info`} className="hover:text-white">Доставка и гарантия</Link>
        </nav>
        <CartLink base={base} />
      </div>
    </header>
  );
}
