// Images people upload: showcase photos and photos attached to "no 3D model" requests.
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_REQUEST_PHOTOS = 5;

export function isAllowedImage(name: string): boolean {
  return extension(name) in CONTENT_TYPES;
}

export function imageContentType(storageKey: string): string {
  return CONTENT_TYPES[extension(storageKey)] ?? "application/octet-stream";
}

function extension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
