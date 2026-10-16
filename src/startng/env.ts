/**
 * Where start.ng is, worked out from where this game is served.
 *
 * The connect page "only answers games served from a `*.start.ng` address". Anywhere else
 * (a plain localhost dev server, GitHub Pages, opening the built folder from disk) there is
 * no start.ng to talk to, so the game runs guest-only rather than breaking.
 */
export function detectStartNg(hostname: string): string | null {
  if (hostname.endsWith('.start.ng')) return 'https://start.ng';
  // Local testing: start.ng itself runs on start.localhost, the game on <name>.start.localhost.
  if (hostname.endsWith('.start.localhost')) return 'http://start.localhost:5173';
  return null;
}

/** start.ng's address, or `null` when the game is not served in a way start.ng can reach. */
export const START_NG: string | null = detectStartNg(location.hostname);

/** True when sign-in, scores and the shared leaderboard are available. */
export const isOnStartNg: boolean = START_NG !== null;

/**
 * The game's name, taken from its address: `neon-rush` on `neon-rush.start.ng`.
 * Used only for display, since the connect page already knows which game is asking.
 */
export const GAME_NAME: string = location.hostname.split('.')[0] || 'neon-rush';
