export type FileDTO = {
  id: string;
  originalName: string;
  format: "STL" | "OBJ";
  sizeBytes: number;
  status: "ANALYZING" | "READY" | "ERROR";
  errorMessage: string | null;
  volumeCm3: number | null;
  bboxMm: { x: number; y: number; z: number } | null;
  triangleCount: number | null;
  createdAt: string;
};

/** `variant` is "" for the plain material, or a composite such as "ABS-CF15" shown as its own group. */
export type ColorDTO = { id: string; name: string; hex: string; variant: string };

/** Colors customers see: in-stock ones (lib/colorSync.ts), plain material first, then each variant. */
export const COLOR_ORDER = [{ variant: "asc" as const }, { id: "asc" as const }];
export type FinishDTO = { id: string; name: string; multiplier: number };

export type MaterialDTO = {
  id: string;
  /** "pla", "petg", … — also picks how the plastic looks in the 3D preview (lib/plasticLook.ts). */
  slug: string;
  name: string;
  description: string | null;
  /** Printer time, kopecks per hour. */
  hourlyRateCents: number;
  leadTimeDays: number;
  strength: number;
  flexibility: number;
  heatResistance: number;
  bestFor: string | null;
  imageUrl: string | null;
  colors: ColorDTO[];
  finishes: FinishDTO[];
};

/** Public URL of a material's illustration; the key doubles as a cache-buster. */
export function materialImageUrl(id: string, imageKey: string | null): string | null {
  return imageKey ? `/api/materials/${id}/image?v=${encodeURIComponent(imageKey)}` : null;
}

/**
 * A price comes only from the slicer. While it works the quote is "slicing" (ask again in a few
 * seconds); when it can't slice the model the order is still possible, but "on_request": staff
 * agree the price with the customer.
 */
export type QuoteDTO =
  | {
      status: "ready";
      /** Printing time of the whole order (hours) and plastic use (grams), from the slicer. */
      printHoursTotal: number;
      plasticGramsTotal: number;
      unitPriceCents: number;
      totalPriceCents: number;
      currency: string;
      leadTimeDays: number;
    }
  | { status: "slicing" }
  | {
      status: "on_request";
      leadTimeDays: number;
      /** Rough parcel weight for the delivery estimate only, grams. */
      plasticGramsTotal: number;
    };

export type OrderItemDTO = {
  id: string;
  quantity: number;
  /** Model size in % of the uploaded file. */
  scalePercent: number;
  /** Slicer infill in %; null on orders placed before it could be picked. */
  infillPercent: number | null;
  /** 0 when priceOnRequest. */
  unitPriceCents: number;
  totalPriceCents: number;
  /** The slicer couldn't price the model: staff agree the price with the customer. */
  priceOnRequest: boolean;
  file: { id: string; originalName: string; format: "STL" | "OBJ"; volumeCm3: number | null };
  material: { id: string; name: string };
  color: { id: string; name: string; nameRu: string | null; variant: string } | null;
  finish: { id: string; name: string; nameRu: string | null } | null;
};

export type OrderDTO = {
  id: string;
  status: string;
  email: string | null;
  shipping: {
    name: string | null;
    phone: string | null;
    /** Carrier as the CRM names it ("СДЭК", "Озон"). */
    deliveryService: string | null;
    /** The pickup point priced at checkout (CDEK code / Ozon id); null when none was. */
    deliveryPointId: string | null;
    /** Full delivery address line: city, street, house, extra (lib/address.ts). */
    address: string | null;
    city: string | null;
    postal: string | null;
    country: string | null;
    /** Delivery estimate at checkout, rubles; null when it couldn't be calculated. */
    deliveryPrice: number | null;
  };
  /** Sum of the priced items; items with priceOnRequest are not in it. */
  totalCents: number;
  items: OrderItemDTO[];
  createdAt: string;
  updatedAt: string;
};
