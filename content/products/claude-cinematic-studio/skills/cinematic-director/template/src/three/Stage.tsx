import React, { useLayoutEffect, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useVideoConfig } from "remotion";
import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { Look } from "../lib/looks";
import { useTime } from "../lib/time";
import { clamp } from "../lib/curves";
import { FrameSync } from "./sync";
import { cameraSpeed, type CameraMove, type Vec3 } from "./camera";

/**
 * One 3D shot: camera, studio light, the look's post-processing. Everything a
 * scene puts inside lives in the same space as the camera, so type can pass
 * behind an object and the depth of field treats both the same.
 */
export function Stage({
  look,
  camera,
  focus,
  children,
  aberrationBoost = 1,
  stripSweep = 0.35,
  focusRange = 2.5,
  transparent = false,
}: {
  look: Look;
  camera: CameraMove;
  /** World point kept in focus. Defaults to the camera target. */
  focus?: (t: number) => Vec3;
  children: React.ReactNode;
  /** How much camera speed adds to chromatic aberration. 0 turns it off. */
  aberrationBoost?: number;
  /** Speed (units/s) at which the studio strips glide over reflective type. */
  stripSweep?: number;
  /** Depth (scene units) around the focus point that stays sharp. Smaller = shallower, more "lens". */
  focusRange?: number;
  /**
   * Render over a footage plate instead of the look's background. The post
   * chain (DOF, bloom, aberration, vignette) is off in this mode, because it
   * would paint over the plate; finish the composite in grade-finish.
   */
  transparent?: boolean;
}) {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      gl={{ antialias: true, alpha: transparent, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      dpr={1}
      style={{ position: "absolute", inset: 0 }}
    >
      <Scene look={look} camera={camera} focus={focus} aberrationBoost={aberrationBoost} stripSweep={stripSweep} focusRange={focusRange} transparent={transparent}>
        {children}
      </Scene>
    </ThreeCanvas>
  );
}

function Scene({
  look,
  camera,
  focus,
  children,
  aberrationBoost,
  stripSweep,
  focusRange,
  transparent,
}: {
  focusRange: number;
  look: Look;
  camera: CameraMove;
  focus?: (t: number) => Vec3;
  children: React.ReactNode;
  aberrationBoost: number;
  stripSweep: number;
  transparent: boolean;
}) {
  const t = useTime();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const position = camera.position(t);
  const target = camera.target(t);
  const fov = camera.fov(t);
  const roll = camera.roll?.(t) ?? 0;

  useLayoutEffect(() => {
    const c = cam.current;
    if (!c) return;
    c.position.set(...position);
    c.up.set(Math.sin(roll), Math.cos(roll), 0);
    c.lookAt(...target);
    c.fov = fov;
    c.updateProjectionMatrix();
  });

  const speed = cameraSpeed(camera, t);
  const ca = look.post.aberration * (1 + clamp(speed / 4, 0, 6) * aberrationBoost);
  const focusPoint = focus ? focus(t) : target;
  const sweep = ((t * stripSweep) % 8) - 4;

  return (
    <>
      <PerspectiveCamera ref={cam} makeDefault near={0.1} far={200} />
      {!transparent && <color attach="background" args={[look.background]} />}
      {look.fog && <fog attach="fog" args={[look.fog.color, look.fog.near, look.fog.far]} />}
      <ambientLight intensity={look.light.ambient} />
      <directionalLight position={[3, 5, 6]} intensity={look.light.key} />
      <pointLight position={[-4, 2, -4]} intensity={look.light.rimIntensity * 8} color={look.light.rim} distance={20} />

      {/* Studio softboxes, seen only in reflections: what makes metal read as metal. */}
      <Environment resolution={256} frames={Infinity}>
        <color attach="background" args={["#000000"]} />
        {/* Behind the subject: tall strips that slide sideways — the rim and edge glints. */}
        {Array.from({ length: look.light.strips }, (_, i) => {
          const x = (i / Math.max(1, look.light.strips - 1) - 0.5) * 10 + sweep;
          return (
            <Lightformer key={`b${i}`} form="rect" intensity={look.light.stripIntensity} position={[x, 2, -6]} scale={[0.6, 10, 1]} />
          );
        })}
        {/* Behind the camera: a big soft box and one moving strip — what the front faces reflect. */}
        <Lightformer form="rect" intensity={look.light.stripIntensity * 0.12} position={[0, 1, 8]} rotation={[0, Math.PI, 0]} scale={[14, 6, 1]} />
        <Lightformer
          form="rect"
          intensity={look.light.stripIntensity * 1.4}
          position={[-sweep * 2.2, 1, 7]}
          rotation={[0, Math.PI, 0.35]}
          scale={[1.2, 14, 1]}
        />
        <Lightformer form="rect" intensity={look.light.stripIntensity * 0.5} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 2, 1]} />
        <Lightformer form="ring" color={look.light.rim} intensity={look.light.rimIntensity} position={[6, 0, 4]} scale={3} />
      </Environment>

      {children}

      {/*
        Over a footage plate (transparent) the post chain is skipped: its passes
        write opaque pixels and would hide the plate. The plate brings its own
        depth and grain; grade-finish adds glow and halation on the final file.
      */}
      {!transparent && (
      <EffectComposer multisampling={4} enableNormalPass={false}>
        {[
          look.post.bokeh > 0 ? (
            <DepthOfField
              key="dof"
              worldFocusDistance={Math.hypot(focusPoint[0] - position[0], focusPoint[1] - position[1], focusPoint[2] - position[2])}
              worldFocusRange={focusRange}
              bokehScale={look.post.bokeh}
            />
          ) : null,
          <Bloom key="bloom" mipmapBlur intensity={look.post.bloom} luminanceThreshold={look.post.bloomThreshold} luminanceSmoothing={0.2} />,
          <ChromaticAberration key="ca" offset={new THREE.Vector2(ca, ca * 0.6)} radialModulation modulationOffset={0.3} />,
          <Vignette key="vig" offset={0.25} darkness={look.post.vignette} />,
          <ToneMapping key="tm" mode={ToneMappingMode.AGX} />,
        ].filter((e): e is React.JSX.Element => e !== null)}
      </EffectComposer>
      )}
      <FrameSync />
    </>
  );
}
