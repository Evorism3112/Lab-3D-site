import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAllowedImage } from "@/lib/images";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/taclab/catalog";
import { prepareShopPhoto } from "@/lib/taclab/photos";

// Camera originals are big; they are cut down to 1600 px on the way in (lib/taclab/photos.ts).
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const crmName = form.get("crmName");
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (typeof crmName !== "string" || !crmName.trim() || files.length === 0) {
    return NextResponse.json({ error: "Нет товара или файла" }, { status: 400 });
  }
  for (const file of files) {
    if (!isAllowedImage(file.name)) return NextResponse.json({ error: `${file.name}: нужен JPG, PNG или WEBP` }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: `${file.name}: больше 40 МБ` }, { status: 400 });
  }

  // A product gets its shop row on its first photo (hidden until published).
  let product = await prisma.taclabProduct.findUnique({ where: { crmName }, include: { photos: true } });
  if (!product) {
    let slug = slugify(crmName);
    if (await prisma.taclabProduct.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    product = await prisma.taclabProduct.create({ data: { crmName, slug }, include: { photos: true } });
  }

  let order = product.photos.reduce((max, p) => Math.max(max, p.sortOrder), -1);
  const created = [];
  for (const file of files) {
    const original = Buffer.from(await file.arrayBuffer());
    const prepared = await prepareShopPhoto(original);
    const storageKey = prepared
      ? await storage.save(prepared.data, `${product.slug}.${prepared.ext}`)
      : await storage.save(original, file.name);
    created.push(await prisma.taclabPhoto.create({ data: { productId: product.id, storageKey, sortOrder: ++order } }));
  }
  return NextResponse.json({ photos: created }, { status: 201 });
}
