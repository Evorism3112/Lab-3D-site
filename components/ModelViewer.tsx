"use client";

import { Bounds, Center, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import type { PlasticLook } from "@/lib/plasticLook";

const LAYER_MM = 0.2;
const LINE_WIDTH_MM = 0.45;

/**
 * FDM texture for the preview: 0.2 mm layers on the walls and 45° extrusion lines on top, made by
 * tilting the shading normal by the model's own coordinates (millimetres, Z = print axis). Lines
 * narrower than ~4 px fade out, so the texture appears as you zoom in instead of turning into moiré.
 */
function fdmShader(strength: number) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    if (strength <= 0) return;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vPrint;\nvarying vec3 vUpView;\nvarying vec3 vDiagView;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPrint = position;\n" +
          "vUpView = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));\n" +
          "vDiagView = normalize(normalMatrix * vec3(0.70710678, -0.70710678, 0.0));",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vPrint;
varying vec3 vUpView;
varying vec3 vDiagView;
vec3 fdm(vec3 n) {
  float side = 1.0 - abs(dot(n, vUpView));
  float z = vPrint.z;
  float zFade = 1.0 - smoothstep(${(LAYER_MM * 0.12).toFixed(3)}, ${(LAYER_MM * 0.3).toFixed(3)}, fwidth(z));
  n += vUpView * sin(z * 6.2831853 / ${LAYER_MM.toFixed(2)}) * ${strength.toFixed(3)} * side * zFade;
  float d = (vPrint.x + vPrint.y) * 0.70710678;
  float dFade = 1.0 - smoothstep(${(LINE_WIDTH_MM * 0.12).toFixed(3)}, ${(LINE_WIDTH_MM * 0.3).toFixed(3)}, fwidth(d));
  n += vDiagView * sin(d * 6.2831853 / ${LINE_WIDTH_MM.toFixed(2)}) * ${(strength * 0.35).toFixed(3)} * smoothstep(0.6, 1.0, 1.0 - side) * dFade;
  return normalize(n);
}`,
      )
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = fdm(normal);")
      .replace(
        "#include <clearcoat_normal_fragment_begin>",
        "#include <clearcoat_normal_fragment_begin>\n#ifdef USE_CLEARCOAT\nclearcoatNormal = fdm(clearcoatNormal);\n#endif",
      );
  };
}

/** The part's surface in the chosen plastic and color. */
function PlasticMaterial({ look, color, smooth }: { look: PlasticLook; color: string; smooth: boolean }) {
  const layers = smooth ? 0 : look.layers;
  const onBeforeCompile = useMemo(() => fdmShader(layers), [layers]);
  return (
    <meshPhysicalMaterial
      // A new material per look: shader features (clearcoat, sheen, transparency, layers) are
      // compiled in, so they can't just be toggled on an existing one. Color changes stay cheap.
      key={`${JSON.stringify(look)}|${layers}`}
      color={color}
      roughness={look.roughness}
      metalness={0}
      clearcoat={look.clearcoat}
      clearcoatRoughness={look.clearcoatRoughness}
      sheen={look.sheen}
      sheenRoughness={0.8}
      sheenColor="#ffffff"
      transparent={look.opacity < 1}
      opacity={look.opacity}
      side={THREE.DoubleSide}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={() => `fdm-${layers}`}
    />
  );
}

type MaterialProps = { look: PlasticLook; color: string; smooth: boolean };

function StlMesh({ url, ...material }: { url: string } & MaterialProps) {
  const geometry = useLoader(STLLoader, url);
  return (
    <mesh geometry={geometry}>
      <PlasticMaterial {...material} />
    </mesh>
  );
}

function ObjMesh({ url, ...material }: { url: string } & MaterialProps) {
  const obj = useLoader(OBJLoader, url);
  const geometries = useMemo(() => {
    const list: THREE.BufferGeometry[] = [];
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) list.push(child.geometry);
    });
    return list;
  }, [obj]);
  return (
    <>
      {geometries.map((geometry) => (
        <mesh key={geometry.uuid} geometry={geometry}>
          <PlasticMaterial {...material} />
        </mesh>
      ))}
    </>
  );
}

export function ModelViewer({
  fileUrl,
  format,
  look,
  color,
  smooth = false,
}: {
  fileUrl: string;
  format: "STL" | "OBJ";
  look: PlasticLook;
  color: string;
  /** A sanding finish is picked — no layer lines. */
  smooth?: boolean;
}) {
  const material = { look, color, smooth };

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl border border-border bg-bg-soft">
      <Canvas camera={{ position: [80, 60, 80], fov: 40 }}>
        {/* Soft studio reflections built locally (no HDR download), so gloss has something to reflect. */}
        <Environment resolution={256} environmentIntensity={0.5}>
          <Lightformer form="rect" intensity={3} position={[0, 5, -6]} scale={[10, 4, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={1} position={[6, 3, 3]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        </Environment>
        <ambientLight intensity={0.25} />
        <directionalLight position={[100, 120, 80]} intensity={1.6} />
        <directionalLight position={[-90, 50, -80]} intensity={1.2} color="#e6fff0" />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.3}>
            <Center>
              {/* Slicers treat Z as up, so the part stands as it will be printed. */}
              <group rotation={[-Math.PI / 2, 0, 0]}>
                {format === "STL" ? <StlMesh url={fileUrl} {...material} /> : <ObjMesh url={fileUrl} {...material} />}
              </group>
            </Center>
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
