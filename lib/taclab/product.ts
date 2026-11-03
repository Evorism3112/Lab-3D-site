// Shop product shape and helpers safe for client components (no database access here).

export type ShopColor = { letter: string; name: string; swatch: string };
export type ShopConnector = { letter: string; name: string };

export type ShopProduct = {
  slug: string;
  crmName: string;
  name: string;
  priceRub: number;
  weightG: number;
  /** "AL1", revision 3 → "R03"; null for a product without a CRM model. */
  modelId: string | null;
  modelCode: string | null;
  revision: string | null;
  colors: ShopColor[];
  connectors: ShopConnector[];
  inStock: boolean;
  leadTimeDays: number | null;
  tagline: string | null;
  description: string | null;
  specs: { key: string; value: string }[];
  compatibility: string | null;
  kit: string | null;
  photoIds: string[];
  visible: boolean;
};

/** "AL1R03" + color + connector, as the CRM's serial numbers start (the last 4 digits come at assembly). */
export function serialPrefix(p: ShopProduct, color?: string, connector?: string): string | null {
  if (!p.modelCode || !p.revision) return null;
  return `${p.modelCode}${p.revision}${color ?? ""}${connector ?? ""}`;
}

/** What the customer sees for availability. */
export function stockLabel(p: ShopProduct): string {
  if (p.inStock) return "В наличии";
  return p.leadTimeDays ? `Под заказ · ${p.leadTimeDays} дн.` : "Под заказ";
}
