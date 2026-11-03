import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

async function admin() {
  return (await auth())?.user?.role === "ADMIN";
}

/** Make this photo the main one (first in the gallery and on the catalog card). */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const photo = await prisma.taclabPhoto.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const first = await prisma.taclabPhoto.findFirst({ where: { productId: photo.productId }, orderBy: { sortOrder: "asc" } });
  await prisma.taclabPhoto.update({ where: { id }, data: { sortOrder: (first?.sortOrder ?? 0) - 1 } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const photo = await prisma.taclabPhoto.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.taclabPhoto.delete({ where: { id } });
  await storage.remove(photo.storageKey);
  return NextResponse.json({ ok: true });
}
