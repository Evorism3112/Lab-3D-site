// Bambuddy (github.com/maziggy/bambuddy) runs on the same machine as a Windows service and
// talks to the Bambu printers over LAN. We only call its REST API from the server, so the
// API key (Bambuddy → Settings → API Keys with "Read status" and "Control printer", plus "Manage
// library" for slicer quotes) never reaches the browser.
const BAMBUDDY_URL = (process.env.BAMBUDDY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const BAMBUDDY_API_KEY = process.env.BAMBUDDY_API_KEY;
const REQUEST_TIMEOUT_MS = 5000;

export const PRINTER_ACTIONS = ["pause", "resume", "stop"] as const;
export type PrinterAction = (typeof PRINTER_ACTIONS)[number];

export type PrinterSnapshot = {
  id: number;
  name: string;
  model: string | null;
  connected: boolean;
  state: string | null;
  job: string | null;
  progress: number | null;
  remainingMinutes: number | null;
  layer: number | null;
  totalLayers: number | null;
  nozzle: number | null;
  nozzleTarget: number | null;
  bed: number | null;
  bedTarget: number | null;
  errors: number;
};

export class BambuddyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function callBambuddy<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (!BAMBUDDY_API_KEY) throw new BambuddyError("BAMBUDDY_API_KEY is not configured", 503);
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BAMBUDDY_URL}/api/v1${path}`, {
      ...rest,
      headers: { "X-API-Key": BAMBUDDY_API_KEY, ...rest.headers },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail = typeof body?.detail === "string" ? body.detail : res.statusText;
      throw new BambuddyError(detail, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof BambuddyError) throw err;
    throw new BambuddyError(`Bambuddy is unreachable at ${BAMBUDDY_URL}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

type BambuddyPrinter = { id: number; name: string; model: string | null; is_active: boolean };
type BambuddyStatus = {
  connected: boolean;
  state: string | null;
  subtask_name: string | null;
  current_print: string | null;
  progress: number | null;
  remaining_time: number | null;
  layer_num: number | null;
  total_layers: number | null;
  temperatures: Record<string, number> | null;
  hms_errors: unknown[];
};

export async function listPrinters(): Promise<PrinterSnapshot[]> {
  const printers = (await callBambuddy<BambuddyPrinter[]>("/printers/")).filter((p) => p.is_active);
  return Promise.all(
    printers.map(async (printer): Promise<PrinterSnapshot> => {
      // One unreachable printer must not hide the others.
      const status = await callBambuddy<BambuddyStatus>(`/printers/${printer.id}/status`).catch(() => null);
      const temps = status?.temperatures ?? {};
      return {
        id: printer.id,
        name: printer.name,
        model: printer.model,
        connected: status?.connected ?? false,
        state: status?.state ?? null,
        job: status?.subtask_name || status?.current_print || null,
        progress: status?.progress ?? null,
        remainingMinutes: status?.remaining_time ?? null,
        layer: status?.layer_num ?? null,
        totalLayers: status?.total_layers ?? null,
        nozzle: temps.nozzle ?? null,
        nozzleTarget: temps.nozzle_target ?? null,
        bed: temps.bed ?? null,
        bedTarget: temps.bed_target ?? null,
        errors: status?.hms_errors?.length ?? 0,
      };
    }),
  );
}

export function isBambuddyConfigured(): boolean {
  return Boolean(BAMBUDDY_API_KEY);
}

export type BambuddySpool = {
  id: number;
  material: string;
  color_name: string | null;
  /** RRGGBBAA */
  rgba: string | null;
  label_weight: number;
  weight_used: number;
};

/** Active (not archived) spools of the Bambuddy inventory; the key needs inventory:read. */
export async function listSpools(): Promise<BambuddySpool[]> {
  return callBambuddy<BambuddySpool[]>("/inventory/spools");
}

const ACTION_PATHS: Record<PrinterAction, string> = {
  pause: "print/pause",
  resume: "print/resume",
  stop: "print/stop",
};

export async function controlPrinter(printerId: number, action: PrinterAction): Promise<void> {
  await callBambuddy(`/printers/${printerId}/${ACTION_PATHS[action]}`, { method: "POST" });
}

// Public address of the Bambuddy web UI for the "open Bambuddy" link. BAMBUDDY_PUBLIC_URL
// wins; otherwise bambu.<site domain>, which is what deploy/setup.ps1 registers in Caddy.
export function getBambuddyPublicUrl(): string {
  if (process.env.BAMBUDDY_PUBLIC_URL) return process.env.BAMBUDDY_PUBLIC_URL.replace(/\/$/, "");
  const app = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const url = new URL(app);
    const isLocal = url.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname);
    if (isLocal) return `http://${url.hostname}:8000`;
    return `${url.protocol}//bambu.${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return "http://localhost:8000";
  }
}

// ---- Slicing (Bambuddy library + its Bambu Studio sidecar, see lib/slicing.ts) ----

/** A slicer preset as Bambuddy lists it; `{source, id}` is what a slice request refers to. */
export type SlicerPreset = {
  id: string;
  name: string;
  source: "orca_cloud" | "cloud" | "local" | "standard";
  filament_type: string | null;
  compatible_printers: string[] | null;
};
type PresetSlots = { printer: SlicerPreset[]; process: SlicerPreset[]; filament: SlicerPreset[] };
export type SlicerPresets = PresetSlots;

/** Presets of every tier, in Bambuddy's priority order (local, Orca Cloud, Bambu Cloud, standard). */
export async function listSlicerPresets(): Promise<SlicerPresets> {
  const res = await callBambuddy<Record<"local" | "orca_cloud" | "cloud" | "standard", PresetSlots>>("/slicer/presets", {
    timeoutMs: 30_000,
  });
  const tiers = [res.local, res.orca_cloud, res.cloud, res.standard];
  return {
    printer: tiers.flatMap((t) => t?.printer ?? []),
    process: tiers.flatMap((t) => t?.process ?? []),
    filament: tiers.flatMap((t) => t?.filament ?? []),
  };
}

type LibraryFolder = { id: number; name: string; parent_id: number | null };

/** Id of a top-level library folder with this name, created when missing. */
export async function ensureLibraryFolder(name: string): Promise<number> {
  const folders = await callBambuddy<LibraryFolder[]>("/library/folders");
  const found = folders.find((f) => f.name === name && f.parent_id === null);
  if (found) return found.id;
  const created = await callBambuddy<LibraryFolder>("/library/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return created.id;
}

export async function uploadLibraryFile(content: Buffer, filename: string, folderId: number): Promise<number> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(content)]), filename);
  const res = await callBambuddy<{ id: number }>(`/library/files?folder_id=${folderId}&generate_stl_thumbnails=false`, {
    method: "POST",
    body: form,
    timeoutMs: 120_000,
  });
  return res.id;
}

/** Moves a library file to Bambuddy's trash, which it empties by itself. */
export async function deleteLibraryFile(fileId: number): Promise<void> {
  await callBambuddy(`/library/files/${fileId}`, { method: "DELETE" });
}

export type PresetRef = { source: SlicerPreset["source"]; id: string };

export type SliceOptions = {
  printer: PresetRef;
  process: PresetRef;
  filament: PresetRef;
  /** Slicer infill, %. */
  infillPercent: number;
};

/** Queues a slice of a library file; the result is polled with getSliceJob. */
export async function startSlice(fileId: number, options: SliceOptions): Promise<number> {
  const res = await callBambuddy<{ job_id: number }>(`/library/files/${fileId}/slice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      printer_preset: options.printer,
      process_preset: options.process,
      filament_preset: options.filament,
      process_overrides: { sparse_infill_density: `${options.infillPercent}%` },
      // A customer's STL can sit anywhere in its coordinates: put it on the plate.
      auto_arrange: true,
    }),
    timeoutMs: 120_000,
  });
  return res.job_id;
}

export type SliceJob =
  | { status: "pending" | "running" }
  | {
      status: "completed";
      result: { library_file_id: number; print_time_seconds: number; filament_used_g: number };
    }
  | { status: "failed"; error_detail: string | null };

export async function getSliceJob(jobId: number): Promise<SliceJob> {
  return callBambuddy<SliceJob>(`/slice-jobs/${jobId}`);
}

const FARM_SUMMARY_TTL_MS = 60_000;
let farmSummaryCache: { at: number; value: { total: number; printing: number } | null } | null = null;

/**
 * How many printers we have and how many are printing, for the home page. Cached for a minute
 * so page views don't poll every printer; null when Bambuddy is not set up or unreachable.
 */
export async function getFarmSummary(): Promise<{ total: number; printing: number } | null> {
  if (!isBambuddyConfigured()) return null;
  if (farmSummaryCache && Date.now() - farmSummaryCache.at < FARM_SUMMARY_TTL_MS) return farmSummaryCache.value;
  const value = await listPrinters()
    .then((printers) => ({
      total: printers.length,
      printing: printers.filter((p) => p.connected && (p.state === "RUNNING" || p.state === "PREPARE")).length,
    }))
    .catch(() => null);
  farmSummaryCache = { at: Date.now(), value };
  return value;
}
