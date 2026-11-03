import type { Metadata } from "next";

import { ModelRequestClient } from "@/components/ModelRequestClient";
import { BRAND_NAME } from "@/lib/brand";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).requestPage;
  return { title: `${t.title} — ${BRAND_NAME}`, description: t.subtitle };
}

export default async function ModelRequestPage() {
  const dict = getDictionary(await getServerLocale());
  return <ModelRequestClient dict={dict} />;
}
