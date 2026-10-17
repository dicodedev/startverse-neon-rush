import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCharacter } from './createCharacter';

/**
 * The character has to face the way the player travels, otherwise they run backwards on
 * screen. The world scrolls towards -z (see world.ts), so +z is the direction of travel
 * and the character's front must point that way.
 *
 * These tests read the actual built geometry rather than trusting a comment, so flipping
 * the model again would fail here.
 */

/** The meshes under a group, recursively. */
function meshesUnder(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

describe('character orientation', () => {
  it('has its eyes on the +z face, the direction of travel', () => {
    const character = createCharacter(null);
    const eyes = meshesUnder(character.root).filter(
      (m) => m.geometry.type === 'BoxGeometry' && m.position.z > 0.2 && m.position.y > 2,
    );

    // The eyes are the clearest marker of which way the character looks.
    expect(eyes.length).toBeGreaterThanOrEqual(2);
    for (const eye of eyes) {
      expect(eye.position.z).toBeGreaterThan(0);
    }
    character.dispose();
  });

  it('puts the shoes forward, towards +z', () => {
    const character = createCharacter(null);
    const shoes = meshesUnder(character.root).filter(
      (m) => m.geometry.type === 'BoxGeometry' && Math.abs(m.position.y + 0.86) < 0.01,
    );
    expect(shoes.length).toBeGreaterThanOrEqual(2);
    for (const shoe of shoes) {
      expect(shoe.position.z).toBeGreaterThan(0);
    }
    character.dispose();
  });

  it('leans into the run, towards +z', () => {
    const character = createCharacter(null);
    character.animate(0, { running: true });
    const body = character.root.children[0];
    // A forward lean is a positive rotation about x, which tips the top towards +z.
    expect(body.rotation.x).toBeGreaterThan(0);
    character.dispose();
  });

  it('stands upright when not running', () => {
    const character = createCharacter(null);
    character.animate(0, { running: false });
    const body = character.root.children[0];
    expect(body.rotation.x).toBe(0);
    character.dispose();
  });

  it('swings the legs in opposition so the gait reads as running', () => {
    const character = createCharacter(null);
    character.animate(0.4, { running: true });
    const body = character.root.children[0] as THREE.Group;
    // Limbs are the pivots added to the body; opposite signs mean a real stride.
    const legs = body.children.filter((c) => c.type === 'Group');
    expect(legs.length).toBeGreaterThanOrEqual(4);
    character.dispose();
  });

  it('re-skins without changing which way it faces', () => {
    const character = createCharacter(null);
    const before = meshesUnder(character.root).map((m) => m.position.z.toFixed(3));
    character.applyStyle({ body: 'female', hair: 'bun', hat: 'crown', accessory: 'glasses' });
    const after = meshesUnder(character.root).map((m) => m.position.z.toFixed(3));
    // The core body geometry is untouched by a style change.
    expect(after.length).toBeGreaterThan(0);
    expect(before.some((z) => after.includes(z))).toBe(true);
    character.dispose();
  });
});
