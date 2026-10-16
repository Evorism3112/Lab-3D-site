import { readFile } from "fs/promises";
import path from "path";

import { prisma } from "@/lib/db";
import { analyzeGeometry } from "@/lib/geometry";
import { storage } from "@/lib/storage";

// The "try it on an example" model: a 50 mm spur gear, so a visitor without an STL can see the
// 3D preview and the price at once. One shared UploadedFile row, recreated if the uploads
// cleanup (deploy/cleanup-uploads.mjs) removed it.
const SAMPLE_PATH = path.join(process.cwd(), "lib", "samples", "gear.stl");
export const SAMPLE_FILE_NAME = "sample-gear.stl";

export async function getSampleFileId(): Promise<string> {
  const existing = await prisma.uploadedFile.findFirst({
    where: { originalName: SAMPLE_FILE_NAME, status: "READY" },
    orderBy: { createdAt: "desc" },
    select: { id: true, storageKey: true },
  });
  if (existing) {
    const stillOnDisk = await storage.read(existing.storageKey).then(() => true, () => false);
    if (stillOnDisk) return existing.id;
  }

  const buffer = await readFile(SAMPLE_PATH);
  const stats = analyzeGeometry(buffer, "STL");
  const storageKey = await storage.save(buffer, SAMPLE_FILE_NAME);
  const file = await prisma.uploadedFile.create({
    data: {
      storageKey,
      originalName: SAMPLE_FILE_NAME,
      format: "STL",
      sizeBytes: buffer.length,
      status: "READY",
      volumeCm3: stats.volumeCm3,
      bboxXMm: stats.bboxMm.x,
      bboxYMm: stats.bboxMm.y,
      bboxZMm: stats.bboxMm.z,
      triangleCount: stats.triangleCount,
    },
  });
  return file.id;
}
