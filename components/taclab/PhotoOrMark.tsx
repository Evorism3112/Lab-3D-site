import { photoUrl } from "@/lib/taclab/format";

/** A product photo, or - until one is uploaded - the dimmed TACLAB mark in its place. */
export function PhotoOrMark({ id, alt, markSize = 64, eager = false }: { id?: string; alt: string; markSize?: number; eager?: boolean }) {
  if (id) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own route, already sized
      <img src={photoUrl(id)} alt={alt} loading={eager ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover" />
    );
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/taclab/icon-white.svg" alt="" aria-hidden style={{ width: markSize, opacity: 0.14 }} />
    </span>
  );
}
