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
          <p className="flex items-center gap-1 text-sm font-bold sm:text-base">
            <span className="max-w-[9rem] truncate sm:max-w-[12rem]">{who.name}</span>
            {/* Signed-in players get a tick instead of the Sign in button. */}
            {!who.loading && !who.isGuest && (
              <span
                className="text-[#39ff88]"
                title="Signed in with start.ng"
                aria-label="Signed in"
              >
                ✓
              </span>
            )}
          </p>
          {who.account && <p className="text-[11px] text-white/60 sm:text-xs">@{who.account}</p>}
        </div>
      </div>

      {who.signInIssue && (
        <p className="panel max-w-[10rem] px-2 py-1 text-[11px] text-amber-200/90" role="status">
          {who.signInIssue}
        </p>
      )}

      {/* Only offer Sign in once start.ng has actually answered. While a check is in flight
          the player may already be signed in, so showing the button there made a signed-in
          player look signed out. */}
      {!who.loading && who.isGuest && (
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

      {who.loading && (
        <span
          className="panel pointer-events-none px-3 py-1.5 text-xs text-white/60 sm:text-sm"
          aria-live="polite"
        >
          Checking…
        </span>
      )}
    </div>
  );
}
