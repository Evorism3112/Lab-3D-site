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
        <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-6 pb-24 pt-20 sm:px-8">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-7">
            <p className="tl-mono text-[13px] tracking-[0.14em] text-tl-accent">TACLAB / СНАРЯЖЕНИЕ СОБСТВЕННОЙ РАЗРАБОТКИ</p>
            <h1 className="tl-display text-[clamp(52px,7vw,92px)] font-bold leading-[0.95]">
              Проектируем.
              <br />
              Печатаем.
              <br />
              Собираем сами.
            </h1>
            <p className="max-w-[520px] text-lg leading-relaxed text-tl-soft">
              Каждое изделие проходит проверку и получает серийный номер — по нему действует гарантия. Отправляем СДЭК и
              Ozon по всей России.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`${shopPath(base)}#catalog`} className="tl-btn tl-btn-primary">
                Каталог →
              </Link>
              <Link href={`${shopPath(base)}#how`} className="tl-btn tl-btn-outline">
                Как мы делаем
              </Link>
            </div>
          </div>

          <div className="tl-frame aspect-square min-w-0 max-w-[560px] flex-[1_1_440px]">
            {hero && <PhotoOrMark src={hero.photos[0]} alt={hero.name} markSize={96} eager />}
            <Brackets size={26} />
            {hero?.modelCode && (
              <>
                <div className="tl-mono absolute left-7 top-14 text-xs leading-relaxed text-tl-soft">
                  <span className="text-tl-accent">{hero.modelCode}</span> · {hero.revision}
                  <br />
                  {hero.name.toUpperCase()}
                </div>
                <div className="tl-mono absolute bottom-14 right-7 text-right text-xs leading-relaxed text-tl-soft">
                  СДЕЛАНО В РОССИИ
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section id="info" aria-label="Почему TACLAB" className="border-b border-tl-line">
        <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] px-6 sm:px-8">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="flex flex-col gap-2 border-tl-line py-8 pr-7 [&:not(:last-child)]:border-r [&:not(:first-child)]:pl-7">
              <span className="tl-mono text-xs text-tl-accent">{String(i + 1).padStart(2, "0")}</span>
              <strong className="tl-display text-[22px] font-semibold">{f.title}</strong>
              <span className="text-sm leading-relaxed text-tl-muted">{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Каталог */}
      <section id="catalog" aria-labelledby="catalog-title" className="mx-auto max-w-[1240px] px-6 py-24 sm:px-8">
        <div className="mb-9 flex flex-col gap-2.5">
          <span className="tl-mono text-[13px] tracking-[0.14em] text-tl-accent">КАТАЛОГ</span>
          <h2 id="catalog-title" className="tl-display text-5xl font-bold leading-none">Изделия</h2>
        </div>
        {products.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
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
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-6 py-24 sm:px-8">
          <div className="flex flex-col gap-2.5">
            <span className="tl-mono text-[13px] tracking-[0.14em] text-tl-accent">ПРОИЗВОДСТВО</span>
            <h2 id="how-title" className="tl-display text-5xl font-bold leading-none">Как мы делаем</h2>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 border border-tl-line p-7">
                <span className="tl-mono text-xs text-tl-muted">ЭТАП {String(i + 1).padStart(2, "0")}</span>
                <strong className="tl-display text-[26px] font-semibold">{s.title}</strong>
                <span className="text-[15px] leading-relaxed text-tl-soft">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
