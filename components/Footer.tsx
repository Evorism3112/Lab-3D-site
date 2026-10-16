import Link from "next/link";

import { ContactLinks } from "@/components/ContactLinks";
import { BRAND_NAME } from "@/lib/brand";
import { hasContacts } from "@/lib/contacts";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getContacts } from "@/lib/settings";

export async function Footer() {
  const dict = getDictionary(await getServerLocale());
  const t = dict.footer;
  const contacts = await getContacts();
  const link = "transition-colors hover:text-accent";

  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-6 py-12 text-sm text-muted sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-base font-bold text-text">{BRAND_NAME}</p>
          <p className="mt-2 max-w-[320px]">{t.tagline}</p>
        </div>

        <div>
          <p className="font-semibold text-text">{t.navTitle}</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link href="/materials" className={link}>
                {dict.header.materials}
              </Link>
            </li>
            <li>
              <Link href="/works" className={link}>
                {dict.header.works}
              </Link>
            </li>
            <li>
              <Link href="/order/upload" className={link}>
                {dict.header.getQuote}
              </Link>
            </li>
            <li>
              <Link href="/order/request" className={link}>
                {t.request}
              </Link>
            </li>
            <li>
              <Link href="/faq" className={link}>
                {dict.header.faq}
              </Link>
            </li>
            <li>
              <Link href="/contacts" className={link}>
                {dict.header.contacts}
              </Link>
            </li>
          </ul>
        </div>

        {hasContacts(contacts) && (
          <div>
            <p className="font-semibold text-text">{t.contactsTitle}</p>
            <ContactLinks contacts={contacts} dict={dict} className="mt-3" />
          </div>
        )}
      </div>
      <div className="border-t border-border px-6 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {BRAND_NAME}
      </div>
    </footer>
  );
}
