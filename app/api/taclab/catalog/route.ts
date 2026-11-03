import { NextResponse } from "next/server";

import { getShopCatalog } from "@/lib/taclab/catalog";

// What the cart needs to show its lines: the published products with their current CRM prices.
export async function GET() {
  const { products, crmReachable } = await getShopCatalog();
  return NextResponse.json({
    crmReachable,
    products: products.map((p) => ({
      slug: p.slug,
      crmName: p.crmName,
      name: p.name,
      priceRub: p.priceRub,
      weightG: p.weightG,
      modelCode: p.modelCode,
      colors: p.colors,
      connectors: p.connectors,
      photo: p.photos[0] ?? null,
    })),
  });
}
