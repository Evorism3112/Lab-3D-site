"use client";

import { useState } from "react";

/** Header menu on narrow screens: a burger button that opens the links as a panel under the header. */
export function MobileMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text transition-colors hover:border-accent hover:text-accent"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        // Any tap inside (a link, the language switch) closes the panel.
        <div
          onClick={() => setOpen(false)}
          className="absolute inset-x-0 top-full flex flex-col items-start gap-4 border-b border-border bg-bg px-6 py-5 text-base text-muted"
        >
          {children}
        </div>
      )}
    </div>
  );
}
