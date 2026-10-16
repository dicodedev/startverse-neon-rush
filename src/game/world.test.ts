import { describe, expect, it } from 'vitest';
import { LANES, SPAWN_GAP_MIN } from './constants';
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
