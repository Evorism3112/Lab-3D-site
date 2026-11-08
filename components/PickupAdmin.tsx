"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddressField } from "@/components/AddressField";
import { formatTemplate, type Dictionary } from "@/lib/i18n/translations";
import type { Pickup } from "@/lib/settings";

// Pickup from the workshop (lib/settings.ts getPickup): the address in one line, from the same
// suggestions as at checkout, so its coordinates are known (typing it by hand works too).
export function PickupAdmin({ dict, pickup, enabled }: { dict: Dictionary; pickup: Pickup; enabled: boolean }) {
  const t = dict.admin;
  const tc = dict.checkout;
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [address, setAddress] = useState(pickup.address);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    pickup.lat !== null && pickup.lon !== null ? { lat: pickup.lat, lon: pickup.lon } : null,
  );
  const [hours, setHours] = useState(pickup.hours);
  const [radius, setRadius] = useState(String(pickup.radiusKm));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const save = async () => {
    const radiusKm = Number(radius);
    if ((on && !address.trim()) || !(radiusKm >= 1)) {
      setMessage({ text: t.pickupInvalid, error: true });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: { enabled: on, address: address.trim().replace(/[,\s]+$/, ""), lat: coords?.lat ?? null, lon: coords?.lon ?? null, hours: hours.trim(), radiusKm },
      }),
    });
    setBusy(false);
    setMessage(res.ok ? { text: t.pricingSaved, error: false } : { text: t.pickupInvalid, error: true });
    if (res.ok) router.refresh();
  };

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-text">{t.pickupTitle}</h2>
      <p className="mt-1 text-xs text-muted">{t.pickupAdminHint}</p>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="w-auto" />
        {t.pickupEnabled}
      </label>

      <div className="mt-4">
        <AddressField
          label={t.pickupAddress}
          level="full"
          placeholder={tc.addressPlaceholder}
          value={address}
          required={false}
          onChange={(text) => {
            setAddress(text);
            setMessage(null);
          }}
          onSelect={(s) => {
            setAddress(s.complete ? s.value : `${s.value}, `);
            if (s.lat !== undefined && s.lon !== undefined) setCoords({ lat: s.lat, lon: s.lon });
            setMessage(null);
          }}
        />
      </div>
      <p className={`mt-1 text-xs ${coords ? "text-muted" : "text-danger"}`}>
        {coords ? formatTemplate(t.pickupCoords, `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`) : t.pickupNoCoords}
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">{t.pickupHoursLabel}</span>
          <input value={hours} placeholder={t.pickupHoursPlaceholder} onChange={(e) => setHours(e.target.value)} className="px-3 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">{t.pickupRadius}</span>
          <input type="number" min={1} value={radius} onChange={(e) => setRadius(e.target.value)} className="px-3 py-1.5 text-sm" />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary px-4 py-1.5 text-sm">
          {busy ? t.saving : t.savePricing}
        </button>
        {message && <span className={`text-sm ${message.error ? "text-danger" : "text-accent"}`}>{message.text}</span>}
      </div>
    </div>
  );
}
