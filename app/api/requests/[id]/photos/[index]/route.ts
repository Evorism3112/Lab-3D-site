import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { imageContentType } from "@/lib/images";
import { storage } from "@/lib/storage";

// Photos of a "no 3D model" request, linked from the CRM order notes. Like /api/files/[id]/raw,
// access is by the unguessable request id — CRM staff are not signed in to the site.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  const request = await prisma.modelRequest.findUnique({ where: { id }, select: { photoKeys: true } });
  const key = request?.photoKeys[Number(index)];
  if (!key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await storage.read(key);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": imageContentType(key), "Cache-Control": "private, max-age=86400" },
  });
}
