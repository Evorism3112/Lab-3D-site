import Image from "next/image";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MobileMenu } from "@/components/MobileMenu";
import { NavLink } from "@/components/NavLink";
import { BRAND_NAME } from "@/lib/brand";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getContacts } from "@/lib/settings";

export async function Header() {
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const { phones } = await getContacts();

  const links = (
    <>
      <NavLink href="/materials">{dict.header.materials}</NavLink>
      <NavLink href="/works">{dict.header.works}</NavLink>
      <NavLink href="/contacts">{dict.header.contacts}</NavLink>
    </>
  );
  const phone = phones[0] && (
    <a href={phones[0].href} className="whitespace-nowrap font-medium text-text transition-colors hover:text-accent">
      {phones[0].label}
    </a>
  );
  const quote = (
    <Link href="/order/upload" className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm">
      {dict.header.getQuote}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[rgba(10,10,10,0.7)] backdrop-blur-md">
      <div className="relative mx-auto flex max-w-[1120px] items-center justify-between gap-x-6 px-6 py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap text-base font-bold tracking-tight text-text sm:text-lg"
        >
          <Image src="/logo.svg" alt="" width={28} height={24} className="h-5 w-auto sm:h-6" />
          {BRAND_NAME}
        </Link>
        <nav className="hidden items-center gap-x-5 text-sm text-muted md:flex">
          {links}
          <span className="hidden lg:inline">{phone}</span>
          {quote}
          <LanguageSwitcher locale={locale} />
        </nav>
        <MobileMenu label={dict.header.menu}>
          {links}
          {phone}
          {quote}
          <LanguageSwitcher locale={locale} />
        </MobileMenu>
      </div>
    </header>
  );
}
