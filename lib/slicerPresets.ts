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

// Bambu Lab's own standard filament per plastic type, best first: quotes are sliced the way the
// shop prints by default (e.g. "Bambu PLA Basic @BBL X1C"). A name ends in "@<printer>" or nothing.
const end = String.raw`(?:\s*@|$)`;
const BAMBU_STANDARD: Record<string, RegExp[]> = {
  PLA: [new RegExp(`^Bambu PLA Basic${end}`, "i")],
  PETG: [new RegExp(`^Bambu PETG Basic${end}`, "i"), new RegExp(`^Bambu PETG HF${end}`, "i")],
  ABS: [new RegExp(`^Bambu ABS${end}`, "i")],
  ASA: [new RegExp(`^Bambu ASA${end}`, "i")],
  TPU: [new RegExp(`^Bambu TPU 95A HF${end}`, "i"), new RegExp(`^Bambu TPU 95A${end}`, "i")],
  PC: [new RegExp(`^Bambu PC${end}`, "i")],
};
// Composites and support filaments are never the standard one.
const SPECIAL = /-(CF|GF)\b|\bsupport\b|\bCF\b|\bGF\b/i;

/**
 * The filament preset for a material when the admin hasn't picked one: same plastic type
 * (the material slug, e.g. "petg" → PETG), made for the chosen printer. Bambu's standard filament
 * first (PLA Basic, PETG Basic/HF, ABS, TPU 95A…), then any plain Bambu one of that type, then a
 * generic one — for plastics Bambu doesn't make (PP, PA without fibre…).
 */
export function pickFilamentPreset(
  presets: SlicerPreset[],
  materialSlug: string,
  printer: NamedPresetRef,
  process: NamedPresetRef,
): SlicerPreset | null {
  const type = materialSlug.toUpperCase();
  const candidates = presets.filter((p) => (p.filament_type ?? "").toUpperCase() === type && fitsPrinter(p, printer, process));
  for (const pattern of BAMBU_STANDARD[type] ?? []) {
    const found = candidates.find((p) => pattern.test(p.name));
    if (found) return found;
  }
  return (
    candidates.find((p) => /^Bambu /i.test(p.name) && !SPECIAL.test(p.name)) ??
    candidates.find((p) => /generic/i.test(p.name)) ??
    candidates[0] ??
    null
  );
}

/**
 * Build plates the slicer knows (curr_bed_type). The process preset usually says "Cool Plate",
 * which has no bed temperature for PETG, ABS and the like, so the CLI refuses: "Cool Plate does
 * not support filament 1". Textured PEI has temperatures for almost every plastic.
 */
export const BED_TYPES = [
  "Textured PEI Plate",
  "Smooth PEI Plate",
  "High Temp Plate",
  "Engineering Plate",
  "Cool Plate",
  "Cool Plate (SuperTack)",
] as const;
export type BedType = (typeof BED_TYPES)[number];
export const DEFAULT_BED_TYPE: BedType = "Textured PEI Plate";

/** The stored plate setting; "" = whatever the process preset says. */
export function parseBedType(raw: string): BedType | "" {
  return (BED_TYPES as readonly string[]).includes(raw) ? (raw as BedType) : "";
}
