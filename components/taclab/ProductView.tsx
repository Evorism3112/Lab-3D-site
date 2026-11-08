"use client";

import Link from "next/link";
import { useState } from "react";

import { Brackets } from "@/components/taclab/Brackets";
import { DeliveryEstimate } from "@/components/taclab/DeliveryEstimate";
import { PhotoOrMark } from "@/components/taclab/PhotoOrMark";
import { addToCart } from "@/lib/taclab/cart";
import { MAX_ORDER_QTY } from "@/lib/taclab/limits";
import { rub, shopPath } from "@/lib/taclab/format";
import { serialPrefix, stockLabel, type ShopProduct } from "@/lib/taclab/product";

type Tab = "specs" | "compat" | "kit" | "delivery";

export function ProductView({ product: p, base }: { product: ShopProduct; base: string }) {
  const [shot, setShot] = useState(0);
  const [color, setColor] = useState(p.colors[0]?.letter ?? "");
  const [connector, setConnector] = useState(p.connectors[0]?.letter ?? "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // The cart already holds MAX_ORDER_QTY pieces (one box per order).
  const [cartFull, setCartFull] = useState(false);
  const tabs: { id: Tab; name: string; show: boolean }[] = [
    { id: "specs", name: "Характеристики", show: p.specs.length > 0 },
    { id: "compat", name: "Совместимость", show: Boolean(p.compatibility) },
    { id: "kit", name: "Комплект", show: Boolean(p.kit) },
    { id: "delivery", name: "Доставка и оплата", show: true },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const [tab, setTab] = useState<Tab>(visibleTabs[0].id);

  const colorName = p.colors.find((c) => c.letter === color)?.name;
  const serial = serialPrefix(p, color, connector);
  const changed = () => setAdded(false);

  return (
    <>
      <section className="mt-5 flex flex-wrap items-start gap-8 md:mt-7 md:gap-12">
        {/* Галерея */}
        <div className="flex w-full min-w-0 flex-[1_1_520px] flex-col gap-3">
          <div className="tl-frame aspect-square overflow-hidden">
            <PhotoOrMark src={p.photos[shot]} alt={`${p.name}${colorName ? `, ${colorName.toLowerCase()}` : ""}`} markSize={90} eager />
            <Brackets />
            {p.photos.length > 1 && (
              <span className="tl-mono absolute bottom-6 left-7 text-xs text-tl-soft">
                {String(shot + 1).padStart(2, "0")} / {String(p.photos.length).padStart(2, "0")}
              </span>
            )}
          </div>
          {p.photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2 sm:gap-3" role="group" aria-label="Фото изделия">
              {p.photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setShot(i)}
                  aria-label={`Фото ${i + 1}`}
                  aria-pressed={i === shot}
                  className="relative aspect-square cursor-pointer overflow-hidden rounded-[2px] bg-tl-card"
                  style={{ border: i === shot ? "2px solid var(--tl-accent)" : "1px solid var(--tl-line)" }}
                >
                  <PhotoOrMark src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Покупка */}
        <div className="flex w-full min-w-0 flex-[1_1_400px] flex-col gap-6">
          <div className="flex flex-col gap-3">
            {p.modelCode && (
              <span className="tl-mono text-[13px] tracking-[0.08em] text-tl-accent">
                {p.modelCode} · РЕВИЗИЯ {p.revision}
              </span>
            )}
            <h1 className="tl-display hyphens-auto break-words text-[clamp(30px,8vw,56px)] font-bold leading-[0.98]">{p.name}</h1>
            {p.tagline && <p className="text-base leading-relaxed text-tl-soft">{p.tagline}</p>}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3 border-b border-tl-line pb-6">
            <span className="tl-display text-[38px] font-semibold leading-none sm:text-[44px]">{rub(p.priceRub)}</span>
            <span className={`tl-mono inline-flex items-center gap-2 text-xs uppercase ${p.inStock ? "text-tl-accent" : "text-tl-muted"}`}>
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.inStock ? "var(--tl-accent)" : "var(--tl-muted)" }} />
              {stockLabel(p)}
            </span>
          </div>

          <DeliveryEstimate slug={p.slug} qty={qty} />

          {p.colors.length > 0 && (
            <fieldset className="flex flex-col gap-3">
              <legend className="tl-mono mb-3 text-xs tracking-[0.08em] text-tl-muted">
                ЦВЕТ — <span className="text-tl-text">{colorName?.toUpperCase()}</span>
              </legend>
              <div className="flex flex-wrap gap-2.5">
                {p.colors.map((c) => (
                  <button
                    key={c.letter}
                    type="button"
                    onClick={() => {
                      setColor(c.letter);
                      changed();
                    }}
                    aria-label={c.name}
                    aria-pressed={c.letter === color}
                    title={c.name}
                    className="h-12 w-12 cursor-pointer rounded-[2px] bg-transparent p-1"
                    style={{ border: c.letter === color ? "2px solid var(--tl-accent)" : "1px solid var(--tl-line-strong)" }}
                  >
                    <span className="block h-full w-full border border-white/20" style={{ background: c.swatch }} />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {p.connectors.length > 0 && (
            <fieldset className="flex flex-col gap-3">
              <legend className="tl-mono mb-3 text-xs tracking-[0.08em] text-tl-muted">РАЗЪЁМ</legend>
              <div className="grid grid-cols-2 gap-2.5">
                {p.connectors.map((k) => (
                  <button
                    key={k.letter}
                    type="button"
                    onClick={() => {
                      setConnector(k.letter);
                      changed();
                    }}
                    aria-pressed={k.letter === connector}
                    className="tl-display min-h-14 cursor-pointer rounded-[2px] px-4 text-left text-[19px] font-semibold"
                    style={{
                      background: k.letter === connector ? "#1b1d21" : "transparent",
                      border: k.letter === connector ? "2px solid var(--tl-accent)" : "1px solid var(--tl-line-strong)",
                    }}
                  >
                    {k.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-3">
            <div className="flex h-14 items-center rounded-[2px] border border-tl-line-strong" role="group" aria-label="Количество">
              <button type="button" onClick={() => { setQty(Math.max(1, qty - 1)); changed(); }} aria-label="Меньше" className="h-full w-12 cursor-pointer text-[22px]">
                −
              </button>
              <span className="tl-mono min-w-9 text-center" aria-live="polite">{qty}</span>
              <button type="button" onClick={() => { setQty(Math.min(MAX_ORDER_QTY, qty + 1)); changed(); }} aria-label="Больше" className="h-full w-12 cursor-pointer text-[22px]">
                +
              </button>
            </div>
            {added ? (
              <Link href={shopPath(base, "/cart")} className="tl-btn tl-btn-primary h-14 flex-[1_1_200px]">
                В корзине — оформить →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCartFull(!addToCart({ slug: p.slug, crmName: p.crmName, color, connector, qty }));
                  setAdded(true);
                }}
                className="tl-btn tl-btn-primary h-14 flex-[1_1_200px]"
              >
                В корзину
              </button>
            )}
          </div>
          {added && cartFull && (
            <p className="text-sm text-tl-muted">В одном заказе — до {MAX_ORDER_QTY} шт, корзина уже заполнена.</p>
          )}

          <ul className="flex flex-col gap-3 border-t border-tl-line pt-5 text-sm text-tl-soft">
            <li>СДЭК и Ozon до пункта выдачи — стоимость видна при оформлении</li>
            <li>Гарантия по серийному номеру</li>
            {serial && (
              <li>
                Серийный номер этого варианта начинается с <span className="tl-mono text-tl-text">{serial}</span>
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* Описание и вкладки */}
      <section className="mt-14 md:mt-20">
        {p.description && <p className="mb-10 max-w-[820px] whitespace-pre-line text-base leading-relaxed text-tl-soft md:mb-12">{p.description}</p>}
        <div role="tablist" aria-label="Описание изделия" className="-mx-4 flex gap-1 overflow-x-auto border-b border-white/10 px-4 sm:mx-0 sm:px-0">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              onClick={() => setTab(t.id)}
              className="tl-display -mb-px min-h-12 shrink-0 cursor-pointer whitespace-nowrap px-4 text-[17px] font-semibold tracking-[0.06em] sm:px-5 sm:text-[19px]"
              style={{
                borderBottom: t.id === tab ? "2px solid var(--tl-accent)" : "2px solid transparent",
                color: t.id === tab ? "var(--tl-text)" : "var(--tl-muted)",
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="max-w-[820px] overflow-x-auto pt-6 text-base leading-relaxed text-tl-soft md:pt-7">
          {tab === "specs" && (
            <table className="w-full border-collapse text-[15px]">
              <tbody>
                {p.specs.map((r) => (
                  <tr key={r.key} className="border-b border-tl-line">
                    <th scope="row" className="tl-mono w-2/5 py-3.5 pr-4 text-left align-top text-xs font-normal uppercase tracking-[0.08em] text-tl-muted sm:pr-6">
                      {r.key}
                    </th>
                    <td className="py-3.5 text-tl-text">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "compat" && <p className="whitespace-pre-line">{p.compatibility}</p>}
          {tab === "kit" && <p className="whitespace-pre-line">{p.kit}</p>}
          {tab === "delivery" && (
            <p>
              Доставка СДЭК и Ozon до пункта выдачи по всей России — стоимость считается при оформлении. После заказа мы
              свяжемся с вами, чтобы подтвердить его и договориться об оплате.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
