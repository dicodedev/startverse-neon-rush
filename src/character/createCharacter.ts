import * as THREE from 'three';
import { DEFAULT_STYLE, normalizeStyle } from './style';
import type { CharacterStyle, NormalizedStyle } from '../startng/types';

/**
 * A blocky runner whose whole look comes from the player's start.ng character.
 *
 * The character rule in the docs: "Your game has a player character: draw it from `style`,
 * so it looks like it does on start.ng. Your art style can differ (pixel art, low-poly...),
 * but keep the body, colours, hair, hat and accessory recognisable."
 *
 * This is that low-poly interpretation: a stylised figure wearing the player's actual
 * colours, hair, hat and accessory. It faces -z, feet at y=0, about 2.6 units tall.
 *
 * Structure follows the reference runner in Lane Dash (github.com/Blackburn0/HNG-Game),
 * rewritten here so it can be re-skinned without rebuilding geometry.
 */

/** How high a hat sits above the top of the head, so it rests on the hair rather than in it. */
const HAT_LIFT: Record<string, number> = {
  short: 0.1,
  afro: 0.32,
  braids: 0.1,
  bun: 0.12,
  ponytail: 0.1,
  dreads: 0.1,
  bald: 0,
};

export interface Character {
  root: THREE.Group;
  /** Re-skins the existing character. Safe to call when the player signs in or out. */
  applyStyle(style: CharacterStyle | null | undefined): void;
  /** Runs the walk cycle. `speed` scales how fast the legs and arms swing. */
  animate(time: number, opts?: { running?: boolean; speed?: number }): void;
  /** Frees every geometry and material this character owns. */
  dispose(): void;
}

function standard(color: string, roughness = 0.65, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function ball(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function cylinder(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** Darkens a `#rrggbb` colour, so hair and beards read as hair rather than as skin. */
export function shade(color: string, amount: number): string {
  const n = parseInt(color.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * amount);
  const g = Math.round(((n >> 8) & 255) * amount);
  const b = Math.round((n & 255) * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function createCharacter(initialStyle?: CharacterStyle | null): Character {
  // Materials are created once and re-coloured, so re-skinning never leaks a GPU program.
  const mats = {
    primary: standard(DEFAULT_STYLE.primaryColor, 0.6),
    secondary: standard(DEFAULT_STYLE.secondaryColor, 0.7),
    skin: standard(DEFAULT_STYLE.skinColor, 0.8),
    hair: standard(DEFAULT_STYLE.hairColor, 0.9),
    dark: standard('#1b1b22', 0.5),
    gold: standard('#ffcf4d', 0.3, 0.6),
  };

  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while running
  root.add(body);

  // Limbs pivot at the hip or shoulder so rotating the pivot swings the limb.
  const limb = (x: number, y: number, mat: THREE.Material, length: number, width: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(box(width, length, width, mat, 0, -length / 2, 0));
    body.add(pivot);
    return pivot;
  };

  const legL = limb(-0.18, 0.8, mats.secondary, 0.8, 0.28);
  const legR = limb(0.18, 0.8, mats.secondary, 0.8, 0.28);
  legL.add(box(0.3, 0.16, 0.44, mats.dark, 0, -0.86, -0.08)); // shoes
  legR.add(box(0.3, 0.16, 0.44, mats.dark, 0, -0.86, -0.08));

  const torso = box(0.75, 0.85, 0.45, mats.primary, 0, 1.225, 0);
  const skirt = box(0.84, 0.34, 0.54, mats.secondary, 0, 0.76, 0); // female body only
  body.add(torso, skirt);

  const armL = limb(-0.5, 1.6, mats.primary, 0.7, 0.22);
  const armR = limb(0.5, 1.6, mats.primary, 0.7, 0.22);
  armL.add(ball(0.13, mats.skin, 0, -0.76, 0, 12));
  armR.add(ball(0.13, mats.skin, 0, -0.76, 0, 12));

  const neck = cylinder(0.13, 0.14, 0.14, mats.skin, 0, 1.73, 0);
  const head = box(0.58, 0.6, 0.55, mats.skin, 0, 2.11, 0);
  body.add(neck, head);

  // Eyes sit on the -z face, which is the direction the runner faces.
  const eyeMat = mats.dark;
  const eyeL = box(0.09, 0.11, 0.04, eyeMat, -0.13, 2.16, -0.28);
  const eyeR = box(0.09, 0.11, 0.04, eyeMat, 0.13, 2.16, -0.28);
  body.add(eyeL, eyeR);

  /** Slots are emptied and refilled by applyStyle, so only one hair/hat/accessory shows. */
  const hairSlot = new THREE.Group();
  const hatSlot = new THREE.Group();
  const accSlot = new THREE.Group();
  body.add(hairSlot, hatSlot, accSlot);

  const owned: (THREE.BufferGeometry | THREE.Material)[] = [...Object.values(mats)];

  const clearSlot = (slot: THREE.Group) => {
    for (const child of [...slot.children]) {
      slot.remove(child);
      // Slot contents use the shared materials, so only geometries are owned here.
      if ((child as THREE.Mesh).geometry) owned.push((child as THREE.Mesh).geometry);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) owned.push(m.geometry);
      });
    }
  };

  const buildHair = (s: NormalizedStyle) => {
    switch (s.hair) {
      case 'bald':
        return;
      case 'afro':
        hairSlot.add(ball(0.42, mats.hair, 0, 2.32, 0, 18));
        return;
      case 'bun':
        hairSlot.add(box(0.6, 0.3, 0.57, mats.hair, 0, 2.36, 0));
        hairSlot.add(ball(0.17, mats.hair, 0, 2.52, 0.24, 12));
        return;
      case 'braids':
        hairSlot.add(box(0.62, 0.34, 0.59, mats.hair, 0, 2.36, 0));
        hairSlot.add(cylinder(0.09, 0.09, 0.62, mats.hair, -0.3, 2.05, 0.16));
        hairSlot.add(cylinder(0.09, 0.09, 0.62, mats.hair, 0.3, 2.05, 0.16));
        return;
      case 'dreads':
        hairSlot.add(box(0.62, 0.32, 0.59, mats.hair, 0, 2.36, 0));
        for (const x of [-0.26, -0.09, 0.09, 0.26]) {
          hairSlot.add(box(0.11, 0.78, 0.11, mats.hair, x, 2.02, 0.22));
        }
        return;
      case 'ponytail':
        hairSlot.add(box(0.62, 0.3, 0.59, mats.hair, 0, 2.36, 0));
        hairSlot.add(ball(0.19, mats.hair, 0, 2.2, 0.32, 12));
        return;
      case 'short':
      default:
        hairSlot.add(box(0.62, 0.26, 0.59, mats.hair, 0, 2.35, 0));
    }
  };

  const buildHat = (s: NormalizedStyle) => {
    const lift = HAT_LIFT[s.hair] ?? 0.1;
    const y = 2.42 + lift;
    switch (s.hat) {
      case 'cap':
        hatSlot.add(box(0.62, 0.2, 0.6, mats.primary, 0, y, 0));
        hatSlot.add(box(0.58, 0.08, 0.28, mats.primary, 0, y - 0.06, -0.4)); // peak
        return;
      case 'beanie':
        hatSlot.add(box(0.64, 0.3, 0.61, mats.secondary, 0, y, 0));
        hatSlot.add(box(0.66, 0.12, 0.63, mats.primary, 0, y - 0.16, 0)); // folded brim
        return;
      case 'tophat':
        hatSlot.add(cylinder(0.34, 0.34, 0.06, mats.dark, 0, y, 0));
        hatSlot.add(cylinder(0.24, 0.24, 0.56, mats.dark, 0, y + 0.3, 0));
        hatSlot.add(box(0.49, 0.09, 0.49, mats.gold, 0, y + 0.12, 0)); // band
        return;
      case 'crown':
        hatSlot.add(cylinder(0.28, 0.28, 0.22, mats.gold, 0, y + 0.08, 0));
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2;
          hatSlot.add(
            box(0.09, 0.16, 0.09, mats.gold, Math.cos(a) * 0.24, y + 0.26, Math.sin(a) * 0.24),
          );
        }
        return;
      case 'none':
      default:
        return;
    }
  };

  const buildAccessory = (s: NormalizedStyle) => {
    switch (s.accessory) {
      case 'glasses': {
        accSlot.add(box(0.52, 0.05, 0.05, mats.dark, 0, 2.16, -0.29));
        accSlot.add(box(0.16, 0.16, 0.04, mats.dark, -0.15, 2.16, -0.3));
        accSlot.add(box(0.16, 0.16, 0.04, mats.dark, 0.15, 2.16, -0.3));
        return;
      }
      case 'earrings':
        accSlot.add(ball(0.06, mats.gold, -0.3, 2.02, 0, 10));
        accSlot.add(ball(0.06, mats.gold, 0.3, 2.02, 0, 10));
        return;
      case 'beard':
        accSlot.add(box(0.5, 0.3, 0.5, mats.hair, 0, 1.94, -0.03));
        return;
      case 'scarf':
        accSlot.add(box(0.66, 0.16, 0.5, mats.secondary, 0, 1.68, 0));
        accSlot.add(box(0.18, 0.42, 0.1, mats.secondary, 0.22, 1.44, -0.24));
        return;
      case 'backpack':
        accSlot.add(box(0.5, 0.52, 0.22, mats.secondary, 0, 1.3, 0.33));
        accSlot.add(box(0.2, 0.08, 0.06, mats.dark, 0, 1.42, 0.46));
        return;
      case 'none':
      default:
        return;
    }
  };

  const applyStyle = (style: CharacterStyle | null | undefined) => {
    const s = normalizeStyle(style);

    mats.primary.color.set(s.primaryColor);
    mats.secondary.color.set(s.secondaryColor);
    mats.skin.color.set(s.skinColor);
    mats.hair.color.set(s.hairColor);

    // The skirt is the only silhouette cue for the body choice, so it is toggled.
    skirt.visible = s.body === 'female';
    // Shoulders are a little narrower on the female body.
    armL.position.x = s.body === 'female' ? -0.44 : -0.5;
    armR.position.x = s.body === 'female' ? 0.44 : 0.5;
    torso.scale.x = s.body === 'female' ? 0.92 : 1;

    clearSlot(hairSlot);
    clearSlot(hatSlot);
    clearSlot(accSlot);
    buildHair(s);
    buildHat(s);
    buildAccessory(s);
  };

  const animate = (time: number, opts?: { running?: boolean; speed?: number }) => {
    const running = opts?.running ?? true;
    const rate = (opts?.speed ?? 1) * 9;
    const swing = running ? Math.sin(time * rate) * 0.85 : 0;

    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;

    // A small vertical bob on the beat of the steps, plus a slight forward lean.
    body.position.y = running ? Math.abs(Math.cos(time * rate)) * 0.07 : 0;
    body.rotation.x = running ? -0.12 : 0;
  };

  applyStyle(initialStyle);

  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    for (const item of owned) item.dispose();
    owned.length = 0;
  };

  return { root, applyStyle, animate, dispose };
}
