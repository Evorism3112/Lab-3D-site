import { CheckoutClient } from "@/components/CheckoutClient";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";
import { getPickup } from "@/lib/settings";

export default async function CheckoutPage() {
  const [dict, pickup] = await Promise.all([getServerLocale().then(getDictionary), getPickup()]);
  return <CheckoutClient dict={dict} pickup={pickup} />;
}
