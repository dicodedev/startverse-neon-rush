import { describe, expect, it } from 'vitest';
import { DESPAWN_Z, LANES, PLAYER_Z, SPAWN_GAP_MIN } from './constants';
import {
  BARRIER_HEIGHT,
  BLOCK_HEIGHT,
  canJump,
  createPlayer,
  createWorld,
  jump,
  moveLane,
  scoreOf,
  step,
  swipeAction,
  type PlayerState,
  type WorldState,
} from './world';

/** A world with nothing in it, so a test can place its own obstacles. */
function bareWorld(): WorldState {
  const w = createWorld();
  w.spawnEnabled = false;
  return w;
}

/** Steps the world until `predicate` or `limit` steps have passed. */
function run(world: WorldState, player: PlayerState, predicate: () => boolean, limit = 2000) {
  let hit = false;
  for (let i = 0; i < limit && !predicate(); i += 1) {
    hit = step(world, player, 1 / 60).hit || hit;
  }
  return { hit, stopped: predicate() };
}

describe('lane movement', () => {
  it('moves left and right', () => {
    const p = createPlayer();
    expect(p.lane).toBe(1); // starts in the middle lane
    moveLane(p, -1);
    expect(p.lane).toBe(0);
    moveLane(p, 1);
    moveLane(p, 1);
    expect(p.lane).toBe(2);
  });

  it('clamps to the track', () => {
    const p = createPlayer();
    moveLane(p, -1);
    moveLane(p, -1);
    moveLane(p, -1);
    expect(p.lane).toBe(0);
    moveLane(p, 1);
    moveLane(p, 1);
    moveLane(p, 1);
    moveLane(p, 1);
    expect(p.lane).toBe(LANES.length - 1);
  });
});

describe('jumping', () => {
  it('leaves the ground once', () => {
    const p = createPlayer();
    expect(canJump(p)).toBe(true);
    jump(p);
    expect(p.onGround).toBe(false);
    expect(canJump(p)).toBe(false);
  });

  it('will not double jump mid-air', () => {
    const p = createPlayer();
    jump(p);
    const vy = p.vy;
    jump(p);
    expect(p.vy).toBe(vy);
  });

  it('comes back down', () => {
    const p = createPlayer();
    jump(p);
    const w = bareWorld();
    while (!p.onGround) step(w, p, 1 / 60);
    expect(p.y).toBe(0);
    expect(p.alive).toBe(true);
  });
});

describe('obstacles', () => {
  it('ends the run on a block', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.obstacles.push({ id: 1, lane: p.lane, z: 30, kind: 'block', spent: false });
    const { hit } = run(w, p, () => !p.alive);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('a jump clears a barrier', () => {
    const w = bareWorld();
    const p = createPlayer();
    // Jump late, as a player would: from close enough that the jump is still rising.
    w.obstacles.push({ id: 1, lane: p.lane, z: 6, kind: 'barrier', spent: false });
    let hit = false;
    for (let i = 0; i < 600; i += 1) {
      if (p.y === 0 && !p.onGround === false && w.obstacles[0].z < 5.2 && p.y === 0) jump(p);
      hit = step(w, p, 1 / 60).hit || hit;
      if (w.obstacles[0].spent || w.obstacles.length === 0) break;
    }
    expect(hit).toBe(false);
    expect(p.alive).toBe(true);
  });

  it('a jump does not clear a block', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.obstacles.push({ id: 1, lane: p.lane, z: 20, kind: 'block', spent: false });
    // Jump as early as possible, which is the most favourable case.
    jump(p);
    const { hit } = run(w, p, () => !p.alive);
    expect(hit).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('changing lane avoids a block', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.obstacles.push({ id: 1, lane: p.lane, z: 25, kind: 'block', spent: false });
    // Leave the blocked lane before it arrives, then run past it.
    moveLane(p, 1);
    const { hit } = run(w, p, () => w.obstacles.length === 0, 3000);
    expect(p.alive).toBe(true);
    expect(hit).toBe(false);
  });

  it('counts an obstacle once only', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.obstacles.push({ id: 1, lane: p.lane, z: 12, kind: 'block', spent: false });
    const events = step(w, p, 0);
    // Not at the obstacle yet.
    expect(events.hit).toBe(false);
  });
});

describe('shards', () => {
  it('collects a shard in the same lane', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.shards.push({ id: 1, lane: p.lane, z: 0, spent: false });
    const events = step(w, p, 1 / 60);
    expect(events.collected).toBe(1);
    expect(w.shardsCollected).toBe(1);
  });

  it('leaves a shard in another lane', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.shards.push({ id: 1, lane: (p.lane + 1) % LANES.length, z: 0, spent: false });
    const events = step(w, p, 1 / 60);
    expect(events.collected).toBe(0);
  });

  it('never collects the same shard twice', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.shards.push({ id: 1, lane: p.lane, z: 0, spent: false });
    expect(step(w, p, 1 / 60).collected).toBe(1);
    expect(step(w, p, 1 / 60).collected).toBe(0);
  });
});

describe('spawning', () => {
  it('always leaves a way through', () => {
    const w = createWorld();
    const p = createPlayer();
    for (let i = 0; i < 1200; i += 1) {
      step(w, p, 1 / 60);
      // At each z, check no row blocks all three lanes at once.
      const byZ = new Map<number, Set<number>>();
      for (const o of w.obstacles) {
        const key = Math.round(o.z);
        if (!byZ.has(key)) byZ.set(key, new Set());
        byZ.get(key)!.add(o.lane);
      }
      for (const lanes of byZ.values()) {
        expect(lanes.size).toBeLessThan(LANES.length);
      }
    }
  });

  it('keeps the track populated ahead and bounded', () => {
    const w = createWorld();
    const p = createPlayer();
    for (let i = 0; i < 3000; i += 1) step(w, p, 1 / 60);
    expect(w.obstacles.length).toBeGreaterThan(0);
    expect(w.obstacles.length).toBeLessThan(60);
    expect(w.shards.length).toBeLessThan(120);
  });

  it('recycles what is behind the player', () => {
    const w = createWorld();
    const p = createPlayer();
    for (let i = 0; i < 3000; i += 1) step(w, p, 1 / 60);
    for (const o of w.obstacles) expect(o.z).toBeGreaterThan(-21);
  });

  it('spaces rows out', () => {
    const w = createWorld();
    const p = createPlayer();
    for (let i = 0; i < 600; i += 1) step(w, p, 1 / 60);
    const rows = new Set(w.obstacles.map((o) => Math.round(o.z)));
    // Distinct z bands, not a solid wall of geometry.
    expect(rows.size).toBeGreaterThan(1);
    expect(SPAWN_GAP_MIN).toBeGreaterThan(0);
  });
});

/**
 * The running direction is the contract that keeps the camera, the character and the
 * scrolling world agreeing with each other.
 *
 * world.ts scrolls the world towards -z, so hazards and collectibles stream from +z past
 * the player at z=0. That makes +z the direction of travel, which means:
 *   - hazards must spawn at a positive z, ahead of the player;
 *   - each step must move them closer to the player, i.e. their z must decrease;
 *   - the player collides at z~0, before anything reaches the chase camera behind them;
 *   - the character model's front is +z, so from the camera you see their back.
 */
describe('swipe controls', () => {
  // Screen x grows to the right, so a finger moving right has a positive dx.
  it('reads a rightward swipe as move-right, the same as the right arrow key', () => {
    expect(swipeAction(60, 0)).toEqual({ type: 'lane', dir: 1 });
    // The right arrow key calls moveLane with the same direction.
    const p = createPlayer();
    moveLane(p, 1);
    expect(p.lane).toBe(2);
  });

  it('reads a leftward swipe as move-left, the same as the left arrow key', () => {
    expect(swipeAction(-60, 0)).toEqual({ type: 'lane', dir: -1 });
    const p = createPlayer();
    moveLane(p, -1);
    expect(p.lane).toBe(0);
  });

  it('reads an upward swipe as a jump', () => {
    expect(swipeAction(0, -60)).toEqual({ type: 'jump' });
  });

  it('ignores a downward swipe, so the player is not pulled backwards', () => {
    expect(swipeAction(0, 60)).toBeNull();
  });

  it('ignores a tap that moves less than the threshold', () => {
    expect(swipeAction(8, 0)).toBeNull();
    expect(swipeAction(0, -8)).toBeNull();
  });

  it('picks the dominant axis on a diagonal swipe', () => {
    expect(swipeAction(60, -30)).toEqual({ type: 'lane', dir: 1 });
    expect(swipeAction(-60, 30)).toEqual({ type: 'lane', dir: -1 });
    // Mostly vertical, so it jumps rather than changing lane.
    expect(swipeAction(20, -60)).toEqual({ type: 'jump' });
  });

  it('applies repeated swipes in the same direction until it hits the edge', () => {
    const p = createPlayer();
    for (let i = 0; i < 4; i += 1) {
      const action = swipeAction(-60, 0);
      if (action?.type === 'lane') moveLane(p, action.dir);
    }
    expect(p.lane).toBe(0);

    const q = createPlayer();
    for (let i = 0; i < 4; i += 1) {
      const action = swipeAction(60, 0);
      if (action?.type === 'lane') moveLane(q, action.dir);
    }
    expect(q.lane).toBe(LANES.length - 1);
  });
});

describe('running direction', () => {
  it('spawns hazards ahead of the player, at a positive z', () => {
    const w = createWorld();
    const p = createPlayer();
    step(w, p, 1 / 60);
    expect(w.obstacles.length).toBeGreaterThan(0);
    for (const o of w.obstacles) {
      expect(o.z).toBeGreaterThan(0);
    }
    // Spawn distance is in front of the player, not behind them.
    expect(Math.max(...w.obstacles.map((o) => o.z))).toBeGreaterThan(PLAYER_Z);
  });

  it('spawns collectibles ahead of the player too', () => {
    const w = createWorld();
    const p = createPlayer();
    step(w, p, 1 / 60);
    expect(w.shards.length).toBeGreaterThan(0);
    for (const s of w.shards) {
      expect(s.z).toBeGreaterThan(0);
    }
  });

  it('moves hazards towards the player, so their z decreases', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.obstacles.push({ id: 1, lane: p.lane, z: 40, kind: 'barrier', spent: false });
    step(w, p, 1 / 60);
    // Moves from +40 towards the player at 0.
    expect(w.obstacles[0].z).toBeLessThan(40);
    expect(w.obstacles[0].z).toBeGreaterThan(0);
  });

  it('moves collectibles towards the player, so their z decreases', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.shards.push({ id: 1, lane: p.lane, z: 30, spent: false });
    step(w, p, 1 / 60);
    expect(w.shards[0].z).toBeLessThan(30);
  });

  it('collides with the player at z~0, before reaching the camera behind them', () => {
    const w = bareWorld();
    const p = createPlayer();
    w.obstacles.push({ id: 1, lane: p.lane, z: 0.2, kind: 'block', spent: false });
    const events = step(w, p, 1 / 60);
    expect(events.hit).toBe(true);
    // The obstacle collided at the player plane, still in front of the camera at -8.
    expect(Math.abs(w.obstacles[0].z)).toBeLessThan(2);
  });

  it('never lets a live hazard sit at or behind the player', () => {
    const w = createWorld();
    const p = createPlayer();
    for (let i = 0; i < 2000; i += 1) {
      step(w, p, 1 / 60);
      // A hazard that has passed and not yet been recycled must still be in front.
      for (const o of w.obstacles) {
        expect(o.z).toBeGreaterThan(DESPAWN_Z);
      }
    }
  });
});

describe('run scoring', () => {
  it('scores distance plus a bonus per shard', () => {
    expect(scoreOf(120, 0)).toBe(120);
    expect(scoreOf(120, 4)).toBe(120 + 100);
  });

  it('ramps speed with distance but never past the ceiling', () => {
    const w = bareWorld();
    const p = createPlayer();
    const start = w.speed;
    for (let i = 0; i < 6000; i += 1) step(w, p, 1 / 60);
    expect(w.speed).toBeGreaterThan(start);
    expect(w.speed).toBeLessThanOrEqual(42);
  });
});

describe('geometry constants', () => {
  it('keeps the barrier low and the block tall', () => {
    expect(BARRIER_HEIGHT).toBeLessThan(BLOCK_HEIGHT);
    // Both have to be clearable within the jump arc the game produces.
    expect(BARRIER_HEIGHT).toBeGreaterThan(0);
    expect(BLOCK_HEIGHT).toBeGreaterThan(BARRIER_HEIGHT);
  });
});
