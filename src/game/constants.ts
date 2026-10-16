/** Lane and world layout for the Neon Rush track. */

/** Lane centre positions on x. Three lanes, like a classic lane runner. */
export const LANES = [-2.4, 0, 2.4] as const;
export const LANE_WIDTH = 2.4;

/** How far the track is drawn ahead of and behind the player. */
export const TRACK_AHEAD = 90;
/**
 * The floor runs a little behind the player so the ground does not end at their feet.
 * Tall geometry (rails, dividers) stops at the player plane instead, because anything
 * between the camera and the player would smear across the screen in the foreground.
 */
export const TRACK_BEHIND = 12;

/** The player stands still on x/z and the world moves towards them, which keeps the
 *  character centred and makes collision maths trivial. */
export const START_SPEED = 14;
export const MAX_SPEED = 42;
/** Metres per second of speed gain. Reaches MAX_SPEED after roughly 45 seconds. */
export const SPEED_RAMP = 0.62;

export const GRAVITY = 62;
export const JUMP_VELOCITY = 19;

/** Distances ahead of the player at which obstacles and shards are spawned. */
export const SPAWN_Z = TRACK_AHEAD - 10;
/** Everything further ahead than this is recycled. */
export const DESPAWN_Z = -TRACK_BEHIND;

export const SPAWN_GAP_MIN = 12;
export const SPAWN_GAP_MAX = 22;

/** Collision boxes, in the same units as the character (~2.6 tall). */
export const PLAYER_HALF_WIDTH = 0.42;
export const PLAYER_HEIGHT = 2.6;
export const OBSTACLE_HALF_WIDTH = 0.85;
export const SHARD_RADIUS = 0.55;

/** A shard is worth this many points on top of the distance score. */
export const SHARD_SCORE = 25;

/** The player's start.ng character, in world units, matching createCharacter(). */
export const PLAYER_Z = 0;
