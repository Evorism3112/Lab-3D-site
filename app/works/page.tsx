import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/Reveal";
import { BRAND_NAME } from "@/lib/brand";
import { prisma } from "@/lib/db";
import { getServerLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/translations";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).worksPage;
  return { title: `${t.title} — ${BRAND_NAME}`, description: t.subtitle };
}

// Every showcase photo from the admin (/admin/showcase); the home page shows only the first three.
export default async function WorksPage() {
  const dict = getDictionary(await getServerLocale());
  const t = dict.worksPage;
  const items = await prisma.showcaseItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true },
  });

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-16">
      <h1 className="text-[clamp(28px,4vw,40px)] font-bold text-text">{t.title}</h1>
      <p className="mt-3 max-w-[640px] text-muted">{t.subtitle}</p>

      {items.length === 0 ? (
        <p className="mt-10 text-muted">{t.empty}</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.id} delayMs={(i % 3) * 80}>
              <figure className="card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/showcase/${item.id}/raw`}
                  alt={item.title}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                <figcaption className="px-5 py-4 text-sm text-text">{item.title}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      )}

      <Link href="/order/upload" className="btn btn-primary mt-10">
        {dict.header.getQuote}
      </Link>
    </div>
  );
}
