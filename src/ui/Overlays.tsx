import type { ResolvedPlayer } from '../startng/usePlayer';
import type { RunStats } from '../game/store';
import { formatTime } from './format';

/** The start screen. */
export function Menu({
  who,
  best,
  onStart,
  onSignIn,
}: {
  who: ResolvedPlayer;
  best: number;
  onStart: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-gradient-to-b from-black/80 via-black/70 to-black/85 p-4">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <div>
          <h1 className="neon-text text-5xl font-black tracking-tight sm:text-6xl">NEON RUSH</h1>
          <p className="mt-1 text-sm text-white/60">
            Run the grid. Collect the shards. Top the board.
          </p>
        </div>

        <button type="button" onClick={onStart} className="btn-primary px-10 py-3 text-lg">
          Tap to run
        </button>

        <div className="panel px-4 py-2 text-xs text-white/60">
          <p>
            Playing as <span className="font-bold text-white">{who.name}</span>
            {who.isGuest && !who.loading && ' (guest)'}
          </p>
          {best > 0 && <p className="tnum mt-1">Best: {best.toLocaleString()}</p>}
        </div>

        {/* Not offered while start.ng has not answered yet, so a signed-in player returning
            from the sign-in flow is never shown as a guest. */}
        {!who.loading && who.isGuest && (
          <button
            type="button"
            onClick={onSignIn}
            disabled={who.offline}
            className="btn-ghost text-xs"
          >
            {who.offline ? 'Sign-in needs start.ng' : 'Sign in with start.ng'}
          </button>
        )}

        {who.signInIssue && (
          <p className="text-xs text-amber-200/90" role="status">
            {who.signInIssue}
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-white/35">
          <Kbd>←</Kbd> <Kbd>→</Kbd> to change lane · <Kbd>Space</Kbd> to jump
          <br />
          On a phone, swipe left, right and up.
        </p>
      </div>
    </div>
  );
}

/** Shown when a run ends, after the run has been saved. */
export function GameOver({
  run,
  best,
  newBest,
  rank,
  notice,
  onRestart,
  onSignIn,
  who,
}: {
  run: RunStats;
  best: number;
  newBest: boolean;
  rank: number | null;
  notice: string | null;
  onRestart: () => void;
  onSignIn: () => void;
  who: ResolvedPlayer;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="panel flex w-full max-w-xs flex-col items-center gap-4 p-6 text-center">
        <h2 className="text-2xl font-black uppercase tracking-widest text-white/80">
          {newBest ? <span className="neon-text">New best!</span> : 'Run over'}
        </h2>

        <dl className="grid w-full grid-cols-3 gap-2">
          <Result label="Metres" value={Math.round(run.distance).toLocaleString()} accent />
          <Result label="Shards" value={run.shards} accent />
          <Result label="Time" value={formatTime(run.survived)} />
        </dl>

        <p className="tnum text-xs text-white/45">Best: {best.toLocaleString()}</p>

        {rank !== null && (
          <p className="tnum text-sm font-bold text-[#39ff88]">#{rank} on start.ng</p>
        )}

        {notice && <p className="text-xs text-white/55">{notice}</p>}

        {!who.loading && who.isGuest && (
          <button type="button" onClick={onSignIn} className="btn-ghost text-xs">
            Sign in to save your runs
          </button>
        )}

        <button type="button" onClick={onRestart} className="btn-primary w-full py-3">
          Run again
        </button>
      </div>
    </div>
  );
}

function Result({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="panel py-2">
      <dd className={`tnum text-lg font-bold ${accent ? 'neon-text' : 'text-white'}`}>{value}</dd>
      <dt className="text-[10px] uppercase tracking-widest text-white/45">{label}</dt>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-white/20 bg-white/10 px-1 py-0.5 text-[10px] text-white/70">
      {children}
    </kbd>
  );
}

/** Shown while the run is paused, without losing the scene behind it. */
export function Paused({
  onResume,
  onRestart,
  soundOn,
  onToggleSound,
}: {
  onResume: () => void;
  onRestart: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4 backdrop-blur-[2px]">
      <div className="panel flex w-full max-w-xs flex-col items-center gap-4 p-6 text-center">
        <h2 className="text-2xl font-black uppercase tracking-widest text-white/80">Paused</h2>

        <button type="button" onClick={onResume} className="btn-primary w-full py-3">
          Resume
        </button>
        <button type="button" onClick={onRestart} className="btn-ghost text-xs">
          Restart run
        </button>
        <button type="button" onClick={onToggleSound} className="btn-ghost text-xs">
          Sound: {soundOn ? 'on' : 'off'}
        </button>
        <p className="text-[11px] text-white/35">Press P or Esc to resume</p>
      </div>
    </div>
  );
}

/** Shown when the finish line is reached. */
export function Victory({
  run,
  best,
  newBest,
  onRestart,
  who,
}: {
  run: RunStats;
  best: number;
  newBest: boolean;
  onRestart: () => void;
  who: ResolvedPlayer & { signIn: () => void };
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="panel flex w-full max-w-xs flex-col items-center gap-4 p-6 text-center">
        <h2 className="neon-text-pink text-3xl font-black uppercase tracking-widest">
          Finished!
        </h2>
        <p className="text-xs text-white/60">You cleared the whole grid.</p>

        <dl className="grid w-full grid-cols-3 gap-2">
          <Result label="Metres" value={Math.round(run.distance).toLocaleString()} accent />
          <Result label="Shards" value={run.shards} accent />
          <Result label="Time" value={formatTime(run.survived)} />
        </dl>

        <p className="tnum text-xs text-white/45">
          Best: {best.toLocaleString()}
          {newBest && <span className="neon-text"> · new best</span>}
        </p>

        {!who.loading && who.isGuest && (
          <button type="button" onClick={who.signIn} className="btn-ghost text-xs">
            Sign in to save your runs
          </button>
        )}

        <button type="button" onClick={onRestart} className="btn-primary w-full py-3">
          Run again
        </button>
      </div>
    </div>
  );
}
