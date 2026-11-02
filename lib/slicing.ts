import { createHash } from "crypto";

import {
  BambuddyError,
  deleteLibraryFile,
  downloadLibraryFile,
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
import { slicedBy, testCubeStl } from "@/lib/slicerOutput";
import { parseBedType, pickFilamentPreset, type BedType, type NamedPresetRef } from "@/lib/slicerPresets";
import { storage } from "@/lib/storage";

// Exact print time and plastic from the slicer: the model goes to the Bambuddy library, its
// OrcaSlicer sidecar slices it with the admin's presets, and both files are deleted right after.
// A slice takes seconds to minutes, so the configurator shows "calculating" and polls until it is
// done; the result is kept per model + settings in SliceEstimate. A model it can't slice is ordered
// without a price (lib/pricing/options.ts PRICE_ON_REQUEST_LEAD_DAYS).

/** Library folder the models go to while they are sliced. */
const LIBRARY_FOLDER = "Расчёт цены (сайт)";
const POLL_INTERVAL_MS = 2_000;
const SLICE_TIMEOUT_MS = 15 * 60_000;
/** A queued slice nobody asked about for this long is dropped (e.g. the customer moved the scale on). */
const ABANDON_AFTER_MS = 30_000;
/** A failed slice is not retried for this long; quotes meanwhile say "price on request". */
const FAILURE_TTL_MS = 30 * 60_000;
const PRESETS_TTL_MS = 10 * 60_000;
/** Entries kept in the admin's slice log (in memory: it starts empty after a restart). */
const LOG_SIZE = 30;
/** Infill of the admin's test slice, %. */
const TEST_INFILL_PERCENT = 15;

export type SliceConfig = {
  printer: NamedPresetRef;
  process: NamedPresetRef;
  /** Filament preset per material id chosen by the admin. */
  filaments: Record<string, NamedPresetRef>;
  /** "" = the process preset's own plate. */
  bedType: BedType | "";
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
  const values = await getSettings(["slicer.printerPreset", "slicer.processPreset", "slicer.filamentPresets", "slicer.bedType"]);
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
  return { printer, process, filaments, bedType: parseBedType(values["slicer.bedType"]) };
}

/** One slice as the admin sees it (admin → Prices → slicer → log). */
export type SliceLogEntry = {
  id: string;
  /** A customer's quote or the admin's test cube. */
  kind: "quote" | "test";
  model: string;
  material: string;
  /** dropped: queued, but the customer moved on before its turn. */
  status: "queued" | "slicing" | "ok" | "failed" | "dropped";
  queuedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  printSeconds: number | null;
  grams: number | null;
  /** The program named in the sliced file, e.g. "OrcaSlicer-2.4.2"; null when it doesn't say. */
  slicer: string | null;
  error: string | null;
};

type SlicingState = {
  queue: Map<string, Job>;
  failures: Map<string, number>;
  running: boolean;
  presets: { at: number; value: SlicerPresets } | null;
  log?: SliceLogEntry[];
};
// Kept on globalThis so dev hot reloads don't start a second worker.
const state: SlicingState = ((globalThis as { __slicing?: SlicingState }).__slicing ??= {
  queue: new Map(),
  failures: new Map(),
  running: false,
  presets: null,
});
state.log ??= [];
const log = state.log;

function addLogEntry(entry: Pick<SliceLogEntry, "kind" | "model" | "material">): SliceLogEntry {
  const full: SliceLogEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    status: "queued",
    queuedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    printSeconds: null,
    grams: null,
    slicer: null,
    error: null,
  };
  log.unshift(full);
  log.length = Math.min(log.length, LOG_SIZE);
  return full;
}

/** The latest slices, newest first. */
export function getSliceLog(): SliceLogEntry[] {
  return log.map((e) => ({ ...e }));
}

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
  entry: SliceLogEntry;
  /** The admin's test cube: never dropped, its result isn't stored. */
  test?: { stl: Buffer };
};

/** Identity of the slicer settings, so changing a preset doesn't reuse old results. */
function sliceKey(options: SliceOptions, scalePercent: number): string {
  const parts = [options.printer, options.process, options.filament].map((p) => `${p.source}:${p.id}`);
  // The plate only joins the key when set, so results from before the setting existed stay valid.
  const raw = [...parts, options.infillPercent, scalePercent, ...(options.bedType ? [options.bedType] : [])].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export type SliceResult =
  | { status: "ready"; printHours: number; plasticGrams: number }
  /** Being sliced: ask again in a few seconds. */
  | { status: "pending" }
  /** No slicer result (off, unsupported or failed): the price is agreed with the customer. */
  | { status: "unavailable" };

type FileForSlicing = { id: string; storageKey: string; format: SupportedFormat; originalName?: string };

/**
 * The slicer's time and plastic for one piece of this model with these options. With `enqueue`
 * (the live quote) a missing result is queued and "pending" returned; without it (placing the
 * order) only a finished result counts, so the order never waits for the slicer.
 */
export async function getSliceResult(
  file: FileForSlicing,
  material: { id: string; slug: string; name?: string },
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
  const options: SliceOptions = { printer: ref(config.printer), process: ref(config.process), filament, infillPercent, bedType: config.bedType };
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
    const entry = addLogEntry({
      kind: "quote",
      model: `${file.originalName ?? file.id}${scalePercent !== 100 ? ` (${scalePercent}%)` : ""}, ${infillPercent}%`,
      material: material.name ?? material.slug,
    });
    state.queue.set(id, { id, fileId: file.id, key, storageKey: file.storageKey, format: file.format, scalePercent, options, askedAt: Date.now(), entry });
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
        if (!job.test && now - job.askedAt > ABANDON_AFTER_MS) {
          state.queue.delete(job.id);
          job.entry.status = "dropped";
          job.entry.finishedAt = now;
        } else if (!next || job.askedAt > next.askedAt) next = job;
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
  const entry = job.entry;
  entry.status = "slicing";
  entry.startedAt = Date.now();
  try {
    const stl = job.test ? job.test.stl : toBinarySTL(await storage.read(job.storageKey), job.format, job.scalePercent / 100);
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
        // Which program really sliced it, for the admin's log; not knowing doesn't fail the quote.
        entry.slicer = await downloadLibraryFile(library_file_id)
          .then(slicedBy)
          .catch(() => null);
        Object.assign(entry, { status: "ok", finishedAt: Date.now(), printSeconds: Math.round(print_time_seconds), grams: filament_used_g });
        if (job.test) return;
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
    // E.g. the model doesn't fit the plate, or the sidecar is down: the price is then agreed by hand.
    const detail = err instanceof BambuddyError ? `${err.status} ${err.message}` : err instanceof Error ? err.message : String(err);
    console.error(`Slicer quote for file ${job.fileId} failed: ${detail}`);
    Object.assign(entry, { status: "failed", finishedAt: Date.now(), error: detail });
    if (!job.test) state.failures.set(job.id, Date.now());
  } finally {
    for (const id of libraryFiles) {
      await deleteLibraryFile(id).catch((err) => console.error(`Could not delete Bambuddy library file ${id}`, err));
    }
  }
}

/**
 * Slices a 20 mm cube the way customer models are sliced (same presets, queue and Bambuddy calls),
 * so the admin can see in the log whether the slicer works and which one answered. Uses the first
 * active material that has a filament preset. Returns why it can't start: a code the admin UI
 * translates (not_configured, no_presets, no_material) or Bambuddy's error text.
 */
export async function startTestSlice(): Promise<string | null> {
  if (!isBambuddyConfigured()) return "not_configured";
  const config = await getSliceConfig();
  if (!config) return "no_presets";
  let options: SliceOptions | null = null;
  let materialName = "";
  try {
    for (const material of await prisma.material.findMany({ where: { active: true }, orderBy: { name: "asc" } })) {
      const filament = await filamentFor(config, material);
      if (!filament) continue;
      const ref = ({ source, id }: PresetRef): PresetRef => ({ source, id });
      options = { printer: ref(config.printer), process: ref(config.process), filament, infillPercent: TEST_INFILL_PERCENT, bedType: config.bedType };
      materialName = material.name;
      break;
    }
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  if (!options) return "no_material";
  const entry = addLogEntry({ kind: "test", model: `Test cube 20 mm, ${TEST_INFILL_PERCENT}%`, material: materialName });
  const id = `test|${entry.id}`;
  state.queue.set(id, {
    id,
    fileId: "test",
    key: "test",
    storageKey: "",
    format: "STL",
    scalePercent: 100,
    options,
    askedAt: Date.now(),
    entry,
    test: { stl: testCubeStl() },
  });
  void pump();
  return null;
}
