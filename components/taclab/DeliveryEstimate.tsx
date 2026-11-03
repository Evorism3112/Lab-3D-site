"use client";

import { useEffect, useState } from "react";

import { AddressField } from "@/components/AddressField";
import { saveCity, useSavedCity } from "@/lib/taclab/city";
import { rub } from "@/lib/taclab/format";

type Estimate = { totalRub: number; deliveryRub: number; daysMin: number | null; daysMax: number | null };

const days = (e: Estimate) =>
  e.daysMax ? `${e.daysMin && e.daysMin !== e.daysMax ? `${e.daysMin}–${e.daysMax}` : e.daysMax} дн.` : "";

// "Price with delivery" to the visitor's city (CDEK to a pickup point), under the product price.
// The city is remembered for other products and the cart.
export function DeliveryEstimate({ slug, qty }: { slug: string; qty: number }) {
  const city = useSavedCity();
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ key: string; estimate: Estimate | null } | null>(null);

  const key = city ? `${city.withType}|${slug}|${qty}` : "";
  const loading = Boolean(key) && result?.key !== key;

  useEffect(() => {
    if (!key || !city) return;
    const controller = new AbortController();
    // A short pause so clicking +/− several times asks once.
    const timer = setTimeout(() => {
      fetch("/api/taclab/delivery-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ slug, qty, city: city.withType }),
      })
        .then((r) => (r.ok ? r.json() : { estimate: null }))
        .then((data) => setResult({ key, estimate: data.estimate ?? null }))
        .catch(() => {
          if (!controller.signal.aborted) setResult({ key, estimate: null });
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // key covers the city, product and quantity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!city || editing) {
    return (
      <div className="flex flex-col gap-2 rounded-[2px] border border-tl-line p-4">
        <span className="tl-mono text-xs tracking-[0.08em] text-tl-muted">ЦЕНА С ДОСТАВКОЙ</span>
        <AddressField
          label="Ваш город"
          level="city"
          placeholder="Например, Екатеринбург"
          value={typed}
          required={false}
          onChange={setTyped}
          onSelect={(s) => {
            saveCity(s);
            setTyped("");
            setEditing(false);
          }}
        />
        {editing && (
          <button type="button" onClick={() => setEditing(false)} className="self-start text-sm text-tl-muted hover:text-white">
            Отмена
          </button>
        )}
      </div>
    );
  }

  const estimate = result?.key === key ? result.estimate : null;
  return (
    <div className="flex flex-col gap-1.5 rounded-[2px] border border-tl-line p-4" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="tl-mono text-xs tracking-[0.08em] text-tl-muted">
          ЦЕНА С ДОСТАВКОЙ · <span className="text-tl-text">{city.value.toUpperCase()}</span>
        </span>
        <button type="button" onClick={() => setEditing(true)} className="min-h-8 text-sm text-tl-accent hover:underline">
          Другой город
        </button>
      </div>
      {loading ? (
        <span className="text-sm text-tl-muted">Считаем доставку…</span>
      ) : estimate ? (
        <>
          <span className="tl-display text-[30px] font-semibold leading-none">{rub(estimate.totalRub)}</span>
          <span className="text-sm text-tl-soft">
            СДЭК до пункта выдачи ≈ {rub(estimate.deliveryRub)}
            {days(estimate) && ` · ${days(estimate)}`}
          </span>
        </>
      ) : (
        <span className="text-sm text-tl-muted">Не удалось рассчитать доставку сюда — посчитаем при оформлении.</span>
      )}
    </div>
  );
}
