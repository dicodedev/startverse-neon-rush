import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_FOV, CAMERA_POSITION, CAMERA_TARGET, LANES } from './constants';

/**
 * Lanes are numbered by what the player sees: index 0 is the leftmost lane on screen and
 * the last index is the rightmost. `moveLane(+1)` is "move right" for both the keyboard and
 * the touch controls, so that ordering has to hold for the camera the game actually uses.
 *
 * A camera looking along +z puts world +x on the screen's left, which is easy to get
 * backwards. These tests project the lanes through the real camera rather than trusting
 * the array order, so a mirrored track fails here.
 */

/** The camera exactly as App.tsx configures it, at the player's height. */
function cameraAtRun() {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 900 / 620, 0.1, 220);
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(...CAMERA_TARGET);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/** Where a lane's centre lands on screen. Negative is left, positive is right. */
function screenX(lane: number, camera = cameraAtRun()): number {
  return new THREE.Vector3(LANES[lane], 1.3, 0).project(camera).x;
}

describe('lane order on screen', () => {
  it('puts lane 0 on the left and the last lane on the right', () => {
    expect(screenX(0)).toBeLessThan(0);
    expect(screenX(LANES.length - 1)).toBeGreaterThan(0);
  });

  it('increases towards the right as the lane index grows', () => {
    const xs = LANES.map((_, i) => screenX(i));
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('keeps the middle lane in the middle', () => {
    expect(screenX(1)).toBeCloseTo(0, 2);
  });

  it('spaces the lanes evenly', () => {
    const [left, middle, right] = LANES.map((_, i) => screenX(i));
    expect(middle - left).toBeCloseTo(right - middle, 5);
  });

  it('is not mirrored by the camera', () => {
    // Looking along +z puts world +x on the left, so the leftmost lane must be the most
    // positive x. If this ever flips back, every lane control inverts again.
    expect(LANES[0]).toBeGreaterThan(LANES[LANES.length - 1]);
  });
});

describe('move direction follows the lane order', () => {
  it('moves right for dir=1 and left for dir=-1', async () => {
    const { createPlayer, moveLane } = await import('./world');

    const right = createPlayer();
    moveLane(right, 1);
    expect(screenX(right.lane)).toBeGreaterThan(screenX(1));

    const left = createPlayer();
    moveLane(left, -1);
    expect(screenX(left.lane)).toBeLessThan(screenX(1));
  });

  it('stops at both edges', async () => {
    const { createPlayer, moveLane } = await import('./world');

    const atLeft = createPlayer();
    for (let i = 0; i < 5; i += 1) moveLane(atLeft, -1);
    expect(atLeft.lane).toBe(0);
    expect(screenX(atLeft.lane)).toBeLessThan(0);

    const atRight = createPlayer();
    for (let i = 0; i < 5; i += 1) moveLane(atRight, 1);
    expect(atRight.lane).toBe(LANES.length - 1);
    expect(screenX(atRight.lane)).toBeGreaterThan(0);
  });
});
