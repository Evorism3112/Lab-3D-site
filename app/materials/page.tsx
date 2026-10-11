import type { Metadata } from "next";

import { MaterialCard } from "@/components/MaterialCard";
import { Reveal } from "@/components/Reveal";
import { BRAND_NAME } from "@/lib/brand";
import { listCatalogMaterials } from "@/lib/catalog";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).materialsPage;
  return { title: `${t.title} — ${BRAND_NAME}`, description: t.subtitle };
}

export default async function MaterialsPage() {
  const dict = getDictionary(await getServerLocale());
  const t = dict.materialsPage;
  const materials = await listCatalogMaterials();

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-16">
      <span className="tag">{dict.home.materialsTag}</span>
      <h1 className="mt-4 text-[clamp(28px,4vw,40px)] font-bold text-text">{t.title}</h1>
      <p className="mt-3 max-w-[640px] text-muted">{t.subtitle}</p>

      {materials.length === 0 ? (
        <p className="mt-10 text-muted">{t.empty}</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m, i) => (
            <Reveal key={m.id} delayMs={(i % 3) * 80}>
              <MaterialCard material={m} dict={dict} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
