"use client";

import { useSyncExternalStore } from "react";

// The print cart lives in the visitor's browser (localStorage) until checkout. Only the choices are
// stored, never prices: the checkout asks /api/quote for each line, and the order API prices them
// again from the slicer. Names are kept just to show the line without asking the server.

export type PrintCartLine = {
  id: string;
  fileId: string;
  fileName: string;
  materialId: string;
  materialName: string;
  colorId?: string;
  colorName?: string;
  colorHex?: string;
  finishId?: string;
  finishName?: string;
  infillPercent: number;
  scalePercent: number;
  quantity: number;
};

export const MAX_LINE_QTY = 1000;

const KEY = "lab3d-cart-v1";
const EVENT = "lab3d-cart";
const EMPTY: PrintCartLine[] = [];
let cached: { raw: string | null; lines: PrintCartLine[] } = { raw: null, lines: EMPTY };

const isLine = (l: unknown): l is PrintCartLine => {
  const v = l as PrintCartLine;
  return (
    Boolean(v) &&
    typeof v.id === "string" &&
    typeof v.fileId === "string" &&
    typeof v.materialId === "string" &&
    Number.isInteger(v.quantity) &&
    v.quantity > 0 &&
    Number.isInteger(v.scalePercent) &&
    Number.isInteger(v.infillPercent)
  );
};

function read(): PrintCartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cached.raw) return cached.lines;
  let lines: PrintCartLine[] = EMPTY;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) lines = parsed.filter(isLine);
  } catch {
    // A broken value is just an empty cart.
  }
  cached = { raw, lines };
  return lines;
}

function write(lines: PrintCartLine[]) {
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

export function usePrintCart(): PrintCartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** The same model with the same settings: added again, it only raises the quantity. */
const sameSetup = (a: Omit<PrintCartLine, "id" | "quantity">, b: Omit<PrintCartLine, "id" | "quantity">) =>
  a.fileId === b.fileId &&
  a.materialId === b.materialId &&
  (a.colorId ?? "") === (b.colorId ?? "") &&
  (a.finishId ?? "") === (b.finishId ?? "") &&
  a.infillPercent === b.infillPercent &&
  a.scalePercent === b.scalePercent;

export function addToPrintCart(line: Omit<PrintCartLine, "id">) {
  const lines = read();
  const existing = lines.find((l) => sameSetup(l, line));
  write(
    existing
      ? lines.map((l) => (l === existing ? { ...l, quantity: Math.min(MAX_LINE_QTY, l.quantity + line.quantity) } : l))
      : [...lines, { ...line, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` }],
  );
}

export function setPrintCartQty(id: string, quantity: number) {
  write(read().flatMap((l) => (l.id === id ? (quantity > 0 ? [{ ...l, quantity: Math.min(MAX_LINE_QTY, quantity) }] : []) : [l])));
}

export function removeFromPrintCart(id: string) {
  write(read().filter((l) => l.id !== id));
}

export function clearPrintCart() {
  write([]);
}
