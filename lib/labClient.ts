import { localizeCatalogText } from "@/lib/i18n/catalog";
import type { OrderDTO } from "@/lib/types";

// lab (D:\GitHub\lab) is the fulfillment/shipping tool — every paid order ends up there.
// Its own frontend talks to /api/orders without auth; this machine-to-machine channel
// (/api/external/orders) is separate and optionally protected by LAB_API_KEY.
const LAB_API_URL = process.env.LAB_API_URL;
const LAB_API_KEY = process.env.LAB_API_KEY;
const REQUEST_TIMEOUT_MS = 5000;

// Same fallback chain as app/api/checkout/session/route.ts — used to build an absolute,
// publicly reachable link to the uploaded model so lab staff can download it directly.
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function authHeaders(): Record<string, string> {
  return LAB_API_KEY ? { Authorization: `Bearer ${LAB_API_KEY}` } : {};
}

/** The parsed JSON reply, or null when lab is not configured, unreachable or answered with an error. */
async function callLab(path: string, init: RequestInit): Promise<unknown> {
  if (!LAB_API_URL) {
    console.error(`[labClient] LAB_API_URL is not configured, skipping ${path}`);
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
  /** A pickup point picked for the address, or null when several match — see candidates. */
  point: { id: string; label: string } | null;
  candidates: { id: string; label: string }[];
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
  weightG: number;
  goodsTotalRub: number;
}): Promise<DeliveryQuote | null> {
  const result = (await callLab("/api/external/delivery/quote", {
    method: "POST",
    body: JSON.stringify({
      delivery_service: input.service,
      pvz_address: input.address,
      point: input.point,
      phone: input.phone,
      items: [],
      items_weight_g: input.weightG,
      goods_total: input.goodsTotalRub,
    }),
  })) as (DeliveryQuote & { kind: string | null }) | null;
  if (!result?.kind) return null;
  return { point: result.point, candidates: result.candidates ?? [], price: result.price };
}
