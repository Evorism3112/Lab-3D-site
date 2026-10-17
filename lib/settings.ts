import { cache } from "react";

import { parsePhone, type Contacts, type Phone } from "@/lib/contacts";
import { prisma } from "@/lib/db";
import type { ShopRates } from "@/lib/pricing/defaults";

// Admin-editable settings (the Setting table), each with its default.
const DEFAULTS = {
  /** A synced Bambuddy color is offered to customers only with at least this many grams left. */
  "bambuddy.minStockGrams": "100",
  /** ISO time of the last successful color sync from Bambuddy ("" = never). */
  "bambuddy.lastSyncAt": "",
  /** Error of the last failed sync ("" = the last attempt succeeded). */
  "bambuddy.lastSyncError": "",
  /** Slicer infill levels (%) customers pick from, and the one preselected. */
  "order.infillLevels": "15,25,50,100",
  "order.defaultInfill": "25",
  /** Contacts shown on the site (lib/contacts.ts): phone numbers one per line, and VK links. */
  "contacts.phones": "",
  "contacts.vkGroup": "",
  "contacts.vkChat": "",
  /** Shop-wide pricing (lib/pricing/defaults.ts ShopRates), rubles and %: an hour of printing is
   *  work + printer costs for the customer, and the plastic is sold with a markup. */
  "pricing.laborPerHour": "150",
  "pricing.machinePerHour": "54",
  "pricing.plasticMarkupPercent": "20",
  /** Slicer quotes (lib/slicing.ts): Bambuddy presets as JSON {source, id, name}; "" = off.
   *  Filament presets are per material id; a material without one gets an automatic pick. */
  "slicer.printerPreset": "",
  "slicer.processPreset": "",
  "slicer.filamentPresets": "{}",
} as const;

export type SettingKey = keyof typeof DEFAULTS;

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<Record<K, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const values = {} as Record<K, string>;
  for (const key of keys) values[key] = DEFAULTS[key];
  for (const row of rows) values[row.key as K] = row.value;
  return values;
}

export async function getSetting(key: SettingKey): Promise<string> {
  return (await getSettings([key]))[key];
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Sorted infill levels in 1-100 and the default one (always one of the levels). */
export async function getInfillOptions(): Promise<{ levels: number[]; defaultLevel: number }> {
  const values = await getSettings(["order.infillLevels", "order.defaultInfill"]);
  const parse = (raw: string) =>
    [...new Set(raw.split(/[,\s]+/).map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 100).sort((a, b) => a - b);
  let levels = parse(values["order.infillLevels"]);
  if (levels.length === 0) levels = parse(DEFAULTS["order.infillLevels"]);
  const wanted = Number(values["order.defaultInfill"]);
  // The closest level, so a removed default still resolves to something the customer can pick.
  const defaultLevel = levels.reduce((best, n) => (Math.abs(n - wanted) < Math.abs(best - wanted) ? n : best), levels[0]);
  return { levels, defaultLevel };
}

export async function getMinStockGrams(): Promise<number> {
  const n = Number(await getSetting("bambuddy.minStockGrams"));
  return Number.isFinite(n) && n >= 0 ? n : Number(DEFAULTS["bambuddy.minStockGrams"]);
}

/**
 * Phone numbers and VK links shown on the site; unparsable phone lines are dropped.
 * Read by the header and the footer of every page, so it is loaded once per request and a
 * database failure only hides the contacts instead of breaking the whole layout.
 */
export const getContacts = cache(async (): Promise<Contacts> => {
  const values = await getSettings(["contacts.phones", "contacts.vkGroup", "contacts.vkChat"]).catch((error) => {
    console.error("Could not load contacts", error);
    return null;
  });
  if (!values) return { phones: [], vkGroup: "", vkChat: "" };
  return {
    phones: values["contacts.phones"]
      .split("\n")
      .map(parsePhone)
      .filter((p): p is Phone => p !== null),
    vkGroup: values["contacts.vkGroup"],
    vkChat: values["contacts.vkChat"],
  };
});

/** Shop-wide pricing rates; a broken value falls back to its default. Loaded once per request. */
export const getShopRates = cache(async (): Promise<ShopRates> => {
  const values = await getSettings(["pricing.laborPerHour", "pricing.machinePerHour", "pricing.plasticMarkupPercent"]);
  const num = (key: keyof typeof values) => {
    const n = Number(values[key]);
    return Number.isFinite(n) && n >= 0 ? n : Number(DEFAULTS[key]);
  };
  return {
    laborPerHourCents: Math.round(num("pricing.laborPerHour") * 100),
    machinePerHourCents: Math.round(num("pricing.machinePerHour") * 100),
    plasticMarkupPercent: num("pricing.plasticMarkupPercent"),
  };
});
