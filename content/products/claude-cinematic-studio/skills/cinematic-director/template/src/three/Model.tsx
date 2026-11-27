import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import type { Look } from "../lib/looks";
import { useTime } from "../lib/time";
import { useRedrawWhenReady } from "./sync";
import type { Vec3 } from "./camera";

const deg = Math.PI / 180;
const cache = new Map<string, Promise<THREE.Group>>();

/**
 * The client's own 3D model (.glb from public/models/), placed in the shot
 * next to the 3D type. It is scaled to `size` (its largest side) and centred,
 * so a model from any tool lands at a predictable size. Materials are kept;
 * `finish` overrides them with the look's metal or a clean studio plastic.
 */
export function Model({
  file,
  look,
  size = 2,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  spin = 0,
  finish,
}: {
  /** Path under public/, e.g. "models/sneaker.glb". */
  file: string;
  look: Look;
  size?: number;
  position?: Vec3;
  /** Degrees. */
  rotation?: Vec3;
  /** Degrees per second around Y. */
  spin?: number;
  finish?: "metal" | "plastic" | "glass";
}) {
  const t = useTime();
  const [scene, setScene] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let p = cache.get(file);
    if (!p) {
      p = new GLTFLoader().loadAsync(staticFile(file)).then((g) => g.scene);
      cache.set(file, p);
    }
    let alive = true;
    p.then((s) => alive && setScene(s)).catch((err) => console.error(`Model ${file}`, err));
    return () => {
      alive = false;
    };
  }, [file]);

  const prepared = useMemo(() => {
    if (!scene) return null;
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const dims = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const k = size / Math.max(dims.x, dims.y, dims.z, 1e-6);
    root.position.sub(centre);
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(k);
    if (finish) {
      const material =
        finish === "metal"
          ? new THREE.MeshPhysicalMaterial({ color: look.type.color, metalness: 1, roughness: 0.25, clearcoat: 1 })
          : finish === "glass"
            ? new THREE.MeshPhysicalMaterial({ color: "#ffffff", metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.5, ior: 1.45 })
            : new THREE.MeshPhysicalMaterial({ color: "#e9e9ec", metalness: 0, roughness: 0.45, clearcoat: 0.4 });
      wrap.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material;
      });
    }
    return wrap;
  }, [scene, size, finish, look]);

  useRedrawWhenReady(Boolean(prepared), `model ${file}`);
  if (!prepared) return null;
  return (
    <group position={position} rotation={[rotation[0] * deg, (rotation[1] + spin * t) * deg, rotation[2] * deg]}>
      <primitive object={prepared} />
    </group>
  );
}
