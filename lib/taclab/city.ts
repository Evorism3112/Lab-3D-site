"use client";

import { useSyncExternalStore } from "react";

import type { AddressSuggestion } from "@/lib/addressSuggest";

// The visitor's city, remembered in the browser: product pages show the price with delivery
// there, and the cart starts with it filled in.

const KEY = "taclab-city-v1";
const EVENT = "taclab-city";
let cached: { raw: string | null; city: AddressSuggestion | null } = { raw: null, city: null };

function read(): AddressSuggestion | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cached.raw) return cached.city;
  let city: AddressSuggestion | null = null;
  try {
    const parsed = JSON.parse(raw ?? "null");
    if (parsed && typeof parsed.value === "string" && typeof parsed.withType === "string") city = parsed;
  } catch {
    // broken value = no city
  }
  cached = { raw, city };
  return city;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSavedCity(): AddressSuggestion | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function saveCity(city: AddressSuggestion | null) {
  try {
    if (city) window.localStorage.setItem(KEY, JSON.stringify(city));
    else window.localStorage.removeItem(KEY);
  } catch {
    // private mode: just not remembered
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Read once, outside React (initial form state). */
export function savedCity(): AddressSuggestion | null {
  return typeof window === "undefined" ? null : read();
}
