import { ShopFooter } from "@/components/taclab/ShopFooter";
import { ShopHeader } from "@/components/taclab/ShopHeader";
import { getContacts } from "@/lib/settings";
import { getShopBase } from "@/lib/taclab/base";

// Shop chrome around every page; the base path depends on the domain (proxy.ts).
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [base, contacts] = await Promise.all([getShopBase(), getContacts()]);
  return (
    <>
      <ShopHeader base={base} />
      <main className="flex-1">{children}</main>
      <ShopFooter base={base} contacts={{ phones: contacts.phones, vk: contacts.vkGroup }} />
    </>
  );
}
