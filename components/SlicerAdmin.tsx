"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { SlicerPreset, SlicerPresets } from "@/lib/bambuddy";
import { formatTemplate, type Dictionary } from "@/lib/i18n/translations";
import { fitsPrinter, pickFilamentPreset, type NamedPresetRef } from "@/lib/slicerPresets";

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
}: {
  dict: Dictionary;
  /** Bambuddy is set up (BAMBUDDY_API_KEY). */
  configured: boolean;
  materials: Material[];
  printer: NamedPresetRef | null;
  process: NamedPresetRef | null;
  filaments: Record<string, NamedPresetRef>;
}) {
  const t = dict.admin;
  const router = useRouter();
  const [presets, setPresets] = useState<SlicerPresets | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [printer, setPrinter] = useState(savedPrinter);
  const [process, setProcess] = useState(savedProcess);
  const [filaments, setFilaments] = useState(savedFilaments);
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
      body: JSON.stringify({ slicer: { printer, process, filaments } }),
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
    </div>
  );
}
