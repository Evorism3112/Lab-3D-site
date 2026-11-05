import Link from "next/link";

import { Reveal } from "@/components/Reveal";
import { UploadDropzone } from "@/components/UploadDropzone";
import { getFarmSummary } from "@/lib/bambuddy";
import { listCatalogMaterials } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { localizeCatalogText } from "@/lib/i18n/catalog";
import { getServerLocale } from "@/lib/i18n/locale";
import { formatTemplate, getDictionary } from "@/lib/i18n/translations";
import { getPickup } from "@/lib/settings";

const SHOWCASE_COUNT = 6;

const h2 = "font-display text-[clamp(26px,3.4vw,40px)] font-semibold text-text";

function Scale({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} className="block h-2 rounded bg-white/10">
      <span className="block h-2 rounded bg-accent" style={{ width: `${v}%` }} />
    </span>
  );
}

export default async function HomePage() {
  const dict = getDictionary(await getServerLocale());
  const { home } = dict;

  // Only what can be ordered right now (lib/colorSync.ts) — no out-of-stock plastics.
  const [materials, showcaseItems, reviews, farm, pickup] = await Promise.all([
    listCatalogMaterials(),
    prisma.showcaseItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: SHOWCASE_COUNT,
      select: { id: true, title: true },
    }),
    prisma.review.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 6,
      select: { id: true, author: true, text: true, sourceUrl: true },
    }),
    getFarmSummary(),
    getPickup(),
  ]);

  const steps = [
    { title: home.step1Title, text: home.step1Text },
    { title: home.step2Title, text: home.step2Text },
    { title: home.step3Title, text: pickup ? home.step3Text : home.step3TextNoPickup },
  ];

  return (
    <div>
      {/* Hero: the upload zone is right here, not a page away. */}
      <section className="px-6 pt-16 pb-14 md:pt-20 md:pb-20">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <span className="tag">{home.tag}</span>
            <h1 className="mt-5 max-w-[620px] font-display text-[clamp(34px,5vw,58px)] leading-[1.05] font-semibold text-text">
              {home.title}
            </h1>
            <p className="mt-5 max-w-[540px] text-lg leading-relaxed text-muted">{home.subtitle}</p>
            {farm && farm.total > 0 && (
              <p className="mt-7 inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-text">
                <span aria-hidden className="badge-dot h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" />
                {formatTemplate(formatTemplate(home.farmBusy, farm.printing), farm.total)}
              </p>
            )}
          </Reveal>

          <Reveal delayMs={100}>
            <div className="rounded-3xl border border-border bg-card p-3.5 shadow-[0_24px_60px_-28px_rgba(var(--accent-rgb),0.35)]">
              <UploadDropzone dict={dict} />
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 px-1.5 pt-3.5 pb-1 text-sm">
                {/* A plain link: prefetching the route would create the sample file on every page view. */}
                <a href="/order/sample" className="font-semibold text-accent hover:underline">
                  {home.trySample} →
                </a>
                <Link href="/order/request" className="text-muted transition-colors hover:text-accent">
                  {dict.upload.noModel}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why us — one strip. */}
      <section className="border-y border-border bg-card/60 px-6 py-8">
        <ul className="mx-auto grid max-w-[1200px] grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {home.features.map((f, i) => (
            <li key={f.title} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-soft font-mono text-[13px] text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-1">
                <strong className="text-text">{f.title}</strong>
                <span className="text-sm leading-relaxed text-muted">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {showcaseItems.length > 0 && (
        <section className="px-6 pt-24 pb-10">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                <h2 className={h2}>{home.worksTitle}</h2>
                <Link href="/works" className="font-semibold text-accent hover:underline">
                  {home.worksAll} →
                </Link>
              </div>
            </Reveal>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {showcaseItems.map((item, i) => (
                <Reveal key={item.id} delayMs={(i % 3) * 80}>
                  <Link href="/works" className="group block overflow-hidden rounded-2xl border border-border bg-card">
                    <span className="block overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/showcase/${item.id}/raw`}
                        alt={item.title}
                        className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </span>
                    <span className="block px-4 py-3.5 font-medium text-text">{item.title}</span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-20">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <h2 className={`${h2} mb-7`}>{home.howTitle}</h2>
          </Reveal>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} delayMs={i * 80}>
                <li className="card flex h-full flex-col gap-3 p-6">
                  <span className="font-display text-[34px] font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <strong className="text-lg text-text">{s.title}</strong>
                  <span className="text-[15px] leading-relaxed text-muted">{s.text}</span>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {materials.length > 0 && (
        <section className="px-6 pt-6 pb-20">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <h2 className={h2}>{formatTemplate(home.materialsTitle, materials.length)}</h2>
              <p className="mt-2 mb-6 text-muted">{home.materialsCompareText}</p>
            </Reveal>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[720px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-left font-mono text-xs tracking-[0.06em] text-muted uppercase">
                    <th scope="col" className="px-5 py-4 font-medium">{home.materialsColName}</th>
                    <th scope="col" className="px-3 py-4 font-medium">{home.materialsColUse}</th>
                    <th scope="col" className="w-[150px] px-3 py-4 font-medium">{home.materialsStrength}</th>
                    <th scope="col" className="w-[150px] px-3 py-4 font-medium">{home.materialsFlexibility}</th>
                    <th scope="col" className="w-[150px] py-4 pr-5 pl-3 font-medium">{home.materialsHeatResistance}</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id} className="border-t border-border transition-colors hover:bg-white/[0.03]">
                      <th scope="row" className="px-5 py-4 text-left">
                        <Link href={`/materials/${m.slug}`} className="font-display font-semibold text-text hover:text-accent">
                          {m.name}
                        </Link>
                      </th>
                      <td className="px-3 py-4 text-muted">{m.bestFor ? localizeCatalogText(m.bestFor, dict.locale) : "—"}</td>
                      <td className="px-3 py-4"><Scale value={m.strength} label={home.materialsStrength} /></td>
                      <td className="px-3 py-4"><Scale value={m.flexibility} label={home.materialsFlexibility} /></td>
                      <td className="py-4 pr-5 pl-3"><Scale value={m.heatResistance} label={home.materialsHeatResistance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <Link href="/materials" className="font-semibold text-accent hover:underline">
                {home.materialsAll} →
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="px-6 pb-20">
        <Reveal>
          <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 rounded-[28px] bg-accent p-8 text-[#0b120d] md:flex-row md:items-center md:justify-between md:p-11">
            <div className="max-w-[680px]">
              <h2 className="font-display text-[clamp(22px,2.8vw,32px)] font-semibold">{home.noModelTitle}</h2>
              <p className="mt-3 text-[17px] leading-relaxed opacity-85">{home.noModelText}</p>
            </div>
            <Link href="/order/request" className="btn shrink-0 bg-[#0b120d] text-accent hover:opacity-90">
              {home.noModelCta}
            </Link>
          </div>
        </Reveal>
      </section>

      {reviews.length > 0 && (
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <h2 className={`${h2} mb-7`}>{home.reviewsTitle}</h2>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review, i) => (
                <Reveal key={review.id} delayMs={(i % 3) * 80}>
                  <figure className="card flex h-full flex-col gap-4 p-6">
                    <blockquote className="flex-1 text-sm leading-relaxed whitespace-pre-line text-text">{review.text}</blockquote>
                    <figcaption className="flex items-center justify-between gap-3 text-xs text-muted">
                      <span>{review.author}</span>
                      {review.sourceUrl && (
                        <a href={review.sourceUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-accent">
                          {home.reviewSource}
                        </a>
                      )}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Phones: the main action stays one tap away while scrolling. */}
      <div className="mobile-cta fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[rgba(13,20,16,0.9)] p-3 backdrop-blur-md md:hidden">
        <Link href="/order/upload" className="btn btn-primary w-full">
          {home.cta}
        </Link>
      </div>
      <div aria-hidden className="h-20 md:hidden" />
    </div>
  );
}
