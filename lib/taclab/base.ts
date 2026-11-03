import { headers } from "next/headers";

/**
 * Where the shop's pages live on this request: "/shop" on the main site, "" on the shop's own
 * domain (proxy.ts sets x-shop-base). Links are built as `${base}/p/slug`, `${base || "/"}`.
 */
export async function getShopBase(): Promise<string> {
  return (await headers()).get("x-shop-base") ?? "/shop";
}

