/** Lane and world layout for the Neon Rush track. */

/**
 * Lane centre positions on x, ordered by how the player sees them: index 0 is the
 * leftmost lane on screen and the last index is the rightmost.
 *
 * The array descends because the chase camera looks along +z (the direction of travel, see
 * world.ts). In a right-handed coordinate system, looking along +z puts world +x on the
 * screen's LEFT, so the leftmost lane is the one at the most positive x. Keeping this
 * ordering is what makes `moveLane(+1)` mean "move right" for both the keyboard and the
 * touch controls, which assume nothing about the camera.
 */
export const LANES = [2.4, 0, -2.4] as const;
export const LANE_WIDTH = 2.4;

/**
 * The chase camera, behind the player on -z and looking towards +z, the direction of
 * travel. Exported so the camera and the lane mapping can be checked against each other.
 */
export const CAMERA_POSITION = [0, 4, -8] as const;
export const CAMERA_TARGET = [0, 1.2, 3] as const;
export const CAMERA_FOV = 50;

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
