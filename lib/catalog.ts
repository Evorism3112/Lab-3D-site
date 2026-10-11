import { availableCatalog } from "@/lib/colorSync";
import { prisma } from "@/lib/db";
import { resolvePricing } from "@/lib/pricing/defaults";
import { COLOR_ORDER } from "@/lib/types";

/**
 * Materials customers can order right now (lib/colorSync.ts) with their in-stock colors,
 * cheapest per hour first — rates may be unset in the DB, so the order is by the resolved value.
 */
export async function listCatalogMaterials() {
  const available = await availableCatalog();
  const materials = await prisma.material.findMany({
    where: available.materials,
    include: { colors: { where: available.colors, orderBy: COLOR_ORDER } },
  });
  return materials
    .map((m) => ({ ...m, hourlyRateCents: resolvePricing(m).hourlyRateCents }))
    .sort((a, b) => a.hourlyRateCents - b.hourlyRateCents);
}

/** One orderable material by its slug, or null when it does not exist or is not offered now. */
export async function getCatalogMaterial(slug: string) {
  const available = await availableCatalog();
  const material = await prisma.material.findFirst({
    where: { ...available.materials, slug },
    include: { colors: { where: available.colors, orderBy: COLOR_ORDER } },
  });
  return material && { ...material, hourlyRateCents: resolvePricing(material).hourlyRateCents };
}
