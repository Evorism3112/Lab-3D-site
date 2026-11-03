import { prisma } from "@/lib/db";
import { fetchCatalogFromLab, type LabCatalog } from "@/lib/labClient";
import type { ShopProduct } from "@/lib/taclab/product";

export type { ShopProduct } from "@/lib/taclab/product";
export { serialPrefix, stockLabel } from "@/lib/taclab/product";

// The TACLAB shop catalog: the CRM's products (price, weight, model and its variants) merged with
// the shop's own content (TaclabProduct: copy, photos, visibility). The CRM stays the one place
// where prices are set; a product it doesn't list isn't sold, whatever the shop has for it.

const CACHE_MS = 60_000;
let cache: { at: number; value: LabCatalog | null } | null = null;

/** The CRM catalog, cached for a minute: every shop page needs it and it changes rarely. */
export async function labCatalog(fresh = false): Promise<LabCatalog | null> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = await fetchCatalogFromLab();
  // A failed fetch keeps the last good catalog rather than emptying the shop.
  if (value || !cache) cache = { at: Date.now(), value };
  return cache.value;
}

/** URL-safe slug from a product name ("Автоматический лоадер AL-1" → "avtomaticheskiy-loader-al-1"). */
export function slugify(name: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const slug = name
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 80) || "product";
}

function parseSpecs(text: string | null): { key: string; value: string }[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      return i > 0 ? { key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() } : { key: line, value: "" };
    });
}

/** Restrict to the listed letters; an empty list means all of them. */
function pick<T extends { letter: string }>(all: T[], letters: string): T[] {
  const wanted = letters.toUpperCase().replace(/[^A-Z]/g, "");
  return wanted ? all.filter((x) => wanted.includes(x.letter)) : all;
}

/**
 * Every CRM product with its shop content. `includeHidden` is for the admin: products not yet
 * published (or without content at all - they get a temporary slug) are listed too.
 */
export async function getShopCatalog({ includeHidden = false, fresh = false } = {}): Promise<{
  products: ShopProduct[];
  crmReachable: boolean;
}> {
  const [lab, rows] = await Promise.all([
    labCatalog(fresh),
    prisma.taclabProduct.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } } },
    }),
  ]);
  if (!lab) return { products: [], crmReachable: false };

  const byName = new Map(rows.map((r) => [r.crmName, r]));
  const products: ShopProduct[] = [];
  for (const p of lab.products) {
    const row = byName.get(p.label);
    if (!includeHidden && !row?.visible) continue;
    const model = lab.models.find((m) => m.id === p.model_id) ?? null;
    // Colors and connectors exist for the CRM's own models; other products have no variants.
    const colors = model
      ? pick(lab.colors, row?.colors ?? "").map((c) => ({ letter: c.letter, name: c.shortLabel || c.label, swatch: c.swatch }))
      : [];
    const connectors = model
      ? pick(lab.connectors, row?.connectors ?? "").map((c) => ({ letter: c.letter, name: c.plugLabel || c.label }))
      : [];
    products.push({
      slug: row?.slug ?? slugify(p.label),
      crmName: p.label,
      name: p.label,
      priceRub: p.price,
      weightG: p.weight_g,
      modelId: model?.id ?? null,
      modelCode: model?.code ?? null,
      revision: model ? `R${String(model.revision).padStart(2, "0")}` : null,
      colors,
      connectors,
      inStock: row?.inStock ?? true,
      leadTimeDays: row?.leadTimeDays ?? null,
      tagline: row?.tagline ?? null,
      description: row?.description ?? null,
      specs: parseSpecs(row?.specs ?? null),
      compatibility: row?.compatibility ?? null,
      kit: row?.kit ?? null,
      photoIds: row?.photos.map((ph) => ph.id) ?? [],
      visible: row?.visible ?? false,
    });
  }
  // Shop order: the admin's sort order for products with content, the CRM order for the rest.
  const rank = new Map(rows.map((r, i) => [r.crmName, i]));
  products.sort((a, b) => (rank.get(a.crmName) ?? 1e6) - (rank.get(b.crmName) ?? 1e6));
  return { products, crmReachable: true };
}

export async function getShopProduct(slug: string): Promise<ShopProduct | null> {
  const { products } = await getShopCatalog();
  return products.find((p) => p.slug === slug) ?? null;
}

