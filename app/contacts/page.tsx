import type { Metadata } from "next";
import Link from "next/link";

import { ContactLinks } from "@/components/ContactLinks";
import { BRAND_NAME } from "@/lib/brand";
import { hasContacts } from "@/lib/contacts";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getContacts } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).contactsPage;
  return { title: `${t.title} — ${BRAND_NAME}`, description: t.subtitle };
}

export default async function ContactsPage() {
  const dict = getDictionary(await getServerLocale());
  const t = dict.contactsPage;
  const contacts = await getContacts();

  return (
    <div className="mx-auto max-w-[720px] px-6 py-16">
      <h1 className="text-[clamp(28px,4vw,40px)] font-bold text-text">{t.title}</h1>
      <p className="mt-3 text-muted">{t.subtitle}</p>

      <div className="card mt-8 p-6">
        {hasContacts(contacts) ? (
          <ContactLinks contacts={contacts} dict={dict} className="text-lg text-muted" />
        ) : (
          <p className="text-muted">{t.empty}</p>
        )}
      </div>

      <Link href="/order/upload" className="btn btn-primary mt-8">
        {dict.header.getQuote}
      </Link>
    </div>
  );
}
