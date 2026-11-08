"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";

import { AddressField } from "@/components/AddressField";
import { addToPrintCart, clearPrintCart, MAX_LINE_QTY, removeFromPrintCart, setPrintCartQty, usePrintCart, type PrintCartLine } from "@/lib/cart";
import { CHECKOUT_SERVICES, DELIVERY_SERVICES, PICKUP, type CheckoutService, type DeliveryService } from "@/lib/address";
import type { AddressSuggestion } from "@/lib/addressSuggest";
import { formatTemplate, type Dictionary } from "@/lib/i18n/translations";
import type { DeliveryQuote } from "@/lib/labClient";
import { formatAmount, formatCents } from "@/lib/money";
import { pickupDistanceKm, roundKm, type PickupInfo } from "@/lib/pickupNear";
import type { QuoteDTO } from "@/lib/types";

// Carriers the CRM can price (lab quoteDelivery); Russian Post is priced by hand.
const QUOTED_SERVICES: DeliveryService[] = ["СДЭК", "Озон"];
const DELIVERY_QUOTE_DELAY_MS = 800;
const CART_QUOTE_DELAY_MS = 400;

const noopSubscribe = () => () => {};
/** False during the server render and hydration: the cart is only known in the browser. */
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

const lineRequest = (l: PrintCartLine) => ({
  fileId: l.fileId,
  materialId: l.materialId,
  colorId: l.colorId,
  finishId: l.finishId,
  quantity: l.quantity,
  scalePercent: l.scalePercent,
  infillPercent: l.infillPercent,
});

function CheckoutForm({ dict, pickup }: { dict: Dictionary; pickup: PickupInfo | null }) {
  const t = dict.checkout;
  const router = useRouter();
  const tc = dict.cart;
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const lines = usePrintCart();

  // Old links (/order/checkout?fileId=…) carried one model: it goes into the cart.
  const legacyFileId = searchParams.get("fileId");
  useEffect(() => {
    const materialId = searchParams.get("materialId");
    if (!legacyFileId || !materialId) return;
    addToPrintCart({
      fileId: legacyFileId,
      fileName: "",
      materialId,
      materialName: "",
      colorId: searchParams.get("colorId") ?? undefined,
      finishId: searchParams.get("finishId") ?? undefined,
      quantity: Math.max(1, Number(searchParams.get("quantity")) || 1),
      scalePercent: Number(searchParams.get("scale")) || 100,
      infillPercent: Number(searchParams.get("infill")) || 0,
    });
    router.replace("/order/checkout");
  }, [legacyFileId, searchParams, router]);

  // Each line's price from the slicer, keyed by what was asked so a changed line is asked again.
  const [quotes, setQuotes] = useState<Record<string, { key: string; quote: QuoteDTO | null }>>({});
  const linesKey = JSON.stringify(lines.map((l) => [l.id, lineRequest(l)]));
  const lineQuote = (l: PrintCartLine) => {
    const q = quotes[l.id];
    return q && q.key === JSON.stringify(lineRequest(l)) ? q.quote : null;
  };
  const lineQuotes = lines.map(lineQuote);
  const anySlicing = lineQuotes.some((q) => !q || q.status === "slicing");
  const readyTotalCents = lineQuotes.reduce((sum, q) => sum + (q?.status === "ready" ? q.totalPriceCents : 0), 0);
  const anyOnRequest = lineQuotes.some((q) => q?.status === "on_request");
  const allOnRequest = lines.length > 0 && lineQuotes.every((q) => q?.status === "on_request");
  const gramsTotal = lineQuotes.reduce(
    (sum, q) => sum + (q && (q.status === "ready" || q.status === "on_request") ? q.plasticGramsTotal : 0),
    0,
  );
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    service: DELIVERY_SERVICES[0] as CheckoutService,
  });
  // The address in one line, plus the suggestion it came from (if any): its coordinates find the
  // nearest pickup point.
  const [addr, setAddr] = useState<{ text: string; picked: AddressSuggestion | null }>({ text: "", picked: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Delivery estimate from the CRM calculator; the point is the customer's pick when several match.
  const [delivery, setDelivery] = useState<{ key: string; quote: DeliveryQuote | null } | null>(null);
  const [deliveryPoint, setDeliveryPoint] = useState<{ key: string; id: string } | null>(null);

  // At least "city, street…" - a city alone gives the CRM nothing to price.
  const addressLine = addr.text.trim().replace(/[,\s]+$/, "");
  const addressReady = addressLine.length >= 5 && (Boolean(addr.picked) || addressLine.includes(","));
  const phoneDigits = form.phone.replace(/\D/g, "").length;
  // Ozon prices a parcel for a recipient phone, so it waits for one.
  // The parcel weight (and declared value) for the delivery estimate; none while the slicer works.
  const parcel = lines.length > 0 && !anySlicing ? { weightG: gramsTotal, goodsRub: readyTotalCents / 100 } : null;
  const isPickup = form.service === PICKUP;
  // A customer living near the workshop is offered pickup (free) as soon as their address says so.
  const nearKm = isPickup ? null : pickupDistanceKm(pickup, [addr.picked]);
  // Where the picked address is: the CRM offers the pickup points nearest to it.
  const geo = addr.picked?.lat !== undefined && addr.picked?.lon !== undefined ? addr.picked : undefined;
  const isQuotedService = QUOTED_SERVICES.includes(form.service as DeliveryService);
  const canQuoteDelivery =
    Boolean(parcel && addressReady) &&
    QUOTED_SERVICES.includes(form.service as DeliveryService) &&
    (form.service !== "Озон" || phoneDigits >= 10);
  const deliveryKey = canQuoteDelivery
    ? `${form.service}|${addressLine}|${form.service === "Озон" ? form.phone : ""}|${geo ? `${geo.lat},${geo.lon}` : ""}`
    : "";
  const pickedPoint = deliveryPoint?.key === deliveryKey ? deliveryPoint.id : undefined;
  const requestKey = `${deliveryKey}|${pickedPoint ?? ""}`;
  const currentDelivery = deliveryKey && delivery?.key === requestKey ? delivery.quote : null;
  const isQuotingDelivery = Boolean(deliveryKey) && delivery?.key !== requestKey;

  useEffect(() => {
    if (!deliveryKey || !parcel) return;
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
          weightG: parcel.weightG,
          goodsTotalRub: parcel.goodsRub,
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
    // requestKey covers the service, address, phone and point; parcel follows the cart's quotes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, parcel?.weightG, parcel?.goodsRub]);

  // Asked again while the slicer works on an exact price, so the order goes out at the price shown.
  const [pollTick, setPollTick] = useState(0);
  const slicingNow = lineQuotes.some((q) => q?.status === "slicing");
  useEffect(() => {
    if (!slicingNow) return;
    const timeout = setTimeout(() => setPollTick((n) => n + 1), 3000);
    return () => clearTimeout(timeout);
  }, [slicingNow, pollTick]);

  useEffect(() => {
    if (lines.length === 0) return;
    const controller = new AbortController();
    // A short pause so clicking +/− several times asks once.
    const timer = setTimeout(() => {
      for (const line of lines) {
        const key = JSON.stringify(lineRequest(line));
        fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          // 0 infill = an old link without one: the server's default level.
          body: JSON.stringify({ ...lineRequest(line), infillPercent: line.infillPercent || undefined }),
        })
          .then((res) => res.json())
          .then((data) =>
            setQuotes((prev) => {
              // An unchanged quote keeps its object, so polling doesn't re-run the delivery estimate.
              if (prev[line.id]?.key === key && JSON.stringify(prev[line.id].quote) === JSON.stringify(data.quote ?? null)) return prev;
              return { ...prev, [line.id]: { key, quote: data.quote ?? { status: "on_request", leadTimeDays: 0, plasticGramsTotal: 0 } } };
            }),
          )
          .catch(() => {
            if (!controller.signal.aborted) setError(t.quoteFailed);
          });
      }
    }, CART_QUOTE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // linesKey covers every line's settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, pollTick]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ ...lineRequest(l), infillPercent: l.infillPercent || undefined })),
          email: form.email,
          shipping: {
            name: form.name,
            phone: form.phone,
            service: form.service,
            address: isPickup ? "" : addressLine,
            postal: addr.picked?.postal,
            deliveryPoint: currentDelivery?.price ? currentDelivery.point?.id : undefined,
          },
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        const invalid = orderData.error?.fieldErrors;
        throw new Error(
          invalid?.shipping ? t.invalidShipping : typeof orderData.error === "string" ? orderData.error : t.invalidShipping,
        );
      }

      // Payment is disabled for now — the order is pushed to lab on creation and handled from there.
      clearPrintCart();
      router.push(`/order/thank-you?orderId=${orderData.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  if (!hydrated || legacyFileId) return null;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-text">{tc.title}</h1>
        <p className="mt-4 text-muted">{tc.empty}</p>
        <Link href="/order/upload" className="btn btn-primary mt-8">
          {tc.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-text">{tc.title}</h1>

      <ul className="mt-6 flex flex-col gap-3">
        {lines.map((line, i) => {
          const q = lineQuotes[i];
          const details = [
            line.materialName,
            line.colorName,
            line.finishName,
            line.infillPercent ? formatTemplate(tc.infill, `${line.infillPercent}%`) : null,
            line.scalePercent !== 100 ? formatTemplate(tc.scale, `${line.scalePercent}%`) : null,
          ].filter(Boolean);
          return (
            <li key={line.id} className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
              {line.colorHex && (
                <span aria-hidden className="h-8 w-8 shrink-0 rounded-full border border-border" style={{ background: line.colorHex }} />
              )}
              <div className="min-w-0 flex-1 basis-56">
                <Link href={`/order/configure/${line.fileId}`} className="block truncate font-medium text-text hover:text-accent">
                  {line.fileName || line.fileId}
                </Link>
                <p className="mt-0.5 text-xs text-muted">{details.join(" · ")}</p>
              </div>
              <div className="flex items-center rounded-lg border border-border">
                <button
                  type="button"
                  aria-label={tc.less}
                  onClick={() => setPrintCartQty(line.id, line.quantity - 1)}
                  disabled={line.quantity <= 1}
                  className="h-9 w-9 text-lg text-text disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-8 text-center font-mono text-sm text-text">{line.quantity}</span>
                <button
                  type="button"
                  aria-label={tc.more}
                  onClick={() => setPrintCartQty(line.id, line.quantity + 1)}
                  disabled={line.quantity >= MAX_LINE_QTY}
                  className="h-9 w-9 text-lg text-text disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <div className="w-32 text-right">
                {!q || q.status === "slicing" ? (
                  <span className="text-sm text-muted">…</span>
                ) : q.status === "ready" ? (
                  <>
                    <span className="block font-semibold text-text">≈ {formatCents(q.totalPriceCents, dict.locale)}</span>
                    {line.quantity > 1 && (
                      <span className="block text-xs text-muted">{formatTemplate(tc.perUnit, formatCents(q.unitPriceCents, dict.locale))}</span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-muted">{dict.configure.priceOnRequest}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeFromPrintCart(line.id)}
                className="text-xs text-muted transition-colors hover:text-danger"
              >
                {tc.remove}
              </button>
            </li>
          );
        })}
      </ul>
      <Link href="/order/upload" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
        + {tc.addAnother}
      </Link>

      <div className="card mt-6 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">{tc.itemsTotal}</span>
          <span className="text-xl font-semibold text-text">
            {anySlicing ? "…" : allOnRequest ? dict.configure.priceOnRequest : `≈ ${formatCents(readyTotalCents, dict.locale)}`}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">
          {anySlicing
            ? dict.configure.slicingNote
            : allOnRequest
              ? dict.configure.priceOnRequestNote
              : anyOnRequest
                ? tc.partlyOnRequest
                : dict.configure.estimateNote}
        </p>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-text">{t.title}</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label={t.email} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label={t.fullName} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field
          label={t.phone}
          type="tel"
          placeholder="+7 900 000-00-00"
          pattern="[\d\s+()\-]{10,}"
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
        />

        <div>
          <label className="block text-sm font-medium text-text">{t.deliveryService}</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {(pickup ? CHECKOUT_SERVICES : DELIVERY_SERVICES).map((s: CheckoutService) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, service: s })}
                className={`pill ${form.service === s ? "active" : ""}`}
              >
                {s === PICKUP ? t.pickupOption : s}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{isPickup ? t.pickupHint : t.deliveryHint}</p>
        </div>

        {isPickup && pickup && (
          <div className="card flex flex-col gap-1 p-4 text-sm">
            <p className="text-text">{formatTemplate(t.pickupAt, pickup.address)}</p>
            {pickup.hours && <p className="text-muted">{formatTemplate(t.pickupHours, pickup.hours)}</p>}
            <p className="text-accent">{t.pickupOption} — {t.pickupFree}</p>
          </div>
        )}

        {!isPickup && (
        <>

        <AddressField
          label={t.address}
          level="full"
          placeholder={t.addressPlaceholder}
          value={addr.text}
          onChange={(text) => setAddr({ text, picked: null })}
          // Short of the house: ", " so the customer types the house on and the list keeps going.
          onSelect={(s) => setAddr({ text: s.complete ? s.value : `${s.value}, `, picked: s })}
        />

        {nearKm !== null && (
          <div className="card flex flex-wrap items-center justify-between gap-3 border-accent p-4 text-sm">
            <div>
              <p className="font-medium text-text">{formatTemplate(t.pickupNearTitle, roundKm(nearKm))}</p>
              <p className="text-muted">{t.pickupNearText}</p>
            </div>
            <button type="button" onClick={() => setForm({ ...form, service: PICKUP })} className="btn btn-primary px-4 py-1.5 text-sm">
              {t.pickupNearButton}
            </button>
          </div>
        )}
        </>
        )}

        {!isPickup && isQuotedService && !addressReady && <p className="text-sm text-muted">{t.deliveryNeedAddress}</p>}
        {!isPickup && addressReady && form.service === "Озон" && phoneDigits < 10 && (
          <p className="text-sm text-muted">{t.deliveryNeedPhone}</p>
        )}
        {!isPickup && form.service === "Почта России" && <p className="text-sm text-muted">{t.deliveryManual}</p>}
        {isQuotingDelivery && <p className="text-sm text-muted">{t.deliveryCalculating}</p>}
        {!isQuotingDelivery && deliveryKey && !currentDelivery?.price && !currentDelivery?.candidates.length && (
          <p className="text-sm text-muted">{t.deliveryFailed}</p>
        )}
        {!isQuotingDelivery && currentDelivery && !currentDelivery.point && currentDelivery.candidates.length > 0 && (
          <div>
            <p className="text-sm text-text">{t.deliveryPickPoint}</p>
            <div className="mt-2 flex flex-col gap-2">
              {currentDelivery.candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDeliveryPoint({ key: deliveryKey, id: c.id })}
                  className="card px-3 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:text-text"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isQuotingDelivery && currentDelivery?.price && parcel && (
          <div className="card flex flex-col gap-1 p-4 text-sm">
            {currentDelivery.point && currentDelivery.candidates.length > 1 ? (
              <label className="mb-1 flex flex-col gap-1">
                <span className="text-xs text-muted">{t.deliveryPoint}</span>
                <select
                  value={currentDelivery.point.id}
                  onChange={(e) => setDeliveryPoint({ key: deliveryKey, id: e.target.value })}
                  className="w-full px-3 py-2 text-sm"
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
              currentDelivery.point && <p className="text-xs text-muted">{currentDelivery.point.label}</p>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-muted">
                {t.deliveryCost}
                {currentDelivery.price.period_max
                  ? ` · ${formatTemplate(
                      t.deliveryDays,
                      currentDelivery.price.period_min && currentDelivery.price.period_min !== currentDelivery.price.period_max
                        ? `${currentDelivery.price.period_min}–${currentDelivery.price.period_max}`
                        : currentDelivery.price.period_max,
                    )}`
                  : ""}
              </span>
              <span className="text-text">≈ {formatAmount(currentDelivery.price.total, dict.locale)}</span>
            </div>
            {/* No total when the print price is still to be agreed. */}
            {!anyOnRequest && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-muted">{t.deliveryTotal}</span>
                <span className="font-bold text-text">
                  ≈ {formatAmount(readyTotalCents / 100 + currentDelivery.price.total, dict.locale)}
                </span>
              </div>
            )}
            <p className="mt-1 text-xs text-muted">{t.deliveryNote}</p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={isSubmitting || anySlicing} className="btn btn-primary w-full">
          {isSubmitting ? t.redirecting : t.payNow}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  pattern,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  pattern?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text">{label}</label>
      <input
        required={required}
        type={type}
        placeholder={placeholder}
        pattern={pattern}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 text-sm"
      />
    </div>
  );
}

export function CheckoutClient({ dict, pickup }: { dict: Dictionary; pickup: PickupInfo | null }) {
  return (
    <Suspense fallback={null}>
      <CheckoutForm dict={dict} pickup={pickup} />
    </Suspense>
  );
}
