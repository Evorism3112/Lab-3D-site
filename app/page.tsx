import Link from "next/link";

import { MaterialCard } from "@/components/MaterialCard";
import { PageBand } from "@/components/PageBand";
import { Reveal } from "@/components/Reveal";
import { ScrollParallax } from "@/components/ScrollParallax";
import { StatCounter } from "@/components/StatCounter";
import { TextMask } from "@/components/TextMask";
import { TiltFrame } from "@/components/TiltFrame";
import { getFarmSummary } from "@/lib/bambuddy";
import { listCatalogMaterials } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { getServerLocale } from "@/lib/i18n/locale";
import { daysWord, formatTemplate, getDictionary } from "@/lib/i18n/translations";

// The home page shows only the first row of the catalog; the rest is on /materials.
const HOME_MATERIALS = 3;
// A small order count puts people off more than no count at all; below this the printer farm
// (from Bambuddy) is shown instead.
const MIN_ORDERS_TO_SHOW = 50;

export default async function HomePage() {
  const dict = getDictionary(await getServerLocale());
  const { home } = dict;

  // Only what can be ordered right now (lib/colorSync.ts) — no out-of-stock plastics.
  const [materials, ordersCount, showcaseItems, reviews, farm] = await Promise.all([
    listCatalogMaterials(),
    prisma.order.count({ where: { status: { not: "DRAFT" } } }),
    prisma.showcaseItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 3,
      select: { id: true, title: true },
    }),
    prisma.review.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 6,
      select: { id: true, author: true, text: true, sourceUrl: true },
    }),
    getFarmSummary(),
  ]);
  const materialsCount = materials.length;
  const fastestLeadTime = materials.length > 0 ? Math.min(...materials.map((m) => m.leadTimeDays)) : 2;
  const showcaseSlots = [...showcaseItems, ...Array(Math.max(0, 3 - showcaseItems.length)).fill(null)];

  return (
    <div>
      <TiltFrame />
      <section
        id="hero"
        className="relative flex min-h-[calc(100vh-63px)] flex-col justify-between px-6 py-10"
      >
        <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-between">
          <div className="grid flex-1 grid-cols-1 items-center gap-10 pt-6 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <ScrollParallax>
                <Reveal>
                  <TextMask lightClassName="text-accent" darkClassName="text-[#0b1f0b]">
                    <p className="text-lg font-semibold uppercase tracking-[0.15em]">
                      {home.tag}
                    </p>
                    <h1 className="mt-3 max-w-2xl text-[clamp(34px,5vw,54px)] font-bold leading-[1.1]">
                      {home.title}
                    </h1>
                  </TextMask>
                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3.5">
                    <Link
                      href="/order/upload"
                      className="btn bg-[#0b1f0b] text-accent hover:shadow-[0_0_28px_rgba(11,31,11,0.5)]"
                    >
                      {home.cta}
                    </Link>
                    {/* A plain link: prefetching the route would create the sample file on every page view. */}
                    <a href="/order/sample" className="font-medium text-[#0b1f0b] underline underline-offset-4 hover:opacity-70">
                      {home.trySample} →
                    </a>
                  </div>
                </Reveal>
              </ScrollParallax>
            </div>

            <Reveal delayMs={100}>
              <div>
                <Link
                  href="/works"
                  className="text-xs font-medium uppercase tracking-[0.15em] text-white/60 transition-colors hover:text-white"
                >
                  {home.showcaseLabel} →
                </Link>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {showcaseSlots.map((item, i) =>
                    item ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={item.id}
                        src={`/api/showcase/${item.id}/raw`}
                        alt={item.title}
                        className="aspect-square w-full rounded-xl border border-white/20 object-cover"
                      />
                    ) : (
                      <div
                        key={`empty-${i}`}
                        className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-white/25 bg-black/10 text-center text-[11px] leading-tight text-white/50 backdrop-blur-sm"
                      >
                        {home.showcaseEmpty}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </Reveal>
          </div>

          <div className="w-full border-t border-white/15 pb-4 pt-6">
            <ScrollParallax>
              <Reveal delayMs={120}>
                <TextMask lightClassName="text-accent/90" darkClassName="text-[#0b1f0b]/90">
                  <p className="max-w-none text-lg leading-relaxed sm:text-xl">{home.subtitle}</p>
                </TextMask>
              </Reveal>
            </ScrollParallax>
          </div>
        </div>
      </section>

      <div className="relative isolate bg-bg">
        <PageBand />
        <div className="relative">
          <div className="divider" />

          <section className="px-6 py-[130px]">
            <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-start gap-14 md:grid-cols-[1.4fr_1fr]">
            <Reveal>
              <span className="tag">{home.aboutTag}</span>
              <h2 className="mt-4 text-[clamp(28px,4vw,40px)] font-bold text-text">
                {home.aboutTitle}
              </h2>
              <p className="mt-4 max-w-[560px] text-muted">{home.aboutText}</p>

              <div className="mt-7 flex flex-col">
                {home.features.map((f) => (
                  <div key={f.title} className="flex flex-col gap-0.5 border-t border-border py-4">
                    <strong className="text-text">{f.title}</strong>
                    <span className="text-sm text-muted">{f.text}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <div className="flex flex-col gap-4">
              <Reveal delayMs={0}>
                <div className="card flex flex-col gap-1 p-6">
                  <strong className="text-[30px] text-accent">
                    <StatCounter target={materialsCount} suffix="+" />
                  </strong>
                  <span className="text-sm text-muted">{home.statsMaterialsLabel}</span>
                </div>
              </Reveal>
              {ordersCount >= MIN_ORDERS_TO_SHOW ? (
                <Reveal delayMs={100}>
                  <div className="card flex flex-col gap-1 p-6">
                    <strong className="text-[30px] text-accent">
                      <StatCounter target={ordersCount} suffix="+" />
                    </strong>
                    <span className="text-sm text-muted">{home.statsOrdersLabel}</span>
                  </div>
                </Reveal>
              ) : (
                farm &&
                farm.total > 0 && (
                  <Reveal delayMs={100}>
                    <div className="card flex flex-col gap-1 p-6">
                      <strong className="text-[30px] text-accent">
                        <StatCounter target={farm.total} />
                      </strong>
                      <span className="text-sm text-muted">{home.statsPrintersLabel}</span>
                      {farm.printing > 0 && (
                        <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                          {formatTemplate(home.statsPrintingNow, farm.printing)}
                        </span>
                      )}
                    </div>
                  </Reveal>
                )
              )}
              <Reveal delayMs={200}>
                <div className="card flex flex-col gap-1 p-6">
                  <strong className="text-[30px] text-accent">{fastestLeadTime}</strong>
                  <span className="text-sm text-muted">
                    {home.statsTurnaroundLabel} ({daysWord(fastestLeadTime, dict.locale)})
                  </span>
                </div>
              </Reveal>
            </div>
          </div>
          </section>
        </div>

        <div className="divider" />

        <section className="px-6 py-[100px]">
          <Reveal>
            <div className="card mx-auto flex max-w-[1120px] flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
              <div className="max-w-[640px]">
                <span className="tag">{home.noModelTag}</span>
                <h2 className="mt-4 text-[clamp(24px,3vw,32px)] font-bold text-text">{home.noModelTitle}</h2>
                <p className="mt-3 text-muted">{home.noModelText}</p>
              </div>
              <Link href="/order/request" className="btn btn-primary shrink-0">
                {home.noModelCta}
              </Link>
            </div>
          </Reveal>
        </section>

        <div className="divider" />

        <section className="px-6 py-[130px]">
          <div className="mx-auto max-w-[1120px]">
            <Reveal>
              <span className="tag">{home.materialsTag}</span>
              <h2 className="mt-4 text-[clamp(28px,4vw,40px)] font-bold text-text">
                {formatTemplate(home.materialsTitle, materials.length)}
              </h2>
            </Reveal>

            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {materials.slice(0, HOME_MATERIALS).map((m, i) => (
                <Reveal key={m.id} delayMs={(i % 3) * 80}>
                  <MaterialCard material={m} dict={dict} />
                </Reveal>
              ))}
            </div>

            {materials.length > HOME_MATERIALS && (
              <div className="mt-10 flex justify-center">
                <Link href="/materials" className="btn btn-outline">
                  {home.materialsAll} →
                </Link>
              </div>
            )}
          </div>
        </section>

        {reviews.length > 0 && (
          <>
            <div className="divider" />
            <section className="px-6 py-[130px]">
              <div className="mx-auto max-w-[1120px]">
                <Reveal>
                  <span className="tag">{home.reviewsTag}</span>
                  <h2 className="mt-4 text-[clamp(28px,4vw,40px)] font-bold text-text">{home.reviewsTitle}</h2>
                </Reveal>
                <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {reviews.map((review, i) => (
                    <Reveal key={review.id} delayMs={(i % 3) * 80}>
                      <figure className="card flex h-full flex-col gap-4 p-6">
                        <blockquote className="flex-1 whitespace-pre-line text-sm leading-relaxed text-text">
                          {review.text}
                        </blockquote>
                        <figcaption className="flex items-center justify-between gap-3 text-xs text-muted">
                          <span>{review.author}</span>
                          {review.sourceUrl && (
                            <a
                              href={review.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="transition-colors hover:text-accent"
                            >
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
          </>
        )}

        <div className="divider" />

        <section className="px-6 py-[130px]">
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-5 md:grid-cols-3">
            {home.teasers.map((teaser, i) => (
              <Reveal key={teaser.href} delayMs={i * 100}>
                <Link
                  href={teaser.href}
                  className="card group flex h-full flex-col gap-2 p-6 transition-all hover:-translate-y-1.5 hover:border-accent/40"
                >
                  <strong className="text-text">{teaser.title}</strong>
                  <span className="text-sm text-muted">{teaser.text}</span>
                  <span className="mt-3 text-accent transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
