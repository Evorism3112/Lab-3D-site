import { parseOBJ, walkOBJ } from "./obj";
import { parseSTL, walkSTL } from "./stl";
import { GeometryParseError, type GeometryStats, type TriangleSink } from "./types";

export type { GeometryStats };
export { GeometryParseError };

export const SUPPORTED_FORMATS = ["STL", "OBJ"] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

export function detectFormat(filename: string): SupportedFormat | null {
  const ext = filename.split(".").pop()?.toUpperCase();
  if (ext === "STL" || ext === "OBJ") return ext;
  return null;
}

export function analyzeGeometry(buffer: Buffer, format: SupportedFormat): GeometryStats {
  switch (format) {
    case "STL":
      return parseSTL(buffer);
    case "OBJ":
      return parseOBJ(buffer);
  }
}

/**
 * The model as a binary STL scaled by `scale` (1 = as uploaded) — what the slicer gets, since
 * Bambuddy slices only STL/3MF and the customer's scale has to be in the geometry itself.
 */
export function toBinarySTL(buffer: Buffer, format: SupportedFormat, scale = 1): Buffer {
  const coords: number[] = [];
  const sink: TriangleSink = {
    addTriangle(ax, ay, az, bx, by, bz, cx, cy, cz) {
      coords.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    },
  };
  if (format === "STL") walkSTL(buffer, sink);
  else walkOBJ(buffer, sink);

  const count = coords.length / 9;
  const out = Buffer.alloc(84 + count * 50);
  out.write("formnow", 0, "ascii");
  out.writeUInt32LE(count, 80);
  let offset = 84;
  for (let i = 0; i < coords.length; i += 9) {
    offset += 12; // zero normal: slicers recompute it from the vertex order
    for (let j = 0; j < 9; j++) {
      out.writeFloatLE(coords[i + j] * scale, offset);
      offset += 4;
    }
    offset += 2;
  }
  return out;
}
