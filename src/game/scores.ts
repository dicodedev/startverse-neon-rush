import { getLeaderboard, submitStats } from '../startng/connect';
import { isOnStartNg } from '../startng/env';
import { localLeaderboard, submitLocalScore } from '../startng/local';
import type { LeaderboardEntry } from '../startng/types';
import { scoreOf } from './world';
import type { RunStats } from './store';

/**
 * Saves a finished run and reads the board.
 *
 * The columns sent here must match startng.json exactly, each a whole number from 0 to
 * 1,000,000,000, or start.ng refuses the run with a 422. See docs/start-platform.md,
 * "Save a run".
 */

/** The columns declared in startng.json, in ranking order. */
export function statsFromRun(run: RunStats): Record<string, number> {
  return {
    distance: Math.max(0, Math.round(run.distance)),
    shards: Math.max(0, Math.round(run.shards)),
    survived: Math.max(0, Math.round(run.survived)),
  };
}

export interface SaveResult {
  best: number;
  improved: boolean;
  rank: number | null;
  /** True when start.ng could not be reached and only the local board was updated. */
  offline: boolean;
  /** Why the run was not saved, e.g. "Sign in to save your score". */
  error?: string;
}

/**
 * Saves a run.
 *
 * Signed-in players are saved on start.ng and keep their best there. Guests cannot save,
 * so the result comes back as an error and the UI invites them to sign in. Away from
 * start.ng the run goes into this browser's own board instead.
 */
export async function saveRun(run: RunStats): Promise<SaveResult> {
  const stats = statsFromRun(run);
  const local = scoreOf(run.distance, run.shards);

  if (!isOnStartNg) {
    const r = submitLocalScore(local, stats);
    return { best: r.best, improved: r.improved, rank: r.rank, offline: true };
  }

  const result = await submitStats(stats);
  if (result) {
    return {
      best: result.best,
      improved: result.improved,
      rank: result.rank ?? null,
      offline: false,
    };
  }

  // start.ng refuses runs from guests and answers with a reason worth showing.
  const guest = submitLocalScore(local, stats);
  return {
    best: guest.best,
    improved: guest.improved,
    rank: guest.rank,
    offline: false,
    error: 'Sign in with start.ng to save your run',
  };
}

export interface BoardResult {
  entries: LeaderboardEntry[];
  offline: boolean;
}

/** The shared top scores, or this browser's own board when start.ng is not reachable. */
export async function loadBoard(limit = 10): Promise<BoardResult> {
  if (!isOnStartNg) {
    return { entries: localLeaderboard(limit), offline: true };
  }
  const entries = await getLeaderboard(limit);
  if (!entries) {
    return { entries: localLeaderboard(limit), offline: true };
  }
  return { entries, offline: false };
}
