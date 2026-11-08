"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AddressField } from "@/components/AddressField";
import { PhotoOrMark } from "@/components/taclab/PhotoOrMark";
import { CHECKOUT_SERVICES, DELIVERY_SERVICES, PICKUP, type CheckoutService, type DeliveryService } from "@/lib/address";
import type { AddressSuggestion } from "@/lib/addressSuggest";
import type { DeliveryQuote } from "@/lib/labClient";
import { pickupDistanceKm, roundKm, type PickupInfo } from "@/lib/pickupNear";
import { clearCart, setQty, useCart, type CartLine } from "@/lib/taclab/cart";
import { savedCity } from "@/lib/taclab/city";
import { rub, shopPath } from "@/lib/taclab/format";
import type { ShopColor, ShopConnector } from "@/lib/taclab/product";

// Carriers the CRM can price (lab quoteDelivery); Russian Post is priced by hand.
const QUOTED_SERVICES: DeliveryService[] = ["СДЭК", "Озон"];
const DELIVERY_QUOTE_DELAY_MS = 800;

type CatalogItem = {
  slug: string;
  crmName: string;
  name: string;
  priceRub: number;
  weightG: number;
  modelCode: string | null;
  colors: ShopColor[];
  connectors: ShopConnector[];
  photo: string | null;
};

type Picked = { text: string; picked: AddressSuggestion | null };

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 px-3 py-2 text-sm"
      />
    </label>
  );
}

export function CartCheckout({ base, pickup }: { base: string; pickup: PickupInfo | null }) {
  const router = useRouter();
  const cart = useCart();
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", service: DELIVERY_SERVICES[0] as CheckoutService, comment: "" });
  // The address in one line. The city chosen on a product page (price with delivery) starts it off.
  // The form renders only once the cart is read in the browser, so this never meets server HTML.
  const [addr, setAddr] = useState<Picked>(() => {
    const saved = savedCity();
    return saved ? { text: `${saved.withType}, `, picked: null } : { text: "", picked: null };
  });
  const [delivery, setDelivery] = useState<{ key: string; quote: DeliveryQuote | null } | null>(null);
  const [deliveryPoint, setDeliveryPoint] = useState<{ key: string; id: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/taclab/catalog")
      .then((r) => r.json())
      .then((data: { products?: CatalogItem[]; crmReachable?: boolean }) => {
        setCatalog(data.products ?? []);
        setCatalogError(!data.crmReachable);
      })
      .catch(() => setCatalogError(true));
  }, []);

  // Cart lines with their current product data; a product no longer sold drops out of the order.
  const lines = cart.flatMap((line) => {
    const p = catalog?.find((x) => x.slug === line.slug);
    return p ? [{ line, p }] : [];
  });
  const missing = catalog ? cart.length - lines.length : 0;
  const goodsTotal = lines.reduce((sum, { line, p }) => sum + p.priceRub * line.qty, 0);
  const weightG = lines.reduce((sum, { line, p }) => sum + p.weightG * line.qty, 0);

  // At least "city, street…" - a city alone gives the CRM nothing to price.
  const addressLine = addr.text.trim().replace(/[,\s]+$/, "");
  const addressReady = addressLine.length >= 5 && (Boolean(addr.picked) || addressLine.includes(","));
  const phoneDigits = form.phone.replace(/\D/g, "").length;
  const isPickup = form.service === PICKUP;
  // A customer living near the workshop is offered pickup (free) as soon as their address says so.
  const nearKm = isPickup ? null : pickupDistanceKm(pickup, [addr.picked]);
  // Where the picked address is: the CRM offers the pickup points nearest to it.
  const geo = addr.picked?.lat !== undefined && addr.picked?.lon !== undefined ? addr.picked : undefined;
  const isQuotedService = QUOTED_SERVICES.includes(form.service as DeliveryService);
  // Ozon prices a parcel for a recipient phone, so it waits for one.
  const canQuote =
    lines.length > 0 &&
    addressReady &&
    QUOTED_SERVICES.includes(form.service as DeliveryService) &&
    (form.service !== "Озон" || phoneDigits >= 10);
  const deliveryKey = canQuote
    ? `${form.service}|${addressLine}|${form.service === "Озон" ? form.phone : ""}|${weightG}|${goodsTotal}|${geo ? `${geo.lat},${geo.lon}` : ""}`
    : "";
  const pickedPoint = deliveryPoint?.key === deliveryKey ? deliveryPoint.id : undefined;
  const requestKey = `${deliveryKey}|${pickedPoint ?? ""}`;
  const currentDelivery = deliveryKey && delivery?.key === requestKey ? delivery.quote : null;
  const quoting = Boolean(deliveryKey) && delivery?.key !== requestKey;

  useEffect(() => {
    if (!deliveryKey) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          service: form.service,
          address: addressLine,
          point: pickedPoint,
          phone: form.phone || undefined,
          lat: geo?.lat,
          lon: geo?.lon,
          weightG,
          goodsTotalRub: goodsTotal,
        }),
      })
        .then((res) => (res.ok ? res.json() : { quote: null }))
        .then((data) => setDelivery({ key: requestKey, quote: data.quote }))
        .catch(() => {
          if (!controller.signal.aborted) setDelivery({ key: requestKey, quote: null });
        });
    }, DELIVERY_QUOTE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // requestKey covers the service, address, phone, parcel and point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/taclab/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map(({ line }) => ({ slug: line.slug, color: line.color, connector: line.connector, qty: line.qty })),
          name: form.name,
          phone: form.phone,
          email: form.email,
          service: form.service,
          address: isPickup ? "" : addressLine,
          deliveryPoint: !isPickup && currentDelivery?.price ? currentDelivery.point?.id : undefined,
          comment: form.comment || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Не удалось оформить заказ.");
      clearCart();
      router.push(shopPath(base, `/order/${data.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось оформить заказ.");
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-start gap-6 py-10">
        <p className="text-lg text-tl-soft">Корзина пуста.</p>
        <Link href={`${shopPath(base)}#catalog`} className="tl-btn tl-btn-primary">
          В каталог →
        </Link>
      </div>
    );
  }

  const variantText = (line: CartLine, p: CatalogItem) =>
    [p.colors.find((c) => c.letter === line.color)?.name, p.connectors.find((k) => k.letter === line.connector)?.name]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="flex flex-wrap items-start gap-8 md:gap-12">
      {/* Товары */}
      <section aria-label="Товары" className="flex w-full min-w-0 flex-[1_1_480px] flex-col">
        {!catalog && !catalogError && <p className="text-tl-muted">Загружаем цены…</p>}
        {catalogError && <p className="text-tl-danger">Каталог временно недоступен — цены появятся, как только он ответит.</p>}
        {missing > 0 && (
          <p className="mb-4 text-sm text-tl-muted">Часть товаров из корзины больше не продаётся — они не попадут в заказ.</p>
        )}
        <ul className="flex flex-col border-t border-tl-line">
          {lines.map(({ line, p }) => (
            <li key={`${line.slug}|${line.color}|${line.connector}`} className="flex gap-3 border-b border-tl-line py-4 sm:gap-4 sm:py-5">
              <Link href={shopPath(base, `/p/${p.slug}`)} className="tl-frame relative h-20 w-20 flex-none overflow-hidden sm:h-24 sm:w-24">
                <PhotoOrMark src={p.photo} alt={p.name} markSize={36} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link href={shopPath(base, `/p/${p.slug}`)} className="tl-display hyphens-auto break-words text-lg font-semibold leading-tight hover:text-white sm:text-xl">
                  {p.name}
                </Link>
                {variantText(line, p) && <span className="tl-mono text-xs uppercase text-tl-muted">{variantText(line, p)}</span>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex h-11 items-center rounded-[2px] border border-tl-line-strong" role="group" aria-label="Количество">
                    <button type="button" onClick={() => setQty(line, line.qty - 1)} aria-label="Меньше" className="h-full w-11 cursor-pointer text-lg">
                      −
                    </button>
                    <span className="tl-mono min-w-8 text-center text-sm">{line.qty}</span>
                    <button type="button" onClick={() => setQty(line, line.qty + 1)} aria-label="Больше" className="h-full w-11 cursor-pointer text-lg">
                      +
                    </button>
                  </div>
                  <span className="tl-display text-xl font-semibold">{rub(p.priceRub * line.qty)}</span>
                </div>
              </div>
              <button type="button" onClick={() => setQty(line, 0)} aria-label={`Убрать «${p.name}»`} className="-mr-2 -mt-2 h-11 w-11 flex-none cursor-pointer text-tl-muted hover:text-white">
                ✕
              </button>
            </li>
          ))}
        </ul>
        {lines.length > 0 && (
          <div className="flex items-baseline justify-between gap-4 pt-5">
            <span className="tl-mono text-xs tracking-[0.08em] text-tl-muted">ТОВАРЫ</span>
            <span className="tl-display text-3xl font-semibold">{rub(goodsTotal)}</span>
          </div>
        )}
      </section>

      {/* Оформление */}
      <form onSubmit={submit} className="flex w-full min-w-0 flex-[1_1_380px] flex-col gap-4 rounded-[2px] border border-tl-line bg-tl-panel p-4 sm:p-6">
        <h2 className="tl-display text-2xl font-bold">Оформление</h2>
        <Field label="Имя и фамилия" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" />
        <Field label="Телефон" type="tel" value={form.phone} placeholder="+7 900 000-00-00" onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel" />
        <Field label="Email (необязательно)" type="email" required={false} value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" />

        <fieldset>
          <legend className="text-sm font-medium">Доставка</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(pickup ? CHECKOUT_SERVICES : DELIVERY_SERVICES).map((s: CheckoutService) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, service: s })}
                aria-pressed={form.service === s}
                className="min-h-11 cursor-pointer rounded-[2px] px-4 text-sm"
                style={{ border: form.service === s ? "2px solid var(--tl-accent)" : "1px solid var(--tl-line-strong)" }}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-tl-muted">
            {isPickup ? "Заберите заказ у нас в мастерской — бесплатно." : "До пункта выдачи: укажите адрес — подберём ближайший, его можно поменять."}
          </p>
        </fieldset>

        {isPickup && pickup && (
          <div className="flex flex-col gap-1 rounded-[2px] border border-tl-accent p-4 text-sm">
            <span className="tl-mono text-xs tracking-[0.08em] text-tl-accent">САМОВЫВОЗ · БЕСПЛАТНО</span>
            <span className="text-tl-text">{pickup.address}</span>
            {pickup.hours && <span className="text-tl-muted">{pickup.hours}</span>}
          </div>
        )}

        {!isPickup && (
        <>

        <AddressField
          label="Адрес доставки"
          level="full"
          placeholder="Москва, ул. Ленина, 5"
          value={addr.text}
          onChange={(text) => setAddr({ text, picked: null })}
          // Short of the house: ", " so the customer types the house on and the list keeps going.
          onSelect={(s) => setAddr({ text: s.complete ? s.value : `${s.value}, `, picked: s })}
        />

        {nearKm !== null && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-tl-accent p-4 text-sm">
            <div>
              <p className="font-medium text-tl-text">Вы примерно в {roundKm(nearKm)} км от нас</p>
              <p className="text-tl-muted">Можно забрать заказ самостоятельно — бесплатно.</p>
            </div>
            <button type="button" onClick={() => setForm({ ...form, service: PICKUP })} className="tl-btn tl-btn-primary min-h-11 text-base">
              Заберу сам
            </button>
          </div>
        )}
        </>
        )}

        {!isPickup && isQuotedService && !addressReady && (
          <p className="text-sm text-tl-muted">Укажите город, улицу и дом — подберём ближайший пункт выдачи и посчитаем доставку.</p>
        )}
        {!isPickup && addressReady && form.service === "Озон" && phoneDigits < 10 && (
          <p className="text-sm text-tl-muted">Ozon считает доставку по телефону получателя — укажите его выше.</p>
        )}
        {!isPickup && form.service === "Почта России" && (
          <p className="text-sm text-tl-muted">Доставку Почтой России считаем вручную — сообщим сумму, когда свяжемся.</p>
        )}
        {quoting && <p className="text-sm text-tl-muted">Считаем доставку…</p>}
        {!quoting && deliveryKey && !currentDelivery?.price && !currentDelivery?.candidates.length && (
          <p className="text-sm text-tl-muted">
            Не получилось рассчитать доставку по этому адресу. Проверьте его, выберите из подсказок или другую службу — или просто оформите заказ, посчитаем сами.
          </p>
        )}
        {!quoting && currentDelivery && !currentDelivery.point && currentDelivery.candidates.length > 0 && (
          <div>
            <p className="text-sm">Выберите пункт выдачи:</p>
            <div className="mt-2 flex flex-col gap-2">
              {currentDelivery.candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDeliveryPoint({ key: deliveryKey, id: c.id })}
                  className="cursor-pointer rounded-[2px] border border-tl-line-strong px-3 py-2 text-left text-sm text-tl-soft hover:border-tl-accent hover:text-white"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!quoting && currentDelivery?.price && (
          <div className="flex flex-col gap-1 rounded-[2px] border border-tl-line p-4 text-sm">
            {currentDelivery.point && currentDelivery.candidates.length > 1 ? (
              <label className="mb-1 flex flex-col gap-1">
                <span className="text-xs text-tl-muted">Пункт выдачи</span>
                <select
                  value={currentDelivery.point.id}
                  onChange={(e) => setDeliveryPoint({ key: deliveryKey, id: e.target.value })}
                  className="min-h-11 w-full px-3 py-2 text-sm"
                >
                  {!currentDelivery.candidates.some((c) => c.id === currentDelivery.point!.id) && (
                    <option value={currentDelivery.point.id}>{currentDelivery.point.label}</option>
                  )}
                  {currentDelivery.candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              currentDelivery.point && <p className="text-xs text-tl-muted">{currentDelivery.point.label}</p>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-tl-muted">
                Доставка
                {currentDelivery.price.period_max
                  ? ` · ${currentDelivery.price.period_min && currentDelivery.price.period_min !== currentDelivery.price.period_max ? `${currentDelivery.price.period_min}–${currentDelivery.price.period_max}` : currentDelivery.price.period_max} дн.`
                  : ""}
              </span>
              <span>≈ {rub(currentDelivery.price.total)}</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-tl-muted">Итого</span>
              <span className="tl-display text-xl font-semibold">≈ {rub(goodsTotal + currentDelivery.price.total)}</span>
            </div>
          </div>
        )}

        <label className="block">
          <span className="block text-sm font-medium">Комментарий (необязательно)</span>
          <textarea rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className="mt-1 px-3 py-2 text-sm" />
        </label>

        {error && <p className="text-sm text-tl-danger">{error}</p>}
        <button type="submit" disabled={submitting || lines.length === 0} className="tl-btn tl-btn-primary w-full">
          {submitting ? "Отправляем…" : `Оформить заказ · ${rub(goodsTotal)}`}
        </button>
        <p className="text-xs leading-relaxed text-tl-muted">
          После оформления мы свяжемся с вами, подтвердим заказ и договоримся об оплате. Стоимость доставки — предварительная.
        </p>
      </form>
    </div>
  );
}
