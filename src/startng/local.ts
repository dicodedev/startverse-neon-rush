/**
 * A stand-in for start.ng when the game is not served from a start.ng address.
 *
 * Docs: "Testing: sign-in, scores and multiplayer only work once your game is live at
 * `your-game.start.ng`. Opened as a local file there's no player, so make sure your game
 * still plays without one."
 *
 * The docs also note that `localStorage` "only lives in one browser, so other players never
 * see what's in it" — so this is for development and guests, never for real scores.
 */

const BEST_KEY = 'neonrush:best';
const BOARD_KEY = 'neonrush:board';
const BOARD_LIMIT = 10;

export interface LocalEntry {
  rank: number;
  player_id: number;
  name: string;
  color: string;
  score: number;
  stats?: Record<string, number>;
}

function readBoard(): LocalEntry[] {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalEntry[]) : [];
  } catch {
    return [];
  }
}

function writeBoard(entries: LocalEntry[]): void {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(entries));
  } catch {
    // Private browsing, or storage is full. Scores just do not persist.
  }
}

export function localBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Records a run in this browser's own board, ranked by score.
 *
 * Returns the same shape as start.ng's reply so the UI needs no special case.
 */
export function submitLocalScore(score: number, stats?: Record<string, number>) {
  const entries = readBoard();
  const improved = score > localBest();
  if (improved) {
    try {
      localStorage.setItem(BEST_KEY, String(score));
    } catch {
      // Ignore: not being able to persist is not worth interrupting a run for.
    }
  }

  // One row per player id. Guest rows collapse to a single shared slot.
  const playerId = 0;
  const existing = entries.findIndex((e) => e.player_id === playerId);
  const row: LocalEntry = {
    rank: 0,
    player_id: playerId,
    name: 'You (this browser)',
    color: '#39ff88',
    score: Math.max(score, existing >= 0 ? entries[existing].score : 0),
    stats,
  };

  if (existing >= 0) entries[existing] = row;
  else entries.push(row);

  entries.sort((a, b) => b.score - a.score);
  const top = entries.slice(0, BOARD_LIMIT).map((e, i) => ({ ...e, rank: i + 1 }));
  writeBoard(top);

  return {
    best: top[0]?.score ?? score,
    improved,
    rank: top.findIndex((e) => e.player_id === playerId) + 1,
    stats,
  };
}

export function localLeaderboard(limit = BOARD_LIMIT): LocalEntry[] {
  return readBoard().slice(0, Math.max(1, Math.min(limit, BOARD_LIMIT)));
}
