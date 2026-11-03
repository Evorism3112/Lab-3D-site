import Link from "next/link";

import type { Phone } from "@/lib/contacts";
import { shopPath } from "@/lib/taclab/format";

export function ShopFooter({ base, contacts }: { base: string; contacts: { phones: Phone[]; vk: string } }) {
  return (
    <footer className="mt-auto border-t border-tl-line">
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-8 px-6 py-12 sm:px-8">
        <div className="flex max-w-[360px] flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/taclab/logo-white.svg" alt="TACLAB" className="h-[30px] w-auto self-start" />
          <span className="text-sm leading-relaxed text-tl-muted">
            Производство —{" "}
            <a href="https://lab-3d.pro" className="border-b border-white/30 text-tl-text hover:border-white">
              Лаборатория 3Д
            </a>
          </span>
        </div>
        <div className="flex flex-wrap gap-12 text-sm leading-8">
          <div className="flex flex-col">
            <span className="tl-mono mb-1.5 text-xs text-tl-muted">МАГАЗИН</span>
            <Link href={`${shopPath(base)}#catalog`} className="hover:text-white">Каталог</Link>
            <Link href={shopPath(base, "/cart")} className="hover:text-white">Корзина</Link>
            <Link href={`${shopPath(base)}#info`} className="hover:text-white">Доставка и гарантия</Link>
          </div>
          {(contacts.phones.length > 0 || contacts.vk) && (
            <div className="flex flex-col">
              <span className="tl-mono mb-1.5 text-xs text-tl-muted">СВЯЗЬ</span>
              {contacts.phones.map((p) => (
                <a key={p.href} href={p.href} className="hover:text-white">
                  {p.label}
                </a>
              ))}
              {contacts.vk && (
                <a href={contacts.vk} className="hover:text-white">
                  ВКонтакте
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
