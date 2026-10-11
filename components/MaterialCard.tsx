import Link from "next/link";

import { localizeCatalogText } from "@/lib/i18n/catalog";
import { formatDays, formatTemplate, type Dictionary } from "@/lib/i18n/translations";
import { formatAmount } from "@/lib/money";

export type MaterialCardData = {
  slug: string;
  name: string;
  description: string | null;
  bestFor: string | null;
  strength: number;
  flexibility: number;
  heatResistance: number;
  leadTimeDays: number;
  hourlyRateCents: number;
  colors: { id: string; name: string; nameRu: string | null; hex: string; variant: string }[];
};

export function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/** A material in the catalog grid (home page and /materials); the whole card opens the material's page. */
export function MaterialCard({ material: m, dict }: { material: MaterialCardData; dict: Dictionary }) {
  const { home } = dict;

  return (
    <Link
      href={`/materials/${m.slug}`}
      className="card flex h-full flex-col gap-4 p-6 transition-all hover:-translate-y-1.5 hover:border-accent/40"
    >
      <div>
        <h3 className="text-lg font-semibold text-accent">{m.name}</h3>
        {m.description && (
          <p className="mt-1 text-sm text-muted">{localizeCatalogText(m.description, dict.locale)}</p>
        )}
      </div>

      {m.colors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {m.colors.map((c) => (
            <span
              key={c.id}
              title={localizeCatalogText(c.name, dict.locale, c.nameRu) + (c.variant ? ` · ${c.variant}` : "")}
              className="h-4 w-4 rounded-full border border-border"
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <StatBar label={home.materialsStrength} value={m.strength} />
        <StatBar label={home.materialsFlexibility} value={m.flexibility} />
        <StatBar label={home.materialsHeatResistance} value={m.heatResistance} />
      </div>

      {m.bestFor && (
        <p className="rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-text">
          <span className="text-muted">{home.materialsBestFor}</span> {localizeCatalogText(m.bestFor, dict.locale)}
        </p>
      )}

      <div className="mt-auto flex items-baseline justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted">
          {home.materialsPricePrefix}{" "}
          <span className="font-semibold text-text">{formatAmount(m.hourlyRateCents / 100, dict.locale)}</span>{" "}
          {home.materialsPriceSuffix}
        </span>
        <span className="text-muted">
          {formatTemplate(home.materialsLeadTime, formatDays(m.leadTimeDays, dict.locale))}
        </span>
      </div>
    </Link>
  );
}
