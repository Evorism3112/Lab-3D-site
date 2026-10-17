export type GeometryStats = {
  volumeCm3: number;
  bboxMm: { x: number; y: number; z: number };
  triangleCount: number;
};

export class GeometryParseError extends Error {}

/** Receives the triangles of a mesh one by one (vertex coordinates in mm). */
export interface TriangleSink {
  addTriangle(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
  ): void;
}
