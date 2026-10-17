import { create } from 'zustand';
import { localBest } from '../startng';
import type { LeaderboardEntry } from '../startng/types';
import { isSoundEnabled, toggleSound } from '../audio/sfx';

export type Phase = 'menu' | 'running' | 'paused' | 'over' | 'won';

export interface RunStats {
  distance: number;
  shards: number;
  /** Seconds survived, sent as the `survived` stat. */
  survived: number;
}

interface GameState {
  phase: Phase;
  /** Live run values, updated a few times a second for the HUD. */
  stats: RunStats;
  /** The last finished run, held while the game-over card is up. */
  lastRun: RunStats | null;
  /** This browser's best, or start.ng's best once a run is saved. */
  best: number;
  /** Set when start.ng has just been beaten, so the HUD can say so. */
  newBest: boolean;
  /** The player's rank from the last saved run. */
  rank: number | null;
  leaderboard: LeaderboardEntry[];
  /** True when start.ng could not be reached and the local board is being used. */
  offline: boolean;
  /** A message from start.ng, e.g. "Sign in to save your score". */
  notice: string | null;
  /** Sound effects on or off, remembered between visits. */
  soundOn: boolean;
  /** The distance of the last checkpoint passed, for the HUD flash. */
  checkpoint: number | null;

  start(): void;
  pause(): void;
  resume(): void;
  end(stats: RunStats): void;
  win(stats: RunStats): void;
  setStats(stats: RunStats): void;
  setBest(best: number): void;
  setNewBest(newBest: boolean): void;
  setRank(rank: number | null): void;
  setLeaderboard(entries: LeaderboardEntry[]): void;
  setOffline(offline: boolean): void;
  setNotice(notice: string | null): void;
  setCheckpoint(distance: number | null): void;
  toggleSound(): void;
  reset(): void;
}

const empty: RunStats = { distance: 0, shards: 0, survived: 0 };

export const useGame = create<GameState>((set) => ({
  phase: 'menu',
  stats: empty,
  lastRun: null,
  best: localBest(),
  newBest: false,
  rank: null,
  leaderboard: [],
  offline: false,
  notice: null,
  soundOn: isSoundEnabled(),
  checkpoint: null,

  start: () =>
    set({
      phase: 'running',
      stats: empty,
      lastRun: null,
      newBest: false,
      rank: null,
      checkpoint: null,
    }),
  pause: () => set((s) => (s.phase === 'running' ? { phase: 'paused' } : s)),
  resume: () => set((s) => (s.phase === 'paused' ? { phase: 'running' } : s)),
  end: (stats) => set({ phase: 'over', lastRun: stats }),
  win: (stats) => set({ phase: 'won', lastRun: stats }),
  setStats: (stats) => set({ stats }),
  setBest: (best) => set({ best }),
  setNewBest: (newBest) => set({ newBest }),
  setRank: (rank) => set({ rank }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setOffline: (offline) => set({ offline }),
  setNotice: (notice) => set({ notice }),
  setCheckpoint: (checkpoint) => set({ checkpoint }),
  toggleSound: () => set({ soundOn: toggleSound() }),
  reset: () =>
    set({
      phase: 'menu',
      stats: empty,
      lastRun: null,
      newBest: false,
      rank: null,
      checkpoint: null,
    }),
}));
