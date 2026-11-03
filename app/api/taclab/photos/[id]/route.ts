import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { imageContentType } from "@/lib/images";
import { storage } from "@/lib/storage";

// A shop product photo (uploaded in the admin, already resized there).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await prisma.taclabPhoto.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await storage.read(photo.storageKey).catch(() => null);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": imageContentType(photo.storageKey),
      // A photo never changes under its id: a new upload is a new id.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
