import type { LeaderboardEntry } from '../startng/types';
import { formatTime } from './format';

/**
 * The shared board.
 *
 * Docs: "Highlight the player's own row by comparing `player_id` with their `id`", and
 * "Guests can see the leaderboard but can't save. Invite them to sign in."
 *
 * Columns match startng.json: Metres run, Shards, Survived.
 */
export function Leaderboard({
  entries,
  myId,
  isGuest,
  offline,
}: {
  entries: LeaderboardEntry[];
  myId: number | null;
  isGuest: boolean;
  offline: boolean;
}) {
  return (
    <div className="panel w-full max-w-sm p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/70">Leaderboard</h2>
        {offline && (
          <span className="text-[10px] uppercase tracking-wide text-white/40">This browser</span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-white/50">No runs saved yet. Be the first.</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {entries.map((e) => {
            const mine = myId !== null && e.player_id === myId;
            return (
              <li
                key={`${e.rank}-${e.player_id}`}
                className={`tnum flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${
                  mine ? 'bg-[#39ff88]/15 ring-1 ring-[#39ff88]/50' : ''
                }`}
              >
                <span className="w-5 shrink-0 text-right text-white/40">{e.rank}</span>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: e.color || '#39ff88' }}
                  aria-hidden
                />
                <span className={`min-w-0 flex-1 truncate ${mine ? 'font-bold' : ''}`}>
                  {e.name}
                </span>
                <span className="shrink-0 text-white/70">{e.stats?.distance ?? e.score}</span>
                <span className="w-10 shrink-0 text-right text-[#39ff88]">
                  {e.stats?.shards ?? 0}
                </span>
                <span className="w-10 shrink-0 text-right text-white/50">
                  {formatTime(e.stats?.survived ?? 0)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {isGuest && (
        <p className="mt-2 text-center text-xs text-white/45">
          Sign in with start.ng to save your runs
        </p>
      )}
    </div>
  );
}
