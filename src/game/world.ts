import {
  DESPAWN_Z,
  GRAVITY,
  JUMP_VELOCITY,
  LANES,
  MAX_SPEED,
  OBSTACLE_HALF_WIDTH,
  PLAYER_HEIGHT,
  SHARD_RADIUS,
  SHARD_SCORE,
  SPAWN_GAP_MAX,
  SPAWN_GAP_MIN,
  SPAWN_Z,
  START_SPEED,
} from './constants';

/**
 * The rules of Neon Rush, with no three.js in sight so they can be unit tested.
 *
 * The player stays put and the world moves past them: obstacles and shards travel towards
 * negative z. The player only ever changes lane (x) and jumps (y).
 */

/** Height of a `block`. Too tall to jump, so the lane has to be changed. */
export const BLOCK_HEIGHT = 3.2;
/** Height of a `barrier`. Low enough to clear with a jump. */
export const BARRIER_HEIGHT = 1.0;

export type ObstacleKind = 'block' | 'barrier';

export interface Obstacle {
  id: number;
  lane: number;
  z: number;
  kind: ObstacleKind;
  /** Set once it has been passed or hit, so it is never scored twice. */
  spent: boolean;
}

export interface Shard {
  id: number;
  lane: number;
  z: number;
  spent: boolean;
}

export interface PlayerState {
  lane: number;
  y: number;
  vy: number;
  onGround: boolean;
  alive: boolean;
}

export interface WorldState {
  obstacles: Obstacle[];
  shards: Shard[];
  nextId: number;
  /** Set to false to run a hand-placed scene without new rows appearing. Used by tests. */
  spawnEnabled?: boolean;
  /** Metres run so far. */
  distance: number;
  /** Shards collected so far. */
  shardsCollected: number;
  elapsed: number;
  speed: number;
}

export interface StepEvents {
  collected: number;
  /** True on the step the player is hit. */
  hit: boolean;
}

export function createWorld(): WorldState {
  return {
    obstacles: [],
    shards: [],
    nextId: 1,
    distance: 0,
    shardsCollected: 0,
    elapsed: 0,
    speed: START_SPEED,
  };
}

export function createPlayer(): PlayerState {
  return { lane: 1, y: 0, vy: 0, onGround: true, alive: true };
}

/** Moves one lane left or right, clamped to the track. */
export function moveLane(player: PlayerState, dir: -1 | 1): void {
  player.lane = Math.max(0, Math.min(LANES.length - 1, player.lane + dir));
}

export function canJump(player: PlayerState): boolean {
  return player.onGround && player.alive;
}

export function jump(player: PlayerState): void {
  if (!canJump(player)) return;
  player.vy = JUMP_VELOCITY;
  player.onGround = false;
}

/** Advances the world by `dt` seconds and reports what happened. */
export function step(world: WorldState, player: PlayerState, dt: number): StepEvents {
  const events: StepEvents = { collected: 0, hit: false };

  // Speed ramps with distance so the run gets harder, up to a ceiling.
  world.speed = Math.min(MAX_SPEED, START_SPEED + world.distance * 0.0062);
  const travel = world.speed * dt;

  world.distance += travel;
  world.elapsed += dt;

  if (!player.onGround) {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
    }
  }

  for (const o of world.obstacles) o.z -= travel;
  for (const s of world.shards) s.z -= travel;

  spawnAhead(world);

  // Recycle anything that has gone past the player.
  if (world.obstacles.some((o) => o.z <= DESPAWN_Z)) {
    world.obstacles = world.obstacles.filter((o) => o.z > DESPAWN_Z);
  }
  if (world.shards.some((s) => s.z <= DESPAWN_Z)) {
    world.shards = world.shards.filter((s) => s.z > DESPAWN_Z);
  }

  if (!player.alive) return events;

  // Shards are picked up by being in the same lane at the same z.
  for (const s of world.shards) {
    if (s.spent || s.lane !== player.lane) continue;
    if (Math.abs(s.z) > SHARD_RADIUS + 0.6) continue;
    s.spent = true;
    world.shardsCollected += 1;
    events.collected += 1;
  }

  for (const o of world.obstacles) {
    if (o.spent || o.lane !== player.lane) continue;
    if (Math.abs(o.z) > OBSTACLE_HALF_WIDTH + 0.5) continue;

    // Jumping clears a barrier; only changing lane clears a block.
    const height = o.kind === 'barrier' ? BARRIER_HEIGHT : BLOCK_HEIGHT;
    if (player.y >= height) {
      o.spent = true; // cleared it
      continue;
    }

    o.spent = true;
    player.alive = false;
    events.hit = true;
  }

  return events;
}

/** The tallest thing the player's feet can clear. Used to decide jump timing. */
export function clearance(): number {
  return Math.min(BLOCK_HEIGHT, BARRIER_HEIGHT) - 0.15;
}

/**
 * Keeps roughly SPAWN_Z metres of track populated ahead of the player.
 *
 * This measures the furthest obstacle actually still in the world rather than keeping a
 * cursor, because rows are consumed as the player runs past them and a cursor would stop
 * refilling the track after the first screenful.
 */
function spawnAhead(world: WorldState): void {
  if (world.spawnEnabled === false) return;
  // A guard, so a bad gap can never spin here.
  for (let added = 0; added < 8; added += 1) {
    let farthest = 0;
    for (const o of world.obstacles) farthest = Math.max(farthest, o.z);
    if (farthest >= SPAWN_Z) return;

    const gap = SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
    const z = Math.max(farthest + gap, 24);

    // Always leave exactly one lane open, so there is a way through every row.
    const openLane = Math.floor(Math.random() * LANES.length);
    const useBarrier = Math.random() < 0.45;

    for (let lane = 0; lane < LANES.length; lane += 1) {
      if (lane === openLane) continue;
      world.obstacles.push({
        id: world.nextId++,
        lane,
        z,
        // Barriers only appear on the lane next to the gap, so the block read stays clear.
        kind: useBarrier && lane === (openLane + 1) % LANES.length ? 'barrier' : 'block',
        spent: false,
      });
    }

    // A trail of shards down the open lane: the reward for reading the gap.
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i += 1) {
      world.shards.push({
        id: world.nextId++,
        lane: openLane,
        z: z - 4 - i * 2.2,
        spent: false,
      });
    }
  }
}

/** The number a run is scored on: distance, plus a bonus for each shard. */
export function scoreOf(distance: number, shards: number): number {
  return Math.round(distance) + shards * SHARD_SCORE;
}

/** The player's feet height. Exported for the renderer and tests. */
export function feetHeight(player: PlayerState): number {
  return Math.max(0, Math.min(player.y, PLAYER_HEIGHT));
}

export { GRAVITY };
