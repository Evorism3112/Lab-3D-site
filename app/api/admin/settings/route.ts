import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { MAX_PHONES, normalizeVkUrl, parsePhone } from "@/lib/contacts";
import { setSetting } from "@/lib/settings";
import { BED_TYPES } from "@/lib/slicerPresets";

const PresetSchema = z.object({
  source: z.enum(["orca_cloud", "cloud", "local", "standard"]),
  id: z.string().min(1).max(300),
  name: z.string().max(300),
});

const SettingsSchema = z
  .object({
    minStockGrams: z.number().int().min(0).max(100_000).optional(),
    infillLevels: z.array(z.number().int().min(1).max(100)).min(1).max(10).optional(),
    defaultInfill: z.number().int().min(1).max(100).optional(),
    contacts: z
      .object({
        phones: z.array(z.string().max(40)).max(MAX_PHONES),
        vkGroup: z.string().max(200),
        vkChat: z.string().max(200),
      })
      .optional(),
    // Pickup from the workshop (lib/settings.ts getPickup).
    pickup: z
      .object({
        enabled: z.boolean(),
        address: z.string().trim().max(300),
        lat: z.number().min(-90).max(90).nullable(),
        lon: z.number().min(-180).max(180).nullable(),
        hours: z.string().trim().max(300),
        radiusKm: z.number().min(1).max(1000),
      })
      .refine((p) => !p.enabled || p.address.length > 0)
      .optional(),
    // Shop-wide pricing: rubles per hour and markup %.
    pricing: z
      .object({
        laborPerHour: z.number().min(0).max(1_000_000),
        plasticMarkupPercent: z.number().min(0).max(1000),
      })
      .optional(),
    // Slicer quotes (lib/slicing.ts): no printer or process turns them off.
    slicer: z
      .object({
        printer: PresetSchema.nullable(),
        process: PresetSchema.nullable(),
        filaments: z.record(z.string(), PresetSchema),
        // "" = the process preset's own plate.
        bedType: z.union([z.enum(BED_TYPES), z.literal("")]).optional(),
      })
      .optional(),
  })
  // The default must be one of the levels offered to customers.
  .refine((v) => v.defaultInfill === undefined || !v.infillLevels || v.infillLevels.includes(v.defaultInfill));

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid values" }, { status: 400 });
  }

  if (parsed.data.minStockGrams !== undefined) {
    await setSetting("bambuddy.minStockGrams", String(parsed.data.minStockGrams));
  }
  if (parsed.data.infillLevels !== undefined) {
    const levels = [...new Set(parsed.data.infillLevels)].sort((a, b) => a - b);
    await setSetting("order.infillLevels", levels.join(","));
  }
  if (parsed.data.defaultInfill !== undefined) {
    await setSetting("order.defaultInfill", String(parsed.data.defaultInfill));
  }
  if (parsed.data.contacts !== undefined) {
    const phones = parsed.data.contacts.phones.map((p) => p.trim()).filter(Boolean);
    const vkGroup = normalizeVkUrl(parsed.data.contacts.vkGroup);
    const vkChat = normalizeVkUrl(parsed.data.contacts.vkChat);
    if (vkGroup === null || vkChat === null || phones.some((p) => !parsePhone(p))) {
      return NextResponse.json({ error: "Invalid values" }, { status: 400 });
    }
    await setSetting("contacts.phones", phones.join("\n"));
    await setSetting("contacts.vkGroup", vkGroup);
    await setSetting("contacts.vkChat", vkChat);
  }
  if (parsed.data.pickup !== undefined) {
    const p = parsed.data.pickup;
    await setSetting("pickup.enabled", p.enabled ? "1" : "0");
    await setSetting("pickup.address", p.address);
    await setSetting("pickup.lat", p.lat === null ? "" : String(p.lat));
    await setSetting("pickup.lon", p.lon === null ? "" : String(p.lon));
    await setSetting("pickup.hours", p.hours);
    await setSetting("pickup.radiusKm", String(p.radiusKm));
  }
  if (parsed.data.pricing !== undefined) {
    await setSetting("pricing.laborPerHour", String(parsed.data.pricing.laborPerHour));
    await setSetting("pricing.plasticMarkupPercent", String(parsed.data.pricing.plasticMarkupPercent));
  }
  if (parsed.data.slicer !== undefined) {
    const { printer, process, filaments } = parsed.data.slicer;
    await setSetting("slicer.printerPreset", printer ? JSON.stringify(printer) : "");
    await setSetting("slicer.processPreset", process ? JSON.stringify(process) : "");
    await setSetting("slicer.filamentPresets", JSON.stringify(filaments));
    if (parsed.data.slicer.bedType !== undefined) await setSetting("slicer.bedType", parsed.data.slicer.bedType);
  }
  return NextResponse.json({ ok: true });
}
