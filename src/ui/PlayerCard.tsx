import type { ResolvedPlayer } from '../startng/usePlayer';

/**
 * The player's start.ng identity, shown top-left.
 *
 * The game has a character, so the avatar in the scene is the main representation. This
 * card names who is playing and is the place a guest can sign in, which the docs ask for.
 */
export function PlayerCard({ who, onSignIn }: { who: ResolvedPlayer; onSignIn: () => void }) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 sm:left-4 sm:top-4">
      <div className="panel flex items-center gap-2 px-2 py-1.5 pr-3">
        {who.face ? (
          <img
            src={who.face}
            alt=""
            className="h-9 w-9 rounded-full border-2 border-[#39ff88] bg-[#0d3b22] object-cover sm:h-11 sm:w-11"
          />
        ) : (
          <div
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#39ff88] bg-[#0d3b22] text-sm font-bold text-[#39ff88] sm:h-11 sm:w-11"
            aria-hidden
          >
            {(who.name || 'G').charAt(0).toUpperCase()}
          </div>
        )}

        <div className="leading-tight">
          <p className="max-w-[9rem] truncate text-sm font-bold sm:max-w-[12rem] sm:text-base">
            {who.name}
          </p>
          {who.account && <p className="text-[11px] text-white/60 sm:text-xs">@{who.account}</p>}
        </div>
      </div>

      {who.isGuest && (
        <button
          type="button"
          onClick={onSignIn}
          disabled={who.offline}
          className="btn-primary pointer-events-auto text-xs sm:text-sm"
          title={
            who.offline
              ? 'Sign-in works once the game is live on start.ng'
              : 'Sign in with start.ng'
          }
        >
          Sign in
        </button>
      )}
    </div>
  );
}
