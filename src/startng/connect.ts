import { START_NG } from './env';
import type {
  GameStats,
  Guest,
  LeaderboardReply,
  Player,
  ScoreSavedReply,
  WhoamiReply,
} from './types';

/**
 * The game talks to start.ng through a hidden page at `start.ng/connect` using postMessage.
 * start.ng owns sign-in and scores; this game never sees a password, an email, or the
 * player's real sign-in. See docs/start-platform.md, "Talk to start.ng".
 *
 * Behaviour follows the documented reference implementation in start.ng's docs and in
 * Lane Dash (github.com/Blackburn0/HNG-Game), reimplemented here in TypeScript.
 */

/** How long to wait for start.ng to answer before giving up. */
const DEFAULT_TIMEOUT_MS = 5000;

/** Scores can take longer, because start.ng may be writing them. */
const SCORE_TIMEOUT_MS = 8000;

let frame: Promise<HTMLIFrameElement> | null = null;

/**
 * Creates the hidden connect frame once and reuses it.
 *
 * The frame is only created when the game is actually served from a start.ng address, so
 * an ordinary dev server never loads a cross-origin page for nothing.
 */
function connectFrame(): Promise<HTMLIFrameElement> {
  if (!START_NG) return Promise.reject(new Error('not served from start.ng'));
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.title = 'start.ng sign-in';
    el.addEventListener('load', () => resolve(el), { once: true });
    el.addEventListener('error', () => reject(new Error('connect frame failed')), { once: true });
    document.body.append(el);
  });
  return frame;
}

function newRequestId(): string {
  return Math.random().toString(36).slice(2);
}

/**
 * Sends one message to start.ng and resolves to its reply, or `null` if start.ng did not
 * answer in time or is not reachable.
 *
 * The reply is only trusted when all three of these hold:
 *   - `e.origin` is start.ng, so nobody else can answer;
 *   - `e.source` is our own frame, so another start.ng frame cannot answer for us;
 *   - `e.data.requestId` matches the request we sent, so a late reply to an earlier
 *     request cannot be mistaken for this one.
 *
 * The docs call out the origin check specifically: "Always check `e.origin` like this: it's
 * what makes the reply trustworthy."
 */
async function ask<T>(message: object, replyType: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!START_NG) return null;
  // Captured so the narrowed value survives into the closures below.
  const origin = START_NG;

  let el: HTMLIFrameElement;
  try {
    el = await connectFrame();
  } catch {
    return null;
  }

  return new Promise<T | null>((resolve) => {
    const requestId = newRequestId();

    const done = (reply: T | null) => {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      resolve(reply);
    };

    const timer = setTimeout(() => done(null), timeoutMs);

    function onMessage(e: MessageEvent) {
      if (e.origin !== origin) return;
      if (e.source !== el.contentWindow) return;
      const data = e.data as { type?: string; requestId?: string } | null;
      if (data?.type !== replyType || data.requestId !== requestId) return;
      done(data as T);
    }

    addEventListener('message', onMessage);
    el.contentWindow?.postMessage({ ...message, requestId }, origin);
  });
}

/** One sign-in check. Resolves to `null` when start.ng could not be reached. */
async function whoami(): Promise<WhoamiReply | null> {
  return ask<WhoamiReply>({ type: 'startng:whoami' }, 'startng:user');
}

/**
 * The signed-in player, or start.ng's guest.
 *
 * The docs say to fall back to the guest: "Guests: use `guest` (the default look, named
 * 'Guest'), and offer a sign-in button." `undefined` is returned only when start.ng did not
 * answer at all, which the caller should treat as "no player" rather than "guest".
 */
export async function getWho(): Promise<Player | Guest | undefined> {
  const reply = await whoami();
  if (!reply) return undefined;
  return reply.user ?? reply.guest ?? undefined;
}

/**
 * Watches for the player signing in or out on start.ng while this tab is in the background,
 * which happens when they follow the sign-in link and come back.
 *
 * The callback is only called on a real change. A check that failed to reach start.ng is
 * ignored rather than treated as a sign-out, so a network blip cannot sign the player out.
 */
export function onWhoChanged(fn: (who: Awaited<ReturnType<typeof getWho>>) => void): () => void {
  let last: unknown = undefined;
  let primed = false;

  const recheck = async () => {
    if (document.visibilityState !== 'visible') return;
    const who = await getWho();
    if (who === undefined) return;
    const key = who === null ? null : JSON.stringify(who);
    if (primed && key === last) return;
    primed = true;
    last = key;
    fn(who);
  };

  document.addEventListener('visibilitychange', recheck);
  addEventListener('focus', recheck);
  void recheck();

  return () => {
    document.removeEventListener('visibilitychange', recheck);
    removeEventListener('focus', recheck);
  };
}

/**
 * Sends the player to start.ng to sign in. start.ng brings them back here afterwards.
 *
 * start.ng asks new players to make a character on the way, which is what makes the
 * character rule possible.
 */
export function signIn(): void {
  if (!START_NG) return;
  location.href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
}

/**
 * Saves a run. Signed-in players only, and start.ng keeps each player's best.
 *
 * `stats` must be exactly the columns declared in startng.json, each a whole number from 0
 * to 1,000,000,000. Resolves to `null` when the run could not be saved.
 */
export async function submitStats(stats: GameStats): Promise<ScoreSavedReply['result'] | null> {
  const reply = await ask<ScoreSavedReply>(
    { type: 'startng:score', stats },
    'startng:scoreSaved',
    SCORE_TIMEOUT_MS,
  );
  return reply?.ok ? (reply.result ?? null) : null;
}

/** The shared top scores. Works for everyone, guests included. */
export async function getLeaderboard(limit = 10) {
  const reply = await ask<LeaderboardReply>(
    { type: 'startng:leaderboard', limit },
    'startng:leaderboardData',
    SCORE_TIMEOUT_MS,
  );
  return reply?.ok ? (reply.entries ?? []) : null;
}
