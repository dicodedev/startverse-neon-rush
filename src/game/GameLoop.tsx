import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import { play } from '../audio/sfx';
import { useGame } from './store';
import {
  step,
  type PlayerState,
  type PickedShard,
  type WorldState,
} from './world';

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
  onWin,
  onPickup,
  onCheckpoint,
}: {
  worldRef: MutableRefObject<WorldState>;
  playerRef: MutableRefObject<PlayerState>;
  onHit: () => void;
  onWin: () => void;
  /** Called with every treat collected, for the pickup animation. */
  onPickup: (picked: PickedShard[]) => void;
  /** Called with the distance of a checkpoint reached. */
  onCheckpoint: (distance: number) => void;
}) {
  const sinceHud = useRef(0);

  useFrame((_, delta) => {
    if (useGame.getState().phase !== 'running') return;

    // Clamped so a backgrounded tab does not teleport obstacles into the player.
    const dt = Math.min(delta, 1 / 30);
    const events = step(worldRef.current, playerRef.current, dt);

    // One sound per frame even if several treats were taken at once, so a trail of treats
    // cannot stack into a roar.
    if (events.picked.length > 0) {
      onPickup(events.picked);
      play('collect');
    }

    if (events.checkpoint !== null) onCheckpoint(events.checkpoint);

    if (events.finished) {
      onWin();
      return;
    }

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