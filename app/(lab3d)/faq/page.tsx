import type { Metadata } from "next";
import Link from "next/link";

import { ContactLinks } from "@/components/ContactLinks";
import { BRAND_NAME } from "@/lib/brand";
import { hasContacts } from "@/lib/contacts";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getContacts } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).faqPage;
  return { title: `${t.title} — ${BRAND_NAME}`, description: t.subtitle };
}

export default async function FaqPage() {
  const dict = getDictionary(await getServerLocale());
  const t = dict.faqPage;
  const contacts = await getContacts();

  return (
    <div className="mx-auto max-w-[720px] px-6 py-16">
      <h1 className="text-[clamp(28px,4vw,40px)] font-bold text-text">{t.title}</h1>

      <div className="mt-8 flex flex-col">
        {t.items.map((item) => (
          <details key={item.q} className="group border-t border-border py-4 last:border-b">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-text">
              {item.q}
              <span className="text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-muted">{t.subtitle}</p>
      {hasContacts(contacts) && <ContactLinks contacts={contacts} dict={dict} className="mt-4 text-muted" />}

      <Link href="/order/upload" className="btn btn-primary mt-8">
        {dict.header.getQuote}
      </Link>
    </div>
  );
}
