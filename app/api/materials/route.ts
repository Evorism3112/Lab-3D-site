import { NextResponse } from "next/server";

import { availableCatalog } from "@/lib/colorSync";
import { prisma } from "@/lib/db";
import { resolvePricing } from "@/lib/pricing/defaults";
import { getShopRates } from "@/lib/settings";
import { COLOR_ORDER, materialImageUrl } from "@/lib/types";

export async function GET() {
  const [available, rates] = await Promise.all([availableCatalog(), getShopRates()]);
  const materials = await prisma.material.findMany({
    where: available.materials,
    include: { colors: { where: available.colors, orderBy: COLOR_ORDER }, finishes: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    materials: materials.map((m) => {
      // The customer-facing numbers only — the markup and own-rate flag stay internal.
      const p = resolvePricing(m, rates);
      return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        description: m.description,
        hourlyRateCents: p.hourlyRateCents,
        printSpeedCm3PerHour: p.printSpeedCm3PerHour,
        spoolPriceCents: p.spoolPriceCents,
        spoolWeightG: p.spoolWeightG,
        densityGcm3: p.densityGcm3,
        infillPercent: p.infillPercent,
        setupFeeCents: m.setupFeeCents,
        minPriceCents: m.minPriceCents,
        leadTimeDays: m.leadTimeDays,
        strength: m.strength,
        flexibility: m.flexibility,
        heatResistance: m.heatResistance,
        bestFor: m.bestFor,
        imageUrl: materialImageUrl(m.id, m.imageKey),
        colors: m.colors.map((c) => ({ id: c.id, name: c.name, nameRu: c.nameRu, hex: c.hex, variant: c.variant })),
        finishes: m.finishes.map((f) => ({
          id: f.id,
          name: f.name,
          nameRu: f.nameRu,
          multiplier: Number(f.multiplier),
        })),
      };
    }),
  });
}
