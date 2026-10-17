import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { LANES } from './constants';
import type { PickedShard } from './world';

/**
 * The pickup animation for collected treats.
 *
 * A collected treat flies up and away from the player, spinning as it goes, fading and
 * shrinking, with a ring and a few sparks flaring at the moment it was taken. Then it is
 * recycled.
 *
 * Everything is preallocated: a fixed pool of bursts, each with a fixed set of sparks, with
 * no object created per frame and no allocation on pickup. That matters here because pickups
 * happen mid-run on a phone, and a particle system that allocates is exactly what makes a
 * runner stutter. The pool is small on purpose for the same reason.
 */

/** Enough for a long trail of treats taken in quick succession. */
const BURST_POOL = 20;
const SPARKS_PER_BURST = 5;

/** How long a pickup lasts, in seconds. Short enough never to get in the way. */
const DURATION = 0.55;

/** How high a treat flies, in world units. */
const RISE = 5.5;
/** How far it drifts back towards the camera, giving the arc. */
const DRIFT_BACK = 2.6;
/** Lateral sway, so a burst of treats does not rise as one flat line. */
const SWAY = 1.1;

interface Burst {
  active: boolean;
  age: number;
  /** Seeded per burst so repeated pickups do not look identical. */
  seed: number;
  x: number;
  y: number;
  z: number;
  sparks: { dx: number; dy: number; dz: number }[];
}

const makeBurst = (): Burst => ({
  active: false,
  age: 0,
  seed: 0,
  x: 0,
  y: 0,
  z: 0,
  sparks: Array.from({ length: SPARKS_PER_BURST }, () => ({ dx: 0, dy: 0, dz: 0 })),
});

export interface TreatBurstsProps {
  /**
   * Read every frame rather than passed as a prop, so a pickup does not re-render React.
   * `takePending` drains the queue and returns whatever is waiting.
   */
  takePending: () => PickedShard[];
}

export function TreatBursts({ takePending }: TreatBurstsProps) {
  const bursts = useMemo(() => Array.from({ length: BURST_POOL }, makeBurst), []);
  const burstRefs = useRef<(THREE.Group | null)[]>([]);
  const shardRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sparkRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);

    // Start a burst for each treat taken since the last frame, reusing a free slot.
    const pending = takePending();
    for (const picked of pending) {
      const burst = bursts.find((b) => !b.active);
      if (!burst) break; // pool is full, skip rather than stutter
      burst.active = true;
      burst.age = 0;
      burst.seed = picked.id * 1.618;
      burst.x = LANES[picked.lane];
      burst.y = 1.1;
      burst.z = picked.z;
      for (const spark of burst.sparks) {
        // Deterministic spread from the seed, so no randomness cost per pickup.
        spark.dx = (((burst.seed * 7 + spark.dx * 13) % 1) - 0.5) * 2.4;
        spark.dy = 1.4 + ((burst.seed * 11) % 1) * 1.8;
        spark.dz = (((burst.seed * 5) % 1) - 0.5) * 2.4;
      }
    }

    for (let i = 0; i < BURST_POOL; i += 1) {
      const burst = bursts[i];
      const group = burstRefs.current[i];
      const shard = shardRefs.current[i];
      const ring = ringRefs.current[i];
      if (!group || !shard || !ring) continue;

      if (!burst.active) {
        group.visible = false;
        continue;
      }

      burst.age += dt;
      const t = burst.age / DURATION;

      if (t >= 1) {
        // Recycle: hidden and reset, ready to be used again.
        burst.active = false;
        group.visible = false;
        continue;
      }

      group.visible = true;
      group.position.set(burst.x, burst.y, burst.z);

      // Upward with a slight backward curve, fading and shrinking out.
      const rise = Math.sin(t * Math.PI * 0.5) * RISE;
      const back = t * t * DRIFT_BACK;
      const sway = Math.sin(t * 5 + burst.seed) * SWAY * t;

      shard.position.set(sway, rise, back);
      shard.rotation.y = t * 9;
      shard.rotation.x = t * 5;

      // Bright for the first third, then out.
      const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      const scale = 1 - t * 0.75;
      shard.scale.setScalar(scale);

      const material = shard.material as THREE.MeshStandardMaterial;
      material.opacity = fade;
      material.transparent = true;

      // The ring flares out at the point of collection and shrinks away.
      const ringT = Math.min(1, t / 0.5);
      ring.scale.setScalar(0.3 + ringT * 2.6);
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - ringT) * 0.85;

      // Sparks fly out and fall slightly.
      for (let s = 0; s < SPARKS_PER_BURST; s += 1) {
        const spark = sparkRefs.current[i * SPARKS_PER_BURST + s];
        if (!spark) continue;
        const sparkData = burst.sparks[s];
        spark.position.set(
          sparkData.dx * ringT,
          rise + sparkData.dy * ringT - t * t * 2.4,
          back + sparkData.dz * ringT,
        );
        (spark.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - ringT * 1.2);
      }
    }
  });

  return (
    <>
      {Array.from({ length: BURST_POOL }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(el) => {
            burstRefs.current[i] = el;
          }}
        >
          {/* The treat itself, flying up. */}
          <mesh
            ref={(el) => {
              shardRefs.current[i] = el;
            }}
          >
            <octahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial
              color="#06ffa5"
              emissive="#06ffa5"
              emissiveIntensity={2.4}
              transparent
              opacity={1}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>

          {/* The flare at the moment of pickup. */}
          <mesh
            ref={(el) => {
              ringRefs.current[i] = el;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.42, 0.56, 20]} />
            <meshBasicMaterial
              color="#a855ff"
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>

          {/* Sparks, in the electric blue of the rest of the art direction. */}
          {Array.from({ length: SPARKS_PER_BURST }, (_, s) => (
            <mesh
              key={s}
              ref={(el) => {
                sparkRefs.current[i * SPARKS_PER_BURST + s] = el;
              }}
            >
              <tetrahedronGeometry args={[0.11, 0]} />
              <meshBasicMaterial
                color="#39ff88"
                transparent
                opacity={0}
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}