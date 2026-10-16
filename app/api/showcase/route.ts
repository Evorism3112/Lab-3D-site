import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAllowedImage, MAX_IMAGE_SIZE_BYTES } from "@/lib/images";
import { storage } from "@/lib/storage";

/** An optional positive whole number from the form ("" or garbage = not given). */
function optionalCount(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return typeof value === "string" && value.trim() && Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET() {
  const items = await prisma.showcaseItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title");
  const material = formData.get("material");

  if (!(file instanceof File) || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Missing title or file" }, { status: 400 });
  }

  if (!isAllowedImage(file.name)) {
    return NextResponse.json(
      { error: "Unsupported image format. Supported: JPG, PNG, WEBP" },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = await storage.save(buffer, file.name);

  const count = await prisma.showcaseItem.count();
  const item = await prisma.showcaseItem.create({
    data: {
      title: title.trim(),
      storageKey,
      sortOrder: count,
      material: typeof material === "string" && material.trim() ? material.trim().slice(0, 100) : null,
      printDays: optionalCount(formData.get("printDays")),
      priceRub: optionalCount(formData.get("priceRub")),
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
