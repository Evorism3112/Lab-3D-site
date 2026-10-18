import { createHash } from "crypto";

import {
  BambuddyError,
  deleteLibraryFile,
  ensureLibraryFolder,
  getSliceJob,
  isBambuddyConfigured,
  listSlicerPresets,
  startSlice,
  uploadLibraryFile,
  type PresetRef,
  type SliceOptions,
  type SlicerPresets,
} from "@/lib/bambuddy";
import { prisma } from "@/lib/db";
import { toBinarySTL, type SupportedFormat } from "@/lib/geometry";
import { getSettings } from "@/lib/settings";
import { pickFilamentPreset, type NamedPresetRef } from "@/lib/slicerPresets";
import { storage } from "@/lib/storage";

// Exact print time and plastic from the slicer: the model goes to the Bambuddy library, its
// Bambu Studio sidecar slices it with the admin's presets, and both files are deleted right after.
// A slice takes seconds to minutes, so quotes show the volume-based estimate until it is done
// (the configurator polls), and the result is kept per model + settings in SliceEstimate.

/** Library folder the models go to while they are sliced. */
const LIBRARY_FOLDER = "Расчёт цены (сайт)";
const POLL_INTERVAL_MS = 2_000;
const SLICE_TIMEOUT_MS = 15 * 60_000;
/** A queued slice nobody asked about for this long is dropped (e.g. the customer moved the scale on). */
const ABANDON_AFTER_MS = 30_000;
/** A failed slice is not retried for this long; quotes meanwhile use the estimate. */
const FAILURE_TTL_MS = 30 * 60_000;
const PRESETS_TTL_MS = 10 * 60_000;

export type SliceConfig = {
  printer: NamedPresetRef;
  process: NamedPresetRef;
  /** Filament preset per material id chosen by the admin. */
  filaments: Record<string, NamedPresetRef>;
};

function parsePreset(raw: string): NamedPresetRef | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v.source === "string" && typeof v.id === "string" ? { source: v.source, id: v.id, name: String(v.name ?? v.id) } : null;
  } catch {
    return null;
  }
}

/** The admin's slicer presets, or null when slicer quotes are off. */
export async function getSliceConfig(): Promise<SliceConfig | null> {
  const values = await getSettings(["slicer.printerPreset", "slicer.processPreset", "slicer.filamentPresets"]);
  const printer = parsePreset(values["slicer.printerPreset"]);
  const process = parsePreset(values["slicer.processPreset"]);
  if (!printer || !process) return null;
  const filaments: Record<string, NamedPresetRef> = {};
  try {
    for (const [materialId, raw] of Object.entries(JSON.parse(values["slicer.filamentPresets"]) ?? {})) {
      const ref = parsePreset(JSON.stringify(raw));
      if (ref) filaments[materialId] = ref;
    }
  } catch {
    // A broken value means automatic picks for every material.
  }
  return { printer, process, filaments };
}

type SlicingState = {
  queue: Map<string, Job>;
  failures: Map<string, number>;
  running: boolean;
  presets: { at: number; value: SlicerPresets } | null;
};
// Kept on globalThis so dev hot reloads don't start a second worker.
const state: SlicingState = ((globalThis as { __slicing?: SlicingState }).__slicing ??= {
  queue: new Map(),
  failures: new Map(),
  running: false,
  presets: null,
});

/** Bambuddy's preset list, cached: listing the cloud tiers is slow. */
export async function getSlicerPresets(refresh = false): Promise<SlicerPresets> {
  if (!refresh && state.presets && Date.now() - state.presets.at < PRESETS_TTL_MS) return state.presets.value;
  const value = await listSlicerPresets();
  state.presets = { at: Date.now(), value };
  return value;
}

async function filamentFor(config: SliceConfig, material: { id: string; slug: string }): Promise<PresetRef | null> {
  const chosen = config.filaments[material.id];
  if (chosen) return { source: chosen.source, id: chosen.id };
  const picked = pickFilamentPreset((await getSlicerPresets()).filament, material.slug, config.printer, config.process);
  return picked ? { source: picked.source, id: picked.id } : null;
}

type Job = {
  id: string;
  fileId: string;
  key: string;
  storageKey: string;
  format: SupportedFormat;
  scalePercent: number;
  options: SliceOptions;
  askedAt: number;
};

/** Identity of the slicer settings, so changing a preset doesn't reuse old results. */
function sliceKey(options: SliceOptions, scalePercent: number): string {
  const parts = [options.printer, options.process, options.filament].map((p) => `${p.source}:${p.id}`);
  const raw = [...parts, options.infillPercent, scalePercent].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export type SliceResult =
  | { status: "ready"; printHours: number; plasticGrams: number }
  /** Being sliced: ask again in a few seconds. */
  | { status: "pending" }
  /** No slicer result (off, unsupported or failed): use the volume-based estimate. */
  | { status: "unavailable" };

type FileForSlicing = { id: string; storageKey: string; format: SupportedFormat };

/**
 * The slicer's time and plastic for one piece of this model with these options. With `enqueue`
 * (the live quote) a missing result is queued and "pending" returned; without it (placing the
 * order) only a finished result counts, so the order never waits for the slicer.
 */
export async function getSliceResult(
  file: FileForSlicing,
  material: { id: string; slug: string },
  infillPercent: number,
  scalePercent: number,
  { enqueue }: { enqueue: boolean },
): Promise<SliceResult> {
  if (!isBambuddyConfigured()) return { status: "unavailable" };
  const config = await getSliceConfig();
  if (!config) return { status: "unavailable" };

  let filament: PresetRef | null;
  try {
    filament = await filamentFor(config, material);
  } catch {
    // Bambuddy is unreachable: no presets to pick from.
    return { status: "unavailable" };
  }
  if (!filament) return { status: "unavailable" };

  const ref = ({ source, id }: PresetRef): PresetRef => ({ source, id });
  const options: SliceOptions = { printer: ref(config.printer), process: ref(config.process), filament, infillPercent };
  const key = sliceKey(options, scalePercent);
  const id = `${file.id}|${key}`;

  const saved = await prisma.sliceEstimate.findUnique({ where: { fileId_key: { fileId: file.id, key } } });
  if (saved) {
    return { status: "ready", printHours: saved.printSeconds / 3600, plasticGrams: Number(saved.filamentGrams) };
  }

  for (const [failedId, at] of state.failures) {
    if (Date.now() - at >= FAILURE_TTL_MS) state.failures.delete(failedId);
  }
  const failedAt = state.failures.get(id);
  if (failedAt !== undefined && Date.now() - failedAt < FAILURE_TTL_MS) return { status: "unavailable" };
  if (!enqueue) return { status: "unavailable" };

  const queued = state.queue.get(id);
  if (queued) {
    queued.askedAt = Date.now();
  } else {
    state.queue.set(id, { id, fileId: file.id, key, storageKey: file.storageKey, format: file.format, scalePercent, options, askedAt: Date.now() });
    void pump();
  }
  return { status: "pending" };
}

/** Slices queued jobs one at a time (the slicer is CPU-heavy), the most recently asked first. */
async function pump(): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    for (;;) {
      const now = Date.now();
      let next: Job | null = null;
      for (const job of state.queue.values()) {
        if (now - job.askedAt > ABANDON_AFTER_MS) state.queue.delete(job.id);
        else if (!next || job.askedAt > next.askedAt) next = job;
      }
      if (!next) break;
      await runJob(next);
      state.queue.delete(next.id);
    }
  } finally {
    state.running = false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runJob(job: Job): Promise<void> {
  const libraryFiles: number[] = [];
  try {
    const model = await storage.read(job.storageKey);
    const stl = toBinarySTL(model, job.format, job.scalePercent / 100);
    const folderId = await ensureLibraryFolder(LIBRARY_FOLDER);
    const sourceId = await uploadLibraryFile(stl, `${job.fileId}.stl`, folderId);
    libraryFiles.push(sourceId);
    const sliceJobId = await startSlice(sourceId, job.options);

    const deadline = Date.now() + SLICE_TIMEOUT_MS;
    for (;;) {
      await sleep(POLL_INTERVAL_MS);
      const status = await getSliceJob(sliceJobId);
      if (status.status === "completed") {
        const { library_file_id, print_time_seconds, filament_used_g } = status.result;
        libraryFiles.push(library_file_id);
        if (!(print_time_seconds > 0) || !(filament_used_g > 0)) throw new Error("The slicer returned no time or plastic");
        await prisma.sliceEstimate.upsert({
          where: { fileId_key: { fileId: job.fileId, key: job.key } },
          update: { printSeconds: Math.round(print_time_seconds), filamentGrams: filament_used_g },
          create: { fileId: job.fileId, key: job.key, printSeconds: Math.round(print_time_seconds), filamentGrams: filament_used_g },
        });
        return;
      }
      if (status.status === "failed") throw new Error(status.error_detail ?? "Slicing failed");
      if (Date.now() > deadline) throw new Error("Slicing timed out");
    }
  } catch (err) {
    // E.g. the model doesn't fit the plate, or the sidecar is down: quotes keep the estimate.
    const detail = err instanceof BambuddyError ? `${err.status} ${err.message}` : err instanceof Error ? err.message : String(err);
    console.error(`Slicer quote for file ${job.fileId} failed: ${detail}`);
    state.failures.set(job.id, Date.now());
  } finally {
    for (const id of libraryFiles) {
      await deleteLibraryFile(id).catch((err) => console.error(`Could not delete Bambuddy library file ${id}`, err));
    }
  }
}
