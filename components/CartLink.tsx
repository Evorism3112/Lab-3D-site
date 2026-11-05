"use client";

import Link from "next/link";

import { usePrintCart } from "@/lib/cart";

/** Header cart button with the number of models in it. */
export function CartLink({ label }: { label: string }) {
  const count = usePrintCart().length;
  return (
    <Link
      href="/order/checkout"
      aria-label={count ? `${label}: ${count}` : label}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text transition-colors hover:border-accent hover:text-accent"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
        <circle cx="9.5" cy="19.5" r="1.3" />
        <circle cx="17" cy="19.5" r="1.3" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[11px] font-medium text-[#0b120d]">
          {count}
        </span>
      )}
    </Link>
  );
}
