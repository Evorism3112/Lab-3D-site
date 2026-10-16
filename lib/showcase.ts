import type { Locale } from "@/lib/i18n/translations";
import { formatTemplate, getDictionary } from "@/lib/i18n/translations";
import { formatAmount } from "@/lib/money";

export type ShowcaseCaption = { material: string | null; printDays: number | null; priceRub: number | null };

/** "PETG · 2 дн. · 450 ₽" under a showcase photo; "" when nothing but the title was filled in. */
export function showcaseDetails(item: ShowcaseCaption, locale: Locale): string {
  const t = getDictionary(locale).worksPage;
  return [
    item.material,
    item.printDays ? formatTemplate(t.days, item.printDays) : null,
    item.priceRub ? formatAmount(item.priceRub, locale) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const SHOWCASE_SELECT = { id: true, title: true, material: true, printDays: true, priceRub: true } as const;
