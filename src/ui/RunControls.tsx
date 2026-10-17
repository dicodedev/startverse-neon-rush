import { isAudioSupported } from '../audio/sfx';
import { useGame } from '../game/store';

/**
 * Sound and pause controls, top-right.
 *
 * Both are small icon buttons so they never compete with the run. The sound toggle reads the
 * stored preference, so it is remembered between visits, and it explains itself when the
 * browser has no Web Audio at all rather than looking broken.
 */
export function RunControls({ onPause }: { onPause: () => void }) {
  const phase = useGame((s) => s.phase);
  const soundOn = useGame((s) => s.soundOn);
  const toggleSound = useGame((s) => s.toggleSound);
  const supported = isAudioSupported();

  const running = phase === 'running' || phase === 'paused';

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
        title={
          !supported
            ? 'This browser has no Web Audio support'
            : soundOn
              ? 'Sound on'
              : 'Sound off'
        }
        className="panel pointer-events-auto grid h-9 w-9 place-items-center text-sm transition-transform active:scale-95 sm:h-10 sm:w-10"
      >
        {supported ? (
          soundOn ? (
            <span aria-hidden>🔊</span>
          ) : (
            <span aria-hidden className="opacity-45">
              🔇
            </span>
          )
        ) : (
          <span aria-hidden className="text-[10px] text-white/40">
            n/a
          </span>
        )}
      </button>

      {running && (
        <button
          type="button"
          onClick={onPause}
          aria-label={phase === 'paused' ? 'Resume' : 'Pause'}
          title={phase === 'paused' ? 'Resume' : 'Pause'}
          className="panel pointer-events-auto grid h-9 w-9 place-items-center text-sm transition-transform active:scale-95 sm:h-10 sm:w-10"
        >
          <span aria-hidden>{phase === 'paused' ? '▶' : '❚❚'}</span>
        </button>
      )}
    </div>
  );
}