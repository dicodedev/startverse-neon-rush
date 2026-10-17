import type { RunStats } from '../game/store';
import { formatTime } from './format';

/** Live run numbers, plus this browser's best. */
export function Hud({
  stats,
  best,
  checkpoint,
}: {
  stats: RunStats;
  best: number;
  /** Distance of the most recent checkpoint, flashed when it is reached. */
  checkpoint: number | null;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2 sm:top-4">
      <div className="panel flex items-center gap-4 px-4 py-1.5 text-sm sm:gap-7 sm:px-6 sm:py-2 sm:text-base">
        <Stat label="Metres" value={Math.round(stats.distance).toLocaleString()} accent />
        <Stat label="Shards" value={stats.shards} accent />
        <Stat label="Time" value={formatTime(stats.survived)} />
        <div className="hidden sm:block">
          <Stat label="Best" value={best.toLocaleString()} />
        </div>
      </div>

      {/* Checkpoint confirmation, shown for a moment when one is passed. */}
      {checkpoint !== null && (
        <p
          className="neon-text text-sm font-bold uppercase tracking-widest drop-shadow sm:text-base"
          role="status"
        >
          {checkpoint.toLocaleString()} m
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="text-center leading-tight">
      <p className={`tnum text-base font-bold sm:text-xl ${accent ? 'neon-text' : 'text-white'}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-white/50">{label}</p>
    </div>
  );
}
