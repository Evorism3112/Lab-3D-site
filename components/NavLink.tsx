"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header menu link, highlighted while the visitor is inside its section. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap transition-colors hover:text-accent ${active ? "text-accent" : ""}`}
    >
      {children}
    </Link>
  );
}
