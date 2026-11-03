import { ContactsAdmin } from "@/components/ContactsAdmin";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getContacts } from "@/lib/settings";

export default async function AdminContactsPage() {
  const dict = getDictionary(await getServerLocale());
  const t = dict.admin;
  const contacts = await getContacts();

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">{t.contactsTitle}</h1>
      <p className="mt-1 text-sm text-muted">{t.contactsHint}</p>
      <div className="mt-6">
        <ContactsAdmin
          dict={dict}
          phones={contacts.phones.map((p) => p.label)}
          vkGroup={contacts.vkGroup}
          vkChat={contacts.vkChat}
        />
      </div>
    </div>
  );
}
