import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE, hasAnyStyle, normalizeColor, normalizeStyle } from './style';
import { ACCESSORIES, BODIES, HAIRS, HATS, type CharacterStyle } from '../startng/types';

/**
 * The docs are explicit that unknown values must degrade rather than break the game:
 * "Fall back to something sensible for any missing or unknown value: start.ng may add more
 * options later."
 */

describe('normalizeStyle', () => {
  it('fills in every field of an empty style', () => {
    expect(normalizeStyle(null)).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle(undefined)).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle({})).toEqual(DEFAULT_STYLE);
  });

  it('keeps values start.ng actually sent', () => {
    const style = {
      body: 'male',
      primaryColor: '#4b7bec',
      secondaryColor: '#2b2f4a',
      skinColor: '#8d5524',
      hairColor: '#17120f',
      hair: 'dreads',
      hat: 'beanie',
      accessory: 'backpack',
    };
    expect(normalizeStyle(style)).toEqual(style);
  });

  it('accepts every documented option', () => {
    for (const body of BODIES) {
      expect(normalizeStyle({ body }).body).toBe(body);
    }
    for (const hair of HAIRS) {
      expect(normalizeStyle({ hair }).hair).toBe(hair);
    }
    for (const hat of HATS) {
      expect(normalizeStyle({ hat }).hat).toBe(hat);
    }
    for (const accessory of ACCESSORIES) {
      expect(normalizeStyle({ accessory }).accessory).toBe(accessory);
    }
  });

  it('falls back on an option this build has never seen', () => {
    // A hair style or hat added to start.ng after this build shipped.
    expect(normalizeStyle({ hair: 'mohawk' }).hair).toBe(DEFAULT_STYLE.hair);
    expect(normalizeStyle({ hat: 'beanie ' }).hat).toBe(DEFAULT_STYLE.hat);
    // start.ng sends JSON, so a field can arrive as any type at all. The renderer must
    // survive it, hence the casts.
    expect(normalizeStyle({ accessory: null } as unknown as CharacterStyle).accessory).toBe(
      DEFAULT_STYLE.accessory,
    );
    expect(normalizeStyle({ body: 'other' }).body).toBe(DEFAULT_STYLE.body);
  });

  it('falls back on a malformed colour', () => {
    expect(normalizeStyle({ skinColor: 'red' }).skinColor).toBe(DEFAULT_STYLE.skinColor);
    expect(normalizeStyle({ skinColor: '#fff' }).skinColor).toBe(DEFAULT_STYLE.skinColor);
    expect(normalizeStyle({ primaryColor: 'rgb(1,2,3)' }).primaryColor).toBe(
      DEFAULT_STYLE.primaryColor,
    );
  });

  it('falls back per field, so a partly filled style still looks like the player', () => {
    const result = normalizeStyle({ primaryColor: '#39ff88', hair: 'bun' });
    expect(result.primaryColor).toBe('#39ff88');
    expect(result.hair).toBe('bun');
    // Everything else still arrives with a sensible look.
    expect(result.skinColor).toBe(DEFAULT_STYLE.skinColor);
    expect(result.body).toBe(DEFAULT_STYLE.body);
  });

  it('always returns a complete style', () => {
    const result = normalizeStyle({
      hair: 'nonsense',
      skinColor: 12345,
    } as unknown as CharacterStyle);
    for (const value of Object.values(result)) {
      expect(typeof value).toBe('string');
      expect(value).not.toBe('');
    }
  });
});

describe('normalizeColor', () => {
  it('takes a full six digit hex', () => {
    expect(normalizeColor('#39FF88', '#000000')).toBe('#39FF88');
  });

  it('rejects everything else', () => {
    expect(normalizeColor('#fff', '#000000')).toBe('#000000');
    expect(normalizeColor('#gggggg', '#000000')).toBe('#000000');
    expect(normalizeColor('rgb(0,0,0)', '#000000')).toBe('#000000');
    expect(normalizeColor(undefined, '#000000')).toBe('#000000');
  });
});

describe('hasAnyStyle', () => {
  it('is false for a player who has not made a character', () => {
    expect(hasAnyStyle(null)).toBe(false);
    expect(hasAnyStyle(undefined)).toBe(false);
    expect(hasAnyStyle({})).toBe(false);
  });

  it('is true once there is something to draw', () => {
    expect(hasAnyStyle({ body: 'male' })).toBe(true);
  });
});
