import {
  ACCESSORIES,
  BODIES,
  HAIRS,
  HATS,
  type CharacterStyle,
  type NormalizedStyle,
} from '../startng/types';

/**
 * start.ng's default look, used for anything missing or unknown.
 *
 * The docs are explicit that unknown values must fall back rather than break the game:
 * "start.ng may add more options later". So every field is validated and replaced, never
 * trusted.
 */
export const DEFAULT_STYLE: NormalizedStyle = {
  body: 'female',
  primaryColor: '#a55eea',
  secondaryColor: '#0c6e5a',
  skinColor: '#8d5524',
  hairColor: '#17120f',
  hair: 'short',
  hat: 'none',
  accessory: 'none',
};

/** Picks the first known option, so a value start.ng adds later degrades to a default. */
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Accepts only a full `#rrggbb`. Three.js reads anything else as black or throws. */
export function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

/**
 * Turns whatever start.ng sent into a style the renderer can rely on.
 *
 * A `null` style (a player who has not made a character) becomes the default look.
 */
export function normalizeStyle(style: CharacterStyle | null | undefined): NormalizedStyle {
  const s = style ?? {};
  return {
    body: pick(s.body, BODIES, DEFAULT_STYLE.body),
    primaryColor: normalizeColor(s.primaryColor, DEFAULT_STYLE.primaryColor),
    secondaryColor: normalizeColor(s.secondaryColor, DEFAULT_STYLE.secondaryColor),
    skinColor: normalizeColor(s.skinColor, DEFAULT_STYLE.skinColor),
    hairColor: normalizeColor(s.hairColor, DEFAULT_STYLE.hairColor),
    hair: pick(s.hair, HAIRS, DEFAULT_STYLE.hair),
    hat: pick(s.hat, HATS, DEFAULT_STYLE.hat),
    accessory: pick(s.accessory, ACCESSORIES, DEFAULT_STYLE.accessory),
  };
}

/** The style falls back per-field, so a partly filled style still looks like the player. */
export function hasAnyStyle(style: CharacterStyle | null | undefined): boolean {
  return !!style && Object.keys(style).length > 0;
}
