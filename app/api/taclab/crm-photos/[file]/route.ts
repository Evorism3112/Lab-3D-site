import { NextResponse } from "next/server";

import { fetchLabProductPhoto } from "@/lib/labClient";

// Product photos added in the CRM (Настройки → Каталог → Фото), served to shop visitors from here:
// the CRM's external API needs its key, which never reaches the browser. File names are unique per
// upload, so a photo is cached here and in browsers for good.
const cache = new Map<string, { data: Buffer; contentType: string }>();
const CACHE_LIMIT_BYTES = 150 * 1024 * 1024;
let cachedBytes = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  let photo = cache.get(file);
  if (!photo) {
    const fetched = await fetchLabProductPhoto(file);
    if (!fetched) return NextResponse.json({ error: "Not found" }, { status: 404 });
    photo = fetched;
    // Oldest out first once the cache is full (Map keeps insertion order).
    while (cachedBytes + photo.data.length > CACHE_LIMIT_BYTES && cache.size) {
      const [oldKey, old] = cache.entries().next().value!;
      cache.delete(oldKey);
      cachedBytes -= old.data.length;
    }
    cache.set(file, photo);
    cachedBytes += photo.data.length;
  }
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
