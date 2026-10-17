import type { PresetRef, SlicerPreset } from "@/lib/bambuddy";

// Preset helpers shared by the slicer quotes (lib/slicing.ts) and the admin page that picks them.

export type NamedPresetRef = PresetRef & { name: string };

/** "@BBL X1C" of "0.20mm Standard @BBL X1C": the printer a bundled preset is made for. */
const printerSuffix = (name: string) => name.match(/@[^@]+$/)?.[0]?.trim() ?? null;

/** Whether a process or filament preset can be used with this printer (and process). */
export function fitsPrinter(preset: SlicerPreset, printer: NamedPresetRef, process?: NamedPresetRef): boolean {
  if (preset.compatible_printers?.length) return preset.compatible_printers.includes(printer.name);
  // Bambuddy lists no compatibility for bundled presets: match their "@BBL <printer>" suffix.
  const suffix = process ? printerSuffix(process.name) : null;
  return !suffix || preset.name.endsWith(suffix);
}

/**
 * The filament preset for a material when the admin hasn't picked one: same plastic type
 * (the material slug, e.g. "petg" → PETG), made for the chosen printer, a generic one first.
 */
export function pickFilamentPreset(
  presets: SlicerPreset[],
  materialSlug: string,
  printer: NamedPresetRef,
  process: NamedPresetRef,
): SlicerPreset | null {
  const type = materialSlug.toUpperCase();
  const candidates = presets.filter((p) => (p.filament_type ?? "").toUpperCase() === type && fitsPrinter(p, printer, process));
  return candidates.find((p) => /generic/i.test(p.name)) ?? candidates[0] ?? null;
}
