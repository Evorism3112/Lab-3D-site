import { NextResponse, type NextRequest } from "next/server";

// The TACLAB shop lives in app/(taclab)/shop and is served two ways:
//  - on the main site under /shop (while it has no domain of its own), and
//  - on its own domain(s) from TACLAB_DOMAIN (comma-separated), where /x is rewritten to /shop/x.
// Pages build their links from the x-shop-base header set here ("" on the shop's domain, "/shop"
// otherwise), so the address bar never shows /shop on the shop's own domain.

const SHOP_HOSTS = new Set(
  (process.env.TACLAB_DOMAIN ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .flatMap((h) => [h, h.startsWith("www.") ? h.slice(4) : `www.${h}`]),
);

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);

  if (SHOP_HOSTS.has(host)) {
    headers.set("x-shop-base", "");
    // The shop's domain shows only the shop: everything else (the 3D-print site, its admin) 404s.
    if (pathname === "/shop" || pathname.startsWith("/shop/")) {
      return NextResponse.next({ request: { headers } });
    }
    const url = request.nextUrl.clone();
    url.pathname = `/shop${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Once the shop has its own domain, /shop on the main site moves there for good: one address for
  // customers and search engines.
  const shopDomain = (process.env.TACLAB_DOMAIN ?? "").split(",")[0].trim().toLowerCase();
  if (shopDomain && (pathname === "/shop" || pathname.startsWith("/shop/"))) {
    const target = new URL(`https://${shopDomain}${pathname.slice("/shop".length) || "/"}`);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  headers.set("x-shop-base", "/shop");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // API routes, Next internals and files with an extension (icons, robots.txt) pass straight through.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[a-z0-9]+$).*)"],
};
