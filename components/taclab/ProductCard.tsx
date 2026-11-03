import Link from "next/link";

import { PhotoOrMark } from "@/components/taclab/PhotoOrMark";
import { stockLabel, type ShopProduct } from "@/lib/taclab/product";
import { rub, shopPath } from "@/lib/taclab/format";

export function ProductCard({ product: p, base }: { product: ShopProduct; base: string }) {
  return (
    <Link
      href={shopPath(base, `/p/${p.slug}`)}
      className="tl-card-hover flex flex-col overflow-hidden rounded-[2px] border border-tl-line bg-tl-card"
    >
      <div className="relative aspect-[4/3]" style={{ background: "radial-gradient(circle at 50% 45%, #202227 0%, #141518 75%)" }}>
        <PhotoOrMark id={p.photoIds[0]} alt={p.name} />
        {p.modelCode && (
          <span className="tl-mono absolute left-4 top-4 rounded-[2px] bg-tl-accent px-2 py-[3px] text-xs text-tl-bg">
            {p.modelCode} · {p.revision}
          </span>
        )}
      </div>
      <div className="flex flex-grow flex-col gap-3 px-5 pb-5 pt-5">
        <strong className="tl-display text-2xl font-semibold leading-tight">{p.name}</strong>
        {p.tagline && <span className="text-sm leading-relaxed text-tl-muted">{p.tagline}</span>}
        {p.colors.length > 0 && (
          <div className="flex items-center gap-1.5" aria-label={`Цвета: ${p.colors.map((c) => c.name).join(", ")}`}>
            {p.colors.map((c) => (
              <span key={c.letter} title={c.name} className="h-3.5 w-3.5 rounded-full border border-white/25" style={{ background: c.swatch }} />
            ))}
          </div>
        )}
        <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-tl-line pt-3.5">
          <span className="tl-display text-[26px] font-semibold">{rub(p.priceRub)}</span>
          <span className={`tl-mono text-xs uppercase ${p.inStock ? "text-tl-accent" : "text-tl-muted"}`}>{stockLabel(p)}</span>
        </div>
      </div>
    </Link>
  );
}
