import { ContactsAdmin } from "@/components/ContactsAdmin";
import { PickupAdmin } from "@/components/PickupAdmin";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getContacts, getSettings } from "@/lib/settings";

export default async function AdminContactsPage() {
  const dict = getDictionary(await getServerLocale());
  const t = dict.admin;
  const [contacts, p] = await Promise.all([
    getContacts(),
    // Raw values: the form shows them even while pickup is switched off.
    getSettings(["pickup.enabled", "pickup.address", "pickup.lat", "pickup.lon", "pickup.hours", "pickup.radiusKm"]),
  ]);
  const num = (raw: string) => (raw.trim() && Number.isFinite(Number(raw)) ? Number(raw) : null);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">{t.contactsTitle}</h1>
      <p className="mt-1 text-sm text-muted">{t.contactsHint}</p>
      <div className="mt-6">
        <ContactsAdmin
          dict={dict}
          phones={contacts.phones.map((ph) => ph.label)}
          vkGroup={contacts.vkGroup}
          vkChat={contacts.vkChat}
        />
      </div>
      <div className="mt-5">
        <PickupAdmin
          dict={dict}
          enabled={p["pickup.enabled"] === "1"}
          pickup={{
            address: p["pickup.address"],
            hours: p["pickup.hours"],
            lat: num(p["pickup.lat"]),
            lon: num(p["pickup.lon"]),
            radiusKm: num(p["pickup.radiusKm"]) ?? 30,
          }}
        />
      </div>
    </div>
  );
}
