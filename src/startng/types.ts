/**
 * The shapes start.ng sends this game.
 *
 * Everything here comes from docs/start-platform.md. start.ng is allowed to add options
 * later, so every field is treated as untrusted input and normalised before use.
 */

/** How a character is built. */
export type Body = 'female' | 'male';

export const BODIES: readonly Body[] = ['female', 'male'];

export const HAIRS: readonly string[] = [
  'short',
  'afro',
  'braids',
  'bun',
  'ponytail',
  'dreads',
  'bald',
];

export const HATS: readonly string[] = ['none', 'cap', 'beanie', 'tophat', 'crown'];

export const ACCESSORIES: readonly string[] = [
  'none',
  'glasses',
  'earrings',
  'beard',
  'scarf',
  'backpack',
];

/**
 * The player's start.ng character. Colours are `#rrggbb`.
 *
 * Fields are optional on purpose: a player who has not made a character yet has a
 * partial style, and start.ng may add a hair or accessory this build has never seen.
 */
export interface CharacterStyle {
  body?: string;
  primaryColor?: string;
  secondaryColor?: string;
  skinColor?: string;
  hairColor?: string;
  hair?: string;
  hat?: string;
  accessory?: string;
}

/** A style with every field guaranteed present and known-good. */
export type NormalizedStyle = Required<CharacterStyle> & {
  body: Body;
};

/** The signed-in player. */
export interface Player {
  id: number;
  /** The character's name. Show this in the game. */
  name: string;
  /** The account name, for a small `@name`. */
  account?: string;
  /** `null` when the player has not made a character. */
  style: CharacterStyle | null;
  /** PNG data URL of the character's face. */
  face?: string;
}

/** start.ng's one guest look, so guests look the same in every game. */
export interface Guest {
  name: string;
  style: CharacterStyle;
  face?: string;
}

/** Either a signed-in player or the guest. Never both null once resolved. */
export type Who = { kind: 'user'; player: Player } | { kind: 'guest'; guest: Guest };

export interface WhoamiReply {
  type: 'startng:user';
  user: Player | null;
  guest: Guest | null;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: number;
  name: string;
  color: string;
  score: number;
  /** Present when the game declares its own columns in startng.json. */
  stats?: Record<string, number>;
}

export interface LeaderboardReply {
  type: 'startng:leaderboardData';
  ok: boolean;
  entries?: LeaderboardEntry[];
  error?: string;
}

export interface SavedRun {
  /** The best value of the first stat. */
  best: number;
  /** Whether this run beat the player's previous best. */
  improved: boolean;
  rank?: number;
  stats?: Record<string, number>;
}

export interface ScoreSavedReply {
  type: 'startng:scoreSaved';
  ok: boolean;
  result?: SavedRun;
  error?: string;
}

/** The game's own columns, as declared in startng.json. */
export type GameStats = Record<string, number>;
