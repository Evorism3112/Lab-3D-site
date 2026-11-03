/** A product photo, or - until one is uploaded - the dimmed TACLAB mark in its place. */
export function PhotoOrMark({ src, alt, markSize = 64, eager = false }: { src?: string | null; alt: string; markSize?: number; eager?: boolean }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own routes, already sized
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover" />
    );
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/taclab/icon-white.svg" alt="" aria-hidden style={{ width: markSize, opacity: 0.14 }} />
    </span>
  );
}
