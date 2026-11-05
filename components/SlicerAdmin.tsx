"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { SlicerPreset, SlicerPresets } from "@/lib/bambuddy";
import type { SliceLogEntry } from "@/lib/slicing";
import { formatTemplate, type Dictionary } from "@/lib/i18n/translations";
import { BED_TYPES, fitsPrinter, pickFilamentPreset, type BedType, type NamedPresetRef } from "@/lib/slicerPresets";

type Material = { id: string; name: string; slug: string };

const refOf = (p: SlicerPreset): NamedPresetRef => ({ source: p.source, id: p.id, name: p.name });
const keyOf = (p: { source: string; id: string }) => `${p.source}:${p.id}`;
const sourceLabel: Record<SlicerPreset["source"], string> = {
  local: "Bambuddy",
  orca_cloud: "Orca Cloud",
  cloud: "Bambu Cloud",
  standard: "OrcaSlicer",
};

// Slicer quotes (lib/slicing.ts): the Bambuddy presets the models are sliced with.
export function SlicerAdmin({
  dict,
  configured,
  materials,
  printer: savedPrinter,
  process: savedProcess,
  filaments: savedFilaments,
  bedType: savedBedType,
}: {
  dict: Dictionary;
  /** Bambuddy is set up (BAMBUDDY_API_KEY). */
  configured: boolean;
  materials: Material[];
  printer: NamedPresetRef | null;
  process: NamedPresetRef | null;
  filaments: Record<string, NamedPresetRef>;
  /** "" = the process preset's own plate. */
  bedType: BedType | "";
}) {
  const t = dict.admin;
  const router = useRouter();
  const [presets, setPresets] = useState<SlicerPresets | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [printer, setPrinter] = useState(savedPrinter);
  const [process, setProcess] = useState(savedProcess);
  const [filaments, setFilaments] = useState(savedFilaments);
  const [bedType, setBedType] = useState(savedBedType);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    setLoading(true);
    setLoadError(null);
    const res = await fetch(`/api/admin/slicer/presets${refresh ? "?refresh" : ""}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok && data?.presets) setPresets(data.presets);
    else setLoadError(data?.error ?? "Bambuddy error");
    setLoading(false);
  }, []);

  useEffect(() => {
    // Listing the cloud tiers takes a while, so it isn't part of the page render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (configured) void load(false);
  }, [configured, load]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slicer: { printer, process, filaments, bedType } }),
    });
    setBusy(false);
    setMessage(res.ok ? { text: t.pricingSaved, error: false } : { text: t.slicerSaveError, error: true });
    if (res.ok) router.refresh();
  };

  // A select that keeps showing the saved preset even when it is missing from the list.
  const presetSelect = (
    label: string,
    options: SlicerPreset[],
    value: NamedPresetRef | null,
    onChange: (v: NamedPresetRef | null) => void,
    emptyLabel: string,
  ) => {
    const missing = value && !options.some((p) => keyOf(p) === keyOf(value));
    return (
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-xs text-muted">{label}</span>
        <select
          value={value ? keyOf(value) : ""}
          onChange={(e) => {
            const picked = options.find((p) => keyOf(p) === e.target.value);
            onChange(picked ? refOf(picked) : null);
            setMessage(null);
          }}
          className="w-full px-3 py-1.5 text-sm"
        >
          <option value="">{emptyLabel}</option>
          {missing && <option value={keyOf(value)}>{value.name}</option>}
          {options.map((p) => (
            <option key={keyOf(p)} value={keyOf(p)}>
              {p.name} · {sourceLabel[p.source]}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const processes = presets && printer ? presets.process.filter((p) => fitsPrinter(p, printer)) : (presets?.process ?? []);

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-text">{t.slicerTitle}</h2>
      <p className="mt-1 text-xs text-muted">{t.slicerHint}</p>

      {!configured && <p className="mt-3 text-sm text-muted">{t.slicerNotConfigured}</p>}
      {configured && loading && !presets && <p className="mt-3 text-sm text-muted">{t.slicerLoading}</p>}
      {configured && loadError && (
        <p className="mt-3 text-sm text-danger">{formatTemplate(t.slicerLoadError, loadError)}</p>
      )}

      {presets && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {presetSelect(t.slicerPrinter, presets.printer, printer, setPrinter, t.slicerOff)}
            {presetSelect(t.slicerProcess, processes, process, setProcess, t.slicerOff)}
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted">{t.slicerBedType}</span>
              <select
                value={bedType}
                onChange={(e) => {
                  setBedType(e.target.value as BedType | "");
                  setMessage(null);
                }}
                className="w-full px-3 py-1.5 text-sm"
              >
                {BED_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value="">{t.slicerBedTypeFromProcess}</option>
              </select>
              <span className="text-xs text-muted">{t.slicerBedTypeHint}</span>
            </label>
          </div>

          {printer && process && (
            <div className="mt-4">
              <p className="text-xs text-muted">{t.slicerFilaments}</p>
              <div className="mt-2 flex flex-col gap-2">
                {materials.map((m) => {
                  const auto = pickFilamentPreset(presets.filament, m.slug, printer, process);
                  const sameType = presets.filament.filter(
                    (p) => (p.filament_type ?? "").toUpperCase() === m.slug.toUpperCase() && fitsPrinter(p, printer, process),
                  );
                  return (
                    <div key={m.id} className="grid items-center gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                      <span className="text-sm text-text">{m.name}</span>
                      {presetSelect(
                        "",
                        sameType.length ? sameType : presets.filament,
                        filaments[m.id] ?? null,
                        (v) =>
                          setFilaments((prev) => {
                            const next = { ...prev };
                            if (v) next[m.id] = v;
                            else delete next[m.id];
                            return next;
                          }),
                        auto ? formatTemplate(t.slicerAuto, auto.name) : t.slicerNoMatch,
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {configured && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy || !presets} className="btn btn-primary px-4 py-1.5 text-sm">
            {busy ? t.saving : t.savePricing}
          </button>
          <button type="button" onClick={() => load(true)} disabled={loading} className="btn btn-outline px-4 py-1.5 text-sm">
            {t.slicerRefresh}
          </button>
        </div>
      )}
      {message && <p className={`mt-2 text-sm ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>}

      {configured && <SliceLog dict={dict} />}
    </div>
  );
}

/** "1:05" for 65 minutes. */
const hoursMinutes = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
};
const secondsBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / 1000));

// What the slicer did lately (lib/slicing.ts keeps the log), with a test cube button, so the admin
// can see that slicing works and which slicer answered.
function SliceLog({ dict }: { dict: Dictionary }) {
  const t = dict.admin;
  const [log, setLog] = useState<SliceLogEntry[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const data = await fetch("/api/admin/slicer/log", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (data?.log) setLog(data.log);
    setNow(Date.now());
  }, []);

  // Often while something is queued or slicing, rarely otherwise (a customer may start a slice).
  const active = log?.some((e) => e.status === "queued" || e.status === "slicing") ?? false;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), active ? 2_000 : 15_000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const startTest = async () => {
    setStarting(true);
    setTestError(null);
    const res = await fetch("/api/admin/slicer/test", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      const code = data?.error ?? "network";
      const known: Record<string, string> = {
        not_configured: t.slicerTestNotConfigured,
        no_presets: t.slicerTestNoPresets,
        no_material: t.slicerTestNoMaterial,
      };
      setTestError(known[code] ?? formatTemplate(t.slicerTestError, code));
    }
    setStarting(false);
    await refresh();
  };

  const statusText = (e: SliceLogEntry) => {
    switch (e.status) {
      case "queued":
        return t.slicerLogQueued;
      case "slicing":
        return formatTemplate(t.slicerLogSlicing, secondsBetween(e.startedAt ?? now, now));
      case "ok":
        return t.slicerLogOk;
      case "failed":
        return t.slicerLogFailed;
      case "dropped":
        return t.slicerLogDropped;
    }
  };
  const statusColor: Record<SliceLogEntry["status"], string> = {
    queued: "text-muted",
    slicing: "text-text",
    ok: "text-accent",
    failed: "text-danger",
    dropped: "text-muted",
  };

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-text">{t.slicerLogTitle}</h3>
        <button type="button" onClick={startTest} disabled={starting} className="btn btn-outline px-4 py-1.5 text-sm">
          {starting ? t.slicerTestStarting : t.slicerTest}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">{t.slicerLogHint}</p>
      {testError && <p className="mt-2 text-sm text-danger">{testError}</p>}

      {log && log.length === 0 && <p className="mt-3 text-sm text-muted">{t.slicerLogEmpty}</p>}
      {log && log.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {log.map((e) => (
            <li key={e.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs text-muted">{new Date(e.queuedAt).toLocaleTimeString()}</span>
                <span className="text-xs text-muted">{e.kind === "test" ? t.slicerLogKindTest : t.slicerLogKindQuote}</span>
                <span className="min-w-0 break-all text-text">{e.model}</span>
                <span className="text-muted">{e.material}</span>
                <span className={`ml-auto font-medium ${statusColor[e.status]}`}>{statusText(e)}</span>
              </div>
              {e.status === "ok" && e.printSeconds !== null && e.grams !== null && (
                <div className="mt-1 text-xs text-muted">
                  {formatTemplate(
                    formatTemplate(formatTemplate(t.slicerLogResult, hoursMinutes(e.printSeconds)), e.grams.toFixed(1)),
                    secondsBetween(e.startedAt ?? e.queuedAt, e.finishedAt ?? now),
                  )}
                </div>
              )}
              {e.status === "ok" && (
                <div className={`mt-1 text-xs ${e.slicer ? "text-text" : "text-muted"}`}>
                  {e.slicer ? formatTemplate(t.slicerLogBy, e.slicer) : t.slicerLogByUnknown}
                </div>
              )}
              {/* Exactly what was sent: repeat it in Bambuddy to compare. Auto-arrange is on, orientation is the file's. */}
              <div className="mt-1 break-words text-xs text-muted">
                {formatTemplate(
                  t.slicerLogSettings,
                  [e.settings.printer, e.settings.process, e.settings.filament, e.settings.bedType || t.slicerLogBedFromPreset, `${e.settings.infillPercent}%`].join(" · "),
                )}
              </div>
              {e.status === "failed" && e.error && <div className="mt-1 break-words text-xs text-danger">{e.error}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
