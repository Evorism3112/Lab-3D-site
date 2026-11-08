"use client";

import { useSyncExternalStore } from "react";

import { MAX_ORDER_QTY } from "@/lib/taclab/limits";

// The shop cart lives in the visitor's browser (localStorage) until checkout; prices are never
// stored here - the order API takes them from the CRM catalog.

export type CartLine = { slug: string; crmName: string; color: string; connector: string; qty: number };


export const cartQty = (lines: CartLine[]) => lines.reduce((sum, l) => sum + l.qty, 0);

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

/** How many more pieces of this line fit in the order (MAX_ORDER_QTY over the whole cart). */
const room = (lines: CartLine[], line: Omit<CartLine, "qty">) =>
  MAX_ORDER_QTY - cartQty(lines.filter((l) => !same(l, line)));

/** Adds up to what still fits in the order; false when nothing more fits. */
export function addToCart(line: CartLine): boolean {
  const lines = read();
  const existing = lines.find((l) => same(l, line));
  const qty = Math.min(room(lines, line), (existing?.qty ?? 0) + line.qty);
  if (qty <= (existing?.qty ?? 0)) return false;
  write(existing ? lines.map((l) => (l === existing ? { ...l, qty } : l)) : [...lines, { ...line, qty }]);
  return true;
}

export function setQty(line: CartLine, qty: number) {
  const lines = read();
  const capped = Math.min(room(lines, line), qty);
  write(lines.flatMap((l) => (same(l, line) ? (capped > 0 ? [{ ...l, qty: capped }] : []) : [l])));
}

export function clearCart() {
  write([]);
}
