import { localizeCatalogText } from "@/lib/i18n/catalog";
import { PRICE_ON_REQUEST_LEAD_DAYS } from "@/lib/pricing/options";
import type { OrderDTO } from "@/lib/types";

// lab (D:\GitHub\lab) is the fulfillment/shipping tool — every paid order ends up there.
// Its own frontend talks to /api/orders without auth; this machine-to-machine channel
// (/api/external/orders) is separate and optionally protected by LAB_API_KEY.
const LAB_API_URL = process.env.LAB_API_URL;
const LAB_API_KEY = process.env.LAB_API_KEY;
const REQUEST_TIMEOUT_MS = 5000;
// A delivery quote is several CDEK / Ozon calls (city, its pickup points - a big list in Moscow -
// then the tariff): 5 s cut it off, and the checkout showed no price at all.
const DELIVERY_QUOTE_TIMEOUT_MS = 25_000;

// Same fallback chain as app/api/checkout/session/route.ts — used to build an absolute,
// publicly reachable link to the uploaded model so lab staff can download it directly.
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function authHeaders(): Record<string, string> {
  return LAB_API_KEY ? { Authorization: `Bearer ${LAB_API_KEY}` } : {};
}

/** The parsed JSON reply, or null when lab is not configured, unreachable or answered with an error. */
async function callLab(path: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
  if (!LAB_API_URL) {
    console.error(`[labClient] LAB_API_URL is not configured, skipping ${path}`);
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${LAB_API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...init.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[labClient] ${path} failed: ${res.status} ${body}`);
      return null;
    }
    return await res.json().catch(() => null);
  } catch (err) {
    console.error(`[labClient] ${path} failed:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// shipping.address is already the whole line (city, street, house, extra — lib/address.ts);
// the postal code and country only go into the informational shipping_address.
function formatShippingAddress(shipping: OrderDTO["shipping"]): string {
  return [shipping.postal, shipping.address].filter(Boolean).join(", ");
}

// lab has no concept of files/materials/finishes — 3D-print items go in as free text
// (item_kind: "print") instead of the model/color/connector catalog used for the one
// physical product lab was originally built for.
function toLabPayload(order: OrderDTO) {
  return {
    external_order_id: order.id,
    customer_email: order.email,
    full_name: order.shipping.name,
    phone: order.shipping.phone,
    // The CRM form's carrier, and its pickup address, which it splits into
    // city / street / house / extra by itself.
    delivery_service: order.shipping.deliveryService,
    pvz_address: order.shipping.address,
    shipping_address: formatShippingAddress(order.shipping),
    // The estimate shown at checkout; staff confirm the exact amount with the customer.
    delivery_price: order.shipping.deliveryPrice ?? undefined,
    payment_status: "unpaid",
    // Items the slicer couldn't price go in at 0: staff agree the price (and the 2-day term).
    ...(order.items.some((item) => item.priceOnRequest)
      ? {
          notes: [
            `Цена не рассчитана слайсером — согласовать с клиентом. Срок изготовления: ${PRICE_ON_REQUEST_LEAD_DAYS} дня.`,
            ...order.items.filter((item) => item.priceOnRequest).map((item) => `• ${item.file.originalName}`),
          ].join("\n"),
        }
      : {}),
    // Lab staff work in Russian, so color/finish go over in Russian.
    items: order.items.map((item) => {
      const finishName = item.finish ? localizeCatalogText(item.finish.name, "ru", item.finish.nameRu) : null;
      const colorName = item.color
        ? localizeCatalogText(item.color.name, "ru", item.color.nameRu) + (item.color.variant ? ` (${item.color.variant})` : "")
        : null;
      return {
        item_kind: "print",
        // lab has no fields for print settings, so infill and scale travel in the product name.
        product_name: [
          item.material.name + (finishName ? ` — ${finishName}` : ""),
          item.infillPercent !== null ? `заполнение ${item.infillPercent}%` : null,
          item.scalePercent !== 100 ? `масштаб ${item.scalePercent}%` : null,
          item.priceOnRequest ? "ЦЕНА ПО ДОГОВОРЁННОСТИ" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        material: item.material.name,
        finish: finishName,
        color: colorName,
        source_file: item.file.originalName,
        source_file_url: `${APP_URL}/api/files/${item.file.id}/raw`,
        quantity: item.quantity,
        price: item.unitPriceCents / 100,
        external_ref: item.id,
      };
    }),
  };
}

/** Fire-and-forget: lab being unreachable must never block checkout/payment. */
export async function pushOrderToLab(order: OrderDTO): Promise<void> {
  await callLab("/api/external/orders", {
    method: "POST",
    body: JSON.stringify(toLabPayload(order)),
  });
}

export async function markOrderPaidInLab(orderId: string): Promise<void> {
  await callLab(`/api/external/orders/${encodeURIComponent(orderId)}/payment`, {
    method: "PATCH",
  });
}

/** A "no 3D model" request (/order/request) lands on the CRM board as a new order with an empty item list. */
export async function pushModelRequestToLab(request: {
  id: string;
  name: string;
  contact: string;
  description: string;
  photoCount: number;
}): Promise<void> {
  const isPhone = /^\+?[\d\s()-]{10,}$/.test(request.contact);
  const photos = Array.from(
    { length: request.photoCount },
    (_, i) => `${APP_URL}/api/requests/${request.id}/photos/${i}`,
  );
  await callLab("/api/external/orders", {
    method: "POST",
    body: JSON.stringify({
      external_order_id: `request-${request.id}`,
      full_name: request.name,
      phone: isPhone ? request.contact : "",
      payment_status: "unpaid",
      notes: [
        "Заявка с сайта «Нет 3D-модели»: нужно смоделировать и напечатать.",
        `Связь: ${request.contact}`,
        "",
        request.description,
        ...(photos.length ? ["", "Фото:", ...photos] : []),
      ].join("\n"),
      items: [],
    }),
  });
}

export type DeliveryQuote = {
  /** A pickup point picked for the address (the nearest one when coordinates were given), or null
   *  when several match — see candidates. label may carry the distance; address is the bare one. */
  point: { id: string; label: string; address?: string } | null;
  candidates: { id: string; label: string; address?: string }[];
  price: { total: number; period_min?: number | null; period_max?: number | null } | null;
};

/**
 * Delivery cost to a pickup point, calculated by lab with the same CDEK / Ozon settings and box
 * as its own order form. null when lab can't quote (carrier without a calculator, address not
 * found, lab unreachable) — the checkout then simply shows no estimate.
 */
export async function quoteDeliveryFromLab(input: {
  service: string;
  address: string;
  point?: string;
  phone?: string;
  /** The customer's address coordinates (from the address suggestions): the nearest pickup points. */
  lat?: number;
  lon?: number;
  weightG: number;
  goodsTotalRub: number;
  /** Shop products by CRM name: the CRM takes their standard box and sizes it for the count. */
  items?: { name: string; qty: number }[];
}): Promise<DeliveryQuote | null> {
  const result = (await callLab("/api/external/delivery/quote", {
    method: "POST",
    body: JSON.stringify({
      delivery_service: input.service,
      pvz_address: input.address,
      point: input.point,
      phone: input.phone,
      lat: input.lat,
      lon: input.lon,
      items: [],
      box_items: (input.items ?? []).map((i) => ({ product_name: i.name, quantity: i.qty })),
      items_weight_g: input.weightG,
      goods_total: input.goodsTotalRub,
    }),
  }, DELIVERY_QUOTE_TIMEOUT_MS)) as (DeliveryQuote & { kind: string | null }) | null;
  if (!result?.kind) return null;
  return { point: result.point, candidates: result.candidates ?? [], price: result.price };
}

/** The CRM's product catalog (Настройки → Каталог) for the TACLAB shop; prices in rubles. */
export type LabCatalog = {
  models: { id: string; label: string; code: string; revision: number }[];
  colors: { letter: string; label: string; shortLabel: string; swatch: string }[];
  connectors: { letter: string; label: string; plugLabel: string }[];
  /** photos: file names in the CRM (Настройки → Каталог → Фото), the first is the main one. */
  products: { label: string; model_id: string; price: number; weight_g: number; photos?: string[] }[];
};

/** null when lab is not configured, unreachable or too old to have /api/external/catalog. */
export async function fetchCatalogFromLab(): Promise<LabCatalog | null> {
  const data = (await callLab("/api/external/catalog", { method: "GET" })) as LabCatalog | null;
  return data && Array.isArray(data.products) ? data : null;
}

/**
 * A TACLAB shop order into the CRM as its own products ("hardware": model, color and connector
 * letters as in the CRM's order form), so stock, assembly and serial numbers work as for orders
 * taken by hand. Same external channel and source as the 3D-print site's orders. Returns whether
 * the CRM accepted it.
 */
export async function pushTaclabOrderToLab(order: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  deliveryService: string;
  address: string;
  deliveryPriceRub: number | null;
  comment: string | null;
  items: { crmName: string; modelId: string | null; color: string; connector: string; quantity: number; priceRub: number }[];
}): Promise<boolean> {
  const result = await callLab("/api/external/orders", {
    method: "POST",
    body: JSON.stringify({
      external_order_id: `taclab-${order.id}`,
      customer_email: order.email ?? "",
      full_name: order.name,
      phone: order.phone,
      delivery_service: order.deliveryService,
      pvz_address: order.address,
      shipping_address: order.address,
      delivery_price: order.deliveryPriceRub ?? undefined,
      payment_status: "unpaid",
      notes: ["Заказ с сайта TACLAB.", order.comment ? `Комментарий: ${order.comment}` : ""].filter(Boolean).join("\n"),
      items: order.items.map((item, i) => ({
        item_kind: "hardware",
        model_id: item.modelId ?? "",
        product_name: item.crmName,
        color: item.color,
        connector: item.connector,
        quantity: item.quantity,
        price: item.priceRub,
        external_ref: `taclab-${order.id}-${i + 1}`,
      })),
    }),
  });
  return result !== null;
}

/** A product photo from the CRM catalog; null when it's missing or the CRM is unreachable. */
export async function fetchLabProductPhoto(file: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!LAB_API_URL || !/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(file)) return null;
  try {
    const res = await fetch(`${LAB_API_URL}/api/external/catalog/photos/${file}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "image/jpeg" };
  } catch {
    return null;
  }
}

/**
 * CRM statuses of orders by external id ("taclab-…"): { label } or null when the CRM no longer has
 * the order (deleted there). null as a whole when the CRM can't be asked.
 */
export async function fetchOrderStatusesFromLab(
  externalIds: string[],
): Promise<Record<string, { status: string; label: string } | null> | null> {
  if (externalIds.length === 0) return {};
  const data = (await callLab(`/api/external/orders/statuses?ids=${externalIds.map(encodeURIComponent).join(",")}`, {
    method: "GET",
  })) as { statuses?: Record<string, { status: string; label: string } | null> } | null;
  return data?.statuses ?? null;
}
