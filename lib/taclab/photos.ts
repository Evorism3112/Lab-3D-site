// Shop photos straight from a camera are 5-25 MB: they are turned upright (EXIF), cut down to
// 1600 px, saved as JPEG without metadata (no location). sharp comes with Next.js as an optional
// dependency; where it's missing the photo is kept as uploaded.
export async function prepareShopPhoto(input: Buffer): Promise<{ data: Buffer; ext: string } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const data = await sharp(input)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    return { data, ext: "jpg" };
  } catch (err) {
    console.error("Shop photo was not resized:", err instanceof Error ? err.message : err);
    return null;
  }
}
