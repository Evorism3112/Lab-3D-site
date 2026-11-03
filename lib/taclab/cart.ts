"use client";

import { useSyncExternalStore } from "react";

// The shop cart lives in the visitor's browser (localStorage) until checkout; prices are never
// stored here - the order API takes them from the CRM catalog.

export type CartLine = { slug: string; crmName: string; color: string; connector: string; qty: number };

const KEY = "taclab-cart-v1";
const EVENT = "taclab-cart";
const EMPTY: CartLine[] = [];
let cached: { raw: string | null; lines: CartLine[] } = { raw: null, lines: EMPTY };

function read(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cached.raw) return cached.lines;
  let lines: CartLine[] = EMPTY;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) {
      lines = parsed.filter(
        (l) => l && typeof l.slug === "string" && typeof l.crmName === "string" && Number.isInteger(l.qty) && l.qty > 0,
      );
    }
  } catch {
    // A broken value is just an empty cart.
  }
  cached = { raw, lines };
  return lines;
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Private mode etc.: the cart just doesn't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const same = (a: CartLine, b: Omit<CartLine, "qty">) =>
  a.slug === b.slug && a.color === b.color && a.connector === b.connector;

export function addToCart(line: CartLine) {
  const lines = read();
  const existing = lines.find((l) => same(l, line));
  write(
    existing
      ? lines.map((l) => (l === existing ? { ...l, qty: Math.min(99, l.qty + line.qty) } : l))
      : [...lines, line],
  );
}

export function setQty(line: CartLine, qty: number) {
  write(read().flatMap((l) => (same(l, line) ? (qty > 0 ? [{ ...l, qty: Math.min(99, qty) }] : []) : [l])));
}

export function clearCart() {
  write([]);
}
