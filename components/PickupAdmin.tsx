"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddressField } from "@/components/AddressField";
import { formatAddressLine } from "@/lib/address";
import type { AddressSuggestion } from "@/lib/addressSuggest";
import { formatTemplate, type Dictionary } from "@/lib/i18n/translations";
import type { Pickup } from "@/lib/settings";

type Picked = { text: string; picked: AddressSuggestion | null };

// Pickup from the workshop (lib/settings.ts getPickup): the address is picked from the same
// suggestions as at checkout, down to the house, so its coordinates are known.
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
  const [city, setCity] = useState<Picked>({ text: "", picked: null });
  const [street, setStreet] = useState<Picked>({ text: "", picked: null });
  const [house, setHouse] = useState<Picked>({ text: "", picked: null });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // The most precise point picked so far: house, else street, else the city centre.
  const take = (s: AddressSuggestion, c: string, st: string, h: string) => {
    if (s.lat !== undefined && s.lon !== undefined) setCoords({ lat: s.lat, lon: s.lon });
    if (c && st && h) setAddress(formatAddressLine({ city: c, street: st, house: h }));
    setMessage(null);
  };

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
        pickup: { enabled: on, address: address.trim(), lat: coords?.lat ?? null, lon: coords?.lon ?? null, hours: hours.trim(), radiusKm },
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

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <AddressField
          label={tc.city}
          level="city"
          value={city.text}
          required={false}
          onChange={(text) => setCity({ text, picked: null })}
          onSelect={(s) => {
            setCity({ text: s.value, picked: s });
            setStreet({ text: "", picked: null });
            setHouse({ text: "", picked: null });
            take(s, "", "", "");
          }}
        />
        <AddressField
          label={tc.street}
          level="street"
          value={street.text}
          required={false}
          suggest={Boolean(city.picked)}
          context={{ cityId: city.picked?.id, cityName: city.picked?.value, bbox: city.picked?.bbox }}
          onChange={(text) => setStreet({ text, picked: null })}
          onSelect={(s) => {
            setStreet({ text: s.withType, picked: s });
            setHouse({ text: "", picked: null });
            take(s, "", "", "");
          }}
        />
        <AddressField
          label={tc.house}
          level="house"
          value={house.text}
          required={false}
          suggest={Boolean(street.picked)}
          context={{ streetId: street.picked?.id, streetName: street.picked?.value, bbox: city.picked?.bbox }}
          onChange={(text) => setHouse({ text, picked: null })}
          onSelect={(s) => {
            setHouse({ text: s.value, picked: s });
            take(s, city.picked?.withType ?? city.text, street.picked?.withType ?? street.text, s.withType);
          }}
        />
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-muted">{t.pickupAddress}</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="px-3 py-1.5 text-sm" />
      </label>
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
