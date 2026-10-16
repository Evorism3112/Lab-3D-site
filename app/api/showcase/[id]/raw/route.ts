import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { imageContentType } from "@/lib/images";
import { storage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await prisma.showcaseItem.findUnique({ where: { id } });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await storage.read(item.storageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": imageContentType(item.storageKey),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
