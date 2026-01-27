import * as THREE from "three";
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";

type Props = {
  thumbnailUrl: string | null;
  dim?: number;
  overlayBlend?: number;
  blendMode?: "normal" | "screen" | "multiply" | "overlay";
};

export function ThumbnailBackdrop({
  thumbnailUrl,
  dim = 0.25,
  overlayBlend = 0.25,
  blendMode = "screen",
}: Props) {
  const texture = useMemo(() => {
    if (!thumbnailUrl) return null;
    const tex = new THREE.TextureLoader().load(thumbnailUrl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [thumbnailUrl]);

  const blending = useMemo(() => {
    switch (blendMode) {
      case "screen":
        return THREE.AdditiveBlending;
      case "multiply":
        return THREE.MultiplyBlending;
      case "overlay":
        return THREE.NormalBlending;
      default:
        return THREE.NormalBlending;
    }
  }, [blendMode]);

  if (!texture) return null;

  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={blending}
        uniforms={{
          uTexture: { value: texture },
          uDim: { value: dim },
          uOverlayBlend: { value: overlayBlend },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision highp float;
          varying vec2 vUv;
          uniform sampler2D uTexture;
          uniform float uDim;
          uniform float uOverlayBlend;
          
          void main() {
            vec4 texColor = texture2D(uTexture, vUv);
            vec3 color = texColor.rgb * (1.0 - uDim);
            float alpha = texColor.a * uOverlayBlend;
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  );
}
