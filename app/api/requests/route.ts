import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { isAllowedImage, MAX_IMAGE_SIZE_BYTES, MAX_REQUEST_PHOTOS } from "@/lib/images";
import { pushModelRequestToLab } from "@/lib/labClient";
import { isRateLimited } from "@/lib/rateLimit";
import { storage } from "@/lib/storage";

const RequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contact: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(3000),
});

export async function POST(request: NextRequest) {
  if (isRateLimited(request, "model-request", 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form" }, { status: 400 });

  const parsed = RequestSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_REQUEST_PHOTOS) {
    return NextResponse.json({ error: `No more than ${MAX_REQUEST_PHOTOS} photos` }, { status: 400 });
  }
  for (const photo of photos) {
    if (!isAllowedImage(photo.name)) {
      return NextResponse.json({ error: "Unsupported image format. Supported: JPG, PNG, WEBP" }, { status: 400 });
    }
    if (photo.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 400 });
    }
  }

  const photoKeys: string[] = [];
  for (const photo of photos) {
    photoKeys.push(await storage.save(Buffer.from(await photo.arrayBuffer()), photo.name));
  }

  const created = await prisma.modelRequest.create({ data: { ...parsed.data, photoKeys } });
  await pushModelRequestToLab({ ...created, photoCount: photoKeys.length });

  return NextResponse.json({ ok: true }, { status: 201 });
}
