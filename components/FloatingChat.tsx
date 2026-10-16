"use client";

import { usePathname } from "next/navigation";

// A "message us" button in the corner of every customer page: many people want to ask
// before they order. Hidden in the admin and when no VK link is set.
export function FloatingChat({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  if (!href || pathname.startsWith("/admin") || pathname === "/login") return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-text shadow-lg transition-colors hover:border-accent hover:text-accent"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}
