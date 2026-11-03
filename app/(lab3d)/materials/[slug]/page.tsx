import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatBar } from "@/components/MaterialCard";
import { BRAND_NAME } from "@/lib/brand";
import { getCatalogMaterial } from "@/lib/catalog";
import { localizeCatalogText } from "@/lib/i18n/catalog";
import { getServerLocale } from "@/lib/i18n/locale";
import { formatDays, formatTemplate, getDictionary } from "@/lib/i18n/translations";
import { formatAmount } from "@/lib/money";
import { materialImageUrl } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const dict = getDictionary(await getServerLocale());
  const material = await getCatalogMaterial(slug);
  if (!material) return {};
  return {
    title: `${formatTemplate(dict.materialsPage.metaTitle, material.name)} — ${BRAND_NAME}`,
    description: localizeCatalogText(material.description, dict.locale) ?? dict.materialsPage.subtitle,
  };
}

export default async function MaterialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dict = getDictionary(await getServerLocale());
  const { home, materialsPage: t } = dict;

  const m = await getCatalogMaterial(slug);
  if (!m) notFound();

  const imageUrl = materialImageUrl(m.id, m.imageKey);
  // The plain material first, then each composite (e.g. "ABS-CF15") as its own group.
  const variants = [...new Set(m.colors.map((c) => c.variant))];

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-16">
      <Link href="/materials" className="text-sm text-muted transition-colors hover:text-accent">
        {t.back}
      </Link>

      <div className="mt-6 grid grid-cols-1 items-start gap-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 className="text-[clamp(28px,4vw,40px)] font-bold text-text">
            {formatTemplate(t.metaTitle, m.name)}
          </h1>
          {m.description && (
            <p className="mt-4 max-w-[600px] text-muted">{localizeCatalogText(m.description, dict.locale)}</p>
          )}
          {m.bestFor && (
            <p className="mt-6 rounded-lg border border-border bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-text">
              <span className="text-muted">{home.materialsBestFor}</span> {localizeCatalogText(m.bestFor, dict.locale)}
            </p>
          )}

          {m.colors.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold text-text">{t.colorsTitle}</h2>
              {variants.map((variant) => (
                <div key={variant} className="mt-4">
                  {variant && <p className="mb-2 text-sm text-muted">{variant}</p>}
                  <ul className="flex flex-wrap gap-2">
                    {m.colors
                      .filter((c) => c.variant === variant)
                      .map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-text"
                        >
                          <span className="h-4 w-4 rounded-full border border-border" style={{ background: c.hex }} />
                          {localizeCatalogText(c.name, dict.locale, c.nameRu)}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card flex flex-col gap-5 p-6">
          {imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={imageUrl} alt={m.name} className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
          )}
          <div className="flex flex-col gap-2">
            <StatBar label={home.materialsStrength} value={m.strength} />
            <StatBar label={home.materialsFlexibility} value={m.flexibility} />
            <StatBar label={home.materialsHeatResistance} value={m.heatResistance} />
          </div>
          <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">{t.priceLabel}</dt>
              <dd className="text-text">
                {home.materialsPricePrefix}{" "}
                <span className="font-semibold">{formatAmount(m.hourlyRateCents / 100, dict.locale)}</span>{" "}
                {home.materialsPriceSuffix}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">{t.leadTimeLabel}</dt>
              <dd className="text-text">{formatDays(m.leadTimeDays, dict.locale)}</dd>
            </div>
          </dl>
          <Link href="/order/upload" className="btn btn-primary">
            {t.orderCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
