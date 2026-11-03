import Link from "next/link";

import { Brackets } from "@/components/taclab/Brackets";
import { PhotoOrMark } from "@/components/taclab/PhotoOrMark";
import { ProductCard } from "@/components/taclab/ProductCard";
import { getShopBase } from "@/lib/taclab/base";
import { getShopCatalog } from "@/lib/taclab/catalog";
import { shopPath } from "@/lib/taclab/format";

const FEATURES = [
  { title: "Серийный номер", text: "На каждом изделии — по нему гарантия и история ревизий." },
  { title: "Гарантия", text: "Заменим или починим, если что-то пошло не так." },
  { title: "СДЭК и Ozon", text: "Стоимость доставки до пункта выдачи — сразу при оформлении." },
  { title: "Сделано в России", text: "Своя разработка и своё производство — от модели до упаковки." },
];

const STEPS = [
  { title: "Проектирование", text: "Модель, прототипы, испытания. Каждая доработка — новая ревизия: R01, R02, R03…" },
  { title: "Печать и сборка", text: "Печатаем на собственной ферме принтеров и собираем вручную." },
  { title: "Проверка и S/N", text: "Проверяем работу, присваиваем серийный номер и упаковываем." },
];

export default async function ShopHome() {
  const [base, { products, crmReachable }] = await Promise.all([getShopBase(), getShopCatalog()]);
  const hero = products.find((p) => p.photos.length > 0) ?? products[0];

  return (
    <>
      {/* Первый экран */}
      <section className="relative overflow-hidden border-b border-tl-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/taclab/icon-white.svg" alt="" aria-hidden className="pointer-events-none absolute -right-28 -top-16 w-[760px] opacity-[0.035]" />
        <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center gap-10 px-4 pb-14 pt-10 sm:px-8 md:gap-14 md:pb-24 md:pt-20">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-7">
            <p className="tl-mono text-xs tracking-[0.12em] text-tl-accent sm:text-[13px] sm:tracking-[0.14em]">TACLAB / СНАРЯЖЕНИЕ СОБСТВЕННОЙ РАЗРАБОТКИ</p>
            {/* 11vw: "ПРОЕКТИРУЕМ." still fits a 320 px phone. */}
            <h1 className="tl-display text-[clamp(38px,11vw,92px)] font-bold leading-[0.95]">
              Проектируем.
              <br />
              Печатаем.
              <br />
              Собираем сами.
            </h1>
            <p className="max-w-[520px] text-base leading-relaxed text-tl-soft sm:text-lg">
              Каждое изделие проходит проверку и получает серийный номер — по нему действует гарантия. Отправляем СДЭК и
              Ozon по всей России.
            </p>
            <div className="flex flex-wrap gap-3 [&>*]:flex-[1_1_auto] sm:[&>*]:flex-none">
              <Link href={`${shopPath(base)}#catalog`} className="tl-btn tl-btn-primary">
                Каталог →
              </Link>
              <Link href={`${shopPath(base)}#how`} className="tl-btn tl-btn-outline">
                Как мы делаем
              </Link>
            </div>
          </div>

          <div className="tl-frame aspect-square w-full min-w-0 max-w-[560px] flex-[1_1_440px]">
            {hero && <PhotoOrMark src={hero.photos[0]} alt={hero.name} markSize={96} eager />}
            <Brackets size={26} />
            {hero?.modelCode && (
              <>
                <div className="tl-mono absolute left-5 top-11 max-w-[70%] text-[11px] leading-relaxed text-tl-soft sm:left-7 sm:top-14 sm:text-xs">
                  <span className="text-tl-accent">{hero.modelCode}</span> · {hero.revision}
                  <br />
                  {hero.name.toUpperCase()}
                </div>
                <div className="tl-mono absolute bottom-11 right-5 text-right text-[11px] leading-relaxed text-tl-soft sm:bottom-14 sm:right-7 sm:text-xs">
                  СДЕЛАНО В РОССИИ
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section id="info" aria-label="Почему TACLAB" className="border-b border-tl-line">
        {/* Items with a top rule rather than side borders: they read right in 1, 2 or 4 columns. */}
        <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-x-8 gap-y-2 px-4 py-6 sm:px-8 md:py-10">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="flex flex-col gap-2 border-t border-tl-line py-5">
              <span className="tl-mono text-xs text-tl-accent">{String(i + 1).padStart(2, "0")}</span>
              <strong className="tl-display text-[22px] font-semibold">{f.title}</strong>
              <span className="text-sm leading-relaxed text-tl-muted">{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Каталог */}
      <section id="catalog" aria-labelledby="catalog-title" className="mx-auto max-w-[1240px] scroll-mt-4 px-4 py-14 sm:px-8 md:py-24">
        <div className="mb-7 flex flex-col gap-2.5 md:mb-9">
          <span className="tl-mono text-[13px] tracking-[0.14em] text-tl-accent">КАТАЛОГ</span>
          <h2 id="catalog-title" className="tl-display text-4xl font-bold leading-none sm:text-5xl">Изделия</h2>
        </div>
        {products.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4 sm:gap-5">
            {products.map((p) => (
              <ProductCard key={p.crmName} product={p} base={base} />
            ))}
          </div>
        ) : (
          <p className="text-tl-muted">
            {crmReachable ? "Каталог скоро появится." : "Каталог временно недоступен — загляните чуть позже."}
          </p>
        )}
      </section>

      {/* Как мы делаем */}
      <section id="how" aria-labelledby="how-title" className="border-y border-tl-line bg-tl-panel">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 py-14 sm:px-8 md:gap-10 md:py-24">
          <div className="flex flex-col gap-2.5">
            <span className="tl-mono text-[13px] tracking-[0.14em] text-tl-accent">ПРОИЗВОДСТВО</span>
            <h2 id="how-title" className="tl-display text-4xl font-bold leading-none sm:text-5xl">Как мы делаем</h2>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4 sm:gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 border border-tl-line p-5 sm:p-7">
                <span className="tl-mono text-xs text-tl-muted">ЭТАП {String(i + 1).padStart(2, "0")}</span>
                <strong className="tl-display text-[22px] font-semibold sm:text-[26px]">{s.title}</strong>
                <span className="text-[15px] leading-relaxed text-tl-soft">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
