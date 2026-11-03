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
