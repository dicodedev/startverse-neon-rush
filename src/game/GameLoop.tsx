import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import { useGame } from './store';
import { step, type PlayerState, type WorldState } from './world';

/** How often the HUD is refreshed from the mutable world state. */
const HUD_INTERVAL_MS = 80;

/**
 * Drives the run.
 *
 * This lives inside the Canvas so it shares the render loop's frame timing, and it reads
 * and writes mutable refs rather than React state, so a run never triggers a re-render.
 * The HUD is refreshed on a timer instead, which is all a player can actually read.
 */
export function GameLoop({
  worldRef,
  playerRef,
  onHit,
}: {
  worldRef: MutableRefObject<WorldState>;
  playerRef: MutableRefObject<PlayerState>;
  onHit: () => void;
}) {
  const sinceHud = useRef(0);

  useFrame((_, delta) => {
    if (useGame.getState().phase !== 'running') return;

    // Clamped so a backgrounded tab does not teleport obstacles into the player.
    const dt = Math.min(delta, 1 / 30);
    const events = step(worldRef.current, playerRef.current, dt);

    if (events.hit) {
      onHit();
      return;
    }

    sinceHud.current += dt * 1000;
    if (sinceHud.current >= HUD_INTERVAL_MS) {
      sinceHud.current = 0;
      const { distance, shardsCollected, elapsed } = worldRef.current;
      useGame.getState().setStats({
        distance,
        shards: shardsCollected,
        survived: elapsed,
      });
    }
  });

  return null;
}
