/** "12 990 ₽" - the shop shows whole rubles. */
export function rub(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

/** Same as shopPath in base.ts, usable in client components (base comes in as a prop). */
export function shopPath(base: string, path = "/"): string {
  if (path === "/") return base || "/";
  return `${base}${path}`;
}

export function photoUrl(id: string): string {
  return `/api/taclab/photos/${id}`;
}

/** The 3D-print site (Лаборатория 3Д): its public address. */
export const LAB3D_ORIGIN = "https://lab-3d.pro";

/**
 * A link to a page of the 3D-print site from the shop: a plain path while the shop lives under
 * /shop on that same site, the full address once the shop is on its own domain (base "").
 */
export function lab3dPath(base: string, path = "/"): string {
  return base ? path : `${LAB3D_ORIGIN}${path === "/" ? "" : path}`;
}
