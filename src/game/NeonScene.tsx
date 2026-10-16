import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createCharacter, type Character } from '../character/createCharacter';
import type { CharacterStyle } from '../startng/types';
import { LANES, TRACK_AHEAD, TRACK_BEHIND } from './constants';
import { createGridTexture } from './gridTexture';
import type { PlayerState, WorldState } from './world';

/** Meshes kept in reserve so new obstacles never allocate during play. */
const OBSTACLE_POOL = 48;
const SHARD_POOL = 96;

const BLOCK_COLOR = '#ff2d95';
const BARRIER_COLOR = '#ffd23f';
const SHARD_COLOR = '#39ff88';

/**
 * The whole 3D world.
 *
 * Obstacles and shards are drawn from fixed pools whose transforms are rewritten every
 * frame from the mutable world state. React never re-renders during a run, which keeps a
 * frame budget for the character and the grid scroll.
 */
export function NeonScene({
  world,
  player,
  style,
  running,
}: {
  world: WorldState;
  player: PlayerState;
  style: CharacterStyle | null;
  running: boolean;
}) {
  const character: Character = useMemo(() => createCharacter(null), []);
  const gridTexture = useMemo(() => createGridTexture(), []);

  const characterRef = useRef<THREE.Group>(null);
  const floorRef = useRef<THREE.Mesh>(null);
  const obstacleRefs = useRef<(THREE.Group | null)[]>([]);
  const shardRefs = useRef<(THREE.Mesh | null)[]>([]);

  // The character is the player's own start.ng look, so re-skin it whenever it changes.
  useEffect(() => {
    character.applyStyle(style);
  }, [character, style]);

  useEffect(() => {
    return () => {
      character.dispose();
      gridTexture.dispose();
    };
  }, [character, gridTexture]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);

    // Slide the grid to match how fast the world is moving.
    gridTexture.offset.y -= (world.speed * dt) / 24;

    if (characterRef.current) {
      characterRef.current.position.x = LANES[player.lane];
      characterRef.current.position.y = player.y;
      character.animate(state.clock.elapsedTime, {
        running,
        // Faster legs as the run speeds up.
        speed: running ? 0.7 + world.speed / 26 : 0,
      });
    }

    // Obstacles: one pooled block/box per entry in the world.
    for (let i = 0; i < OBSTACLE_POOL; i += 1) {
      const group = obstacleRefs.current[i];
      if (!group) continue;
      const o = world.obstacles[i];
      if (!o) {
        group.visible = false;
        continue;
      }
      group.visible = true;
      group.position.set(LANES[o.lane], 0, o.z);

      // A barrier is a low, wide slab; a block is a tall slab.
      const isBarrier = o.kind === 'barrier';
      const block = group.children[0] as THREE.Mesh;
      const cap = group.children[1] as THREE.Mesh;
      block.scale.set(1, isBarrier ? 0.32 : 1, 1);
      cap.position.y = isBarrier ? 0.62 : 3.0;
      cap.scale.set(1, isBarrier ? 0.32 : 1, 1);
    }

    // Shards: spinning octahedra.
    for (let i = 0; i < SHARD_POOL; i += 1) {
      const mesh = shardRefs.current[i];
      if (!mesh) continue;
      const s = world.shards[i];
      if (!s) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(
        LANES[s.lane],
        1.1 + Math.sin(state.clock.elapsedTime * 3 + s.id) * 0.18,
        s.z,
      );
      mesh.rotation.y += dt * 3;
    }
  });

  return (
    <>
      <color attach="background" args={['#07030f']} />
      <fog attach="fog" args={['#07030f', 26, TRACK_AHEAD - 14]} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#39ff88', '#2b0a4a', 0.65]} />
      {/* The shadow camera is tightened around the player, because the default bounds
          spread it far too thin to give a readable contact shadow. */}
      <directionalLight
        position={[7, 15, 9]}
        intensity={1.15}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />

      {/* The floor is scrolled by texture offset, which is what sells the speed. */}
      <mesh
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, (TRACK_AHEAD - TRACK_BEHIND) / 2]}
        receiveShadow
      >
        <planeGeometry args={[40, TRACK_AHEAD + TRACK_BEHIND]} />
        <meshStandardMaterial map={gridTexture} emissive="#14603a" emissiveMap={gridTexture} />
      </mesh>

      {/* Neon rails marking the edge of the track. Kept slim, and starting at the player
          plane so nothing tall sits between the camera and the player. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 7.2, 0.35, TRACK_AHEAD / 2]}>
          <boxGeometry args={[0.12, 0.7, TRACK_AHEAD]} />
          <meshStandardMaterial
            color={SHARD_COLOR}
            emissive={SHARD_COLOR}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Lane dividers, so the three lanes are readable at speed. Lanes sit at -2.4, 0 and
          2.4, so the dividers go halfway between them. */}
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.02, TRACK_AHEAD / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, TRACK_AHEAD]} />
          <meshBasicMaterial color="#5b3fd6" toneMapped={false} transparent opacity={0.7} />
        </mesh>
      ))}

      {/* The player's start.ng character. */}
      <primitive object={character.root} ref={characterRef} />

      {/* Obstacle pool. */}
      {Array.from({ length: OBSTACLE_POOL }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(el) => {
            obstacleRefs.current[i] = el;
          }}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.7, 3, 0.6]} />
            <meshStandardMaterial
              color={BLOCK_COLOR}
              emissive={BLOCK_COLOR}
              emissiveIntensity={0.35}
              roughness={0.35}
            />
          </mesh>
          {/* A brighter cap along the top edge, which is what makes the hitbox readable. */}
          <mesh position={[0, 3, 0]}>
            <boxGeometry args={[1.86, 0.22, 0.72]} />
            <meshStandardMaterial
              color={BARRIER_COLOR}
              emissive={BARRIER_COLOR}
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Shard pool. */}
      {Array.from({ length: SHARD_POOL }, (_, i) => (
        <mesh
          key={i}
          visible={false}
          ref={(el) => {
            shardRefs.current[i] = el;
          }}
        >
          <octahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial
            color={SHARD_COLOR}
            emissive={SHARD_COLOR}
            emissiveIntensity={1.8}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}
