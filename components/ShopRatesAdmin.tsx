"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatTemplate, type Dictionary } from "@/lib/i18n/translations";
import { formatAmount } from "@/lib/money";
import type { ShopRates } from "@/lib/pricing/defaults";

const rubles = (cents: number) => (cents / 100).toString();

// Shop-wide pricing (lib/settings.ts getShopRates): work and printer costs per hour, plastic markup.
export function ShopRatesAdmin({ dict, rates }: { dict: Dictionary; rates: ShopRates }) {
  const t = dict.admin;
  const router = useRouter();
  const [labor, setLabor] = useState(rubles(rates.laborPerHourCents));
  const [machine, setMachine] = useState(rubles(rates.machinePerHourCents));
  const [markup, setMarkup] = useState(String(rates.plasticMarkupPercent));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const values = { laborPerHour: Number(labor), machinePerHour: Number(machine), plasticMarkupPercent: Number(markup) };
  const valid = [labor, machine, markup].every((v) => v.trim() !== "") &&
    Object.values(values).every((n) => Number.isFinite(n) && n >= 0);

  const save = async () => {
    if (!valid) {
      setMessage({ text: t.ratesInvalid, error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricing: values }),
    });
    setBusy(false);
    setMessage(res.ok ? { text: t.pricingSaved, error: false } : { text: t.ratesInvalid, error: true });
    if (res.ok) router.refresh();
  };

  const field = (label: string, value: string, onChange: (v: string) => void) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="number"
        min={0}
        step="1"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setMessage(null);
        }}
        className="w-40 px-3 py-1.5 text-sm"
      />
    </label>
  );

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-text">{t.ratesTitle}</h2>
      <p className="mt-1 text-xs text-muted">{t.ratesHint}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {field(t.laborLabel, labor, setLabor)}
        {field(t.machineLabel, machine, setMachine)}
        {field(t.markupLabel, markup, setMarkup)}
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary px-4 py-1.5 text-sm">
          {busy ? t.saving : t.savePricing}
        </button>
      </div>
      {valid && (
        <p className="mt-3 text-sm text-text">
          {formatTemplate(t.clientHourLabel, formatAmount(values.laborPerHour + values.machinePerHour, dict.locale))}
        </p>
      )}
      {message && <p className={`mt-2 text-sm ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</p>}
    </div>
  );
}
