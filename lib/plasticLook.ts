// How each plastic looks in the 3D preview (components/ModelViewer.tsx) — tuned on test renders
// of the same part in every material. Keyed by material slug; composites (ABS-CF…) live under
// their base material, so they get its look.
export type PlasticLook = {
  /** Used when the material has no colors to pick from. */
  defaultColor: string;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  /** < 1 = translucent (PETG, PET, PC, PP). */
  opacity: number;
  /** Velvet-like dry surface (nylon). */
  sheen: number;
  /** Strength of the FDM layer lines, 0 = none. */
  layers: number;
};

const MATTE: PlasticLook = {
  defaultColor: "#2f9a3c",
  roughness: 0.38,
  clearcoat: 0.3,
  clearcoatRoughness: 0.4,
  opacity: 1,
  sheen: 0,
  layers: 0.3,
};

const LOOKS: Record<string, PlasticLook> = {
  pla: MATTE,
  petg: { ...MATTE, defaultColor: "#1a5fb8", roughness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.1, opacity: 0.7, layers: 0.35 },
  abs: { ...MATTE, defaultColor: "#2b2d30", roughness: 0.85, clearcoat: 0, layers: 0.35 },
  pet: { ...MATTE, defaultColor: "#bfe6f0", roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, opacity: 0.45, layers: 0.35 },
  tpu: { ...MATTE, defaultColor: "#e5651d", roughness: 0.75, clearcoat: 0 },
  pa: { ...MATTE, defaultColor: "#d8ccb0", roughness: 0.9, clearcoat: 0, sheen: 1 },
  pc: { ...MATTE, defaultColor: "#4f5a66", roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, opacity: 0.55, layers: 0.35 },
  pp: { ...MATTE, defaultColor: "#eef3f5", roughness: 0.55, clearcoat: 0.2, opacity: 0.85 },
};

export function plasticLook(slug: string | undefined): PlasticLook {
  return (slug && LOOKS[slug.toLowerCase()]) || MATTE;
}

/** Sanding / smoothing finishes take the layer lines away — that is what they are paid for. */
export function isSmoothFinish(name: string | undefined): boolean {
  return Boolean(name && /sand|smooth|polish|шлиф|глад|полир/i.test(name));
}
