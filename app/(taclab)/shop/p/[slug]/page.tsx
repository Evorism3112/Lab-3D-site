import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/taclab/ProductCard";
import { ProductView } from "@/components/taclab/ProductView";
import { getShopBase } from "@/lib/taclab/base";
import { getShopCatalog, getShopProduct } from "@/lib/taclab/catalog";
import { shopPath } from "@/lib/taclab/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getShopProduct((await params).slug);
  return product ? { title: product.name, description: product.tagline ?? undefined } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [base, { products }] = await Promise.all([getShopBase(), getShopCatalog()]);
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();
  const others = products.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-24 pt-7 sm:px-8">
      <nav aria-label="Навигация" className="tl-mono flex flex-wrap gap-2 text-xs tracking-[0.06em] text-tl-muted">
        <Link href={shopPath(base)} className="hover:text-white">ГЛАВНАЯ</Link>
        <span aria-hidden>/</span>
        <Link href={`${shopPath(base)}#catalog`} className="hover:text-white">КАТАЛОГ</Link>
        <span aria-hidden>/</span>
        <span className="text-tl-text">{product.modelCode ?? product.name.toUpperCase()}</span>
      </nav>

      <ProductView product={product} base={base} />

      {others.length > 0 && (
        <section aria-labelledby="related-title" className="mt-24">
          <h2 id="related-title" className="tl-display mb-7 text-[40px] font-bold">С этим берут</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {others.map((p) => (
              <ProductCard key={p.crmName} product={p} base={base} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
