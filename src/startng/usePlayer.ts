import { useCallback, useEffect, useRef, useState } from 'react';
import { clearSignInReturn, getIdentity, hasSignInReturn, onWhoChanged, signIn } from './connect';
import { isOnStartNg } from './env';
import { normalizeStyle } from '../character/style';
import type { CharacterStyle, Guest, Player } from './types';

export interface ResolvedPlayer {
  /** The signed-in player, or `null` for a guest. */
  user: Player | null;
  /** True when start.ng has not answered at all, so the game is running guest-only. */
  offline: boolean;
  /** True when start.ng said the player is a guest, or `?guest` is in the address. */
  isGuest: boolean;
  /** The character style to draw, already normalised. */
  style: CharacterStyle | null;
  /** The character's name, to show in the game. */
  name: string;
  /** The account name, for the small `@name`. */
  account: string | null;
  /** The face picture, when start.ng sent one. */
  face: string | undefined;
  /** Still asking start.ng who is playing, so no verdict should be shown yet. */
  loading: boolean;
  /** Set when the player came back from sign-in but is still not signed in. */
  signInIssue: string | null;
}

/**
 * Finds out who is playing and keeps that up to date.
 *
 * start.ng owns sign-in. The game never decides for itself who the player is: every value
 * here comes from start.ng's answer to `startng:whoami`. The address is only ever used as a
 * hint that the player has just come back from the sign-in redirect, which makes the game
 * ask again.
 *
 * Docs, "Who's playing": "Ask again when the player comes back to your tab
 * (`visibilitychange` and `focus`): they may have signed in or out on start.ng."
 */
export function usePlayer(): ResolvedPlayer & { signIn: () => void } {
  const [state, setState] = useState<Omit<ResolvedPlayer, 'signIn'>>({
    user: null,
    offline: !isOnStartNg,
    isGuest: true,
    style: null,
    name: 'Guest',
    account: null,
    face: undefined,
    loading: isOnStartNg,
    signInIssue: null,
  });

  // Whether this visit was opened as a guest. Read once: start.ng drops it when it sends a
  // player back from sign-in, so it only ever applies to the visit that carried it.
  const forcedGuest = useRef(
    typeof location === 'undefined' ? false : new URLSearchParams(location.search).has('guest'),
  );

  /**
   * Folds one start.ng answer into the UI state.
   *
   * Only start.ng decides who the player is. `identity.user` is the signed-in player and
   * `identity.guest` is start.ng's shared guest look; if the visit was opened with `?guest`
   * the caller passes the guest in place of the user.
   */
  const apply = useCallback(
    (identity: { user: Player | null; guest: Guest | null }, justReturned: boolean) => {
      // Guard against a reply with no usable id, so a malformed answer cannot sign anyone in.
      const user = identity.user && identity.user.id != null ? identity.user : null;
      const isUser = user !== null;
      const who = isUser ? user : identity.guest;

      setState({
        user,
        offline: false,
        isGuest: !isUser,
        // A guest the platform did not describe falls back to the default look rather than
        // leaving the character blank.
        style: normalizeStyle(who ? who.style : null),
        name: who ? who.name : 'Guest',
        account: user?.account ?? null,
        face: who?.face,
        loading: false,
        // Coming back from sign-in without a user means the sign-in did not complete, so say
        // so rather than leaving the button looking broken.
        signInIssue: justReturned && !isUser ? 'Still not signed in. Try again.' : null,
      });
    },
    [],
  );

  useEffect(() => {
    if (!isOnStartNg) {
      setState((s) => ({ ...s, offline: true, loading: false }));
      return;
    }

    // The documented return marker. Used only to know that the player has just come back, so
    // the game asks start.ng again; the session itself is never read or trusted here.
    const justReturned = hasSignInReturn();
    if (justReturned) clearSignInReturn();

    // Marks the effect as finished so a check still in flight cannot write to a dead hook.
    const check = async (opts?: { force?: boolean }) => {
      const force = opts?.force ?? false;
      // A passive re-ask (focus, visibility) is pointless while the tab is hidden, but a
      // forced one, such as returning from sign-in, must still run.
      if (!force && document.visibilityState !== 'visible') return;

      // Only show "checking" when there is nothing settled to show, or when a sign-in
      // return means the answer may genuinely have changed.
      setState((s) => (force || s.user === null ? { ...s, loading: true } : s));

      const identity = await getIdentity();

      if (!identity) {
        // start.ng did not answer. Leave whatever we knew alone and mark it offline, rather
        // than reporting the player as signed out.
        setState((s) => ({ ...s, offline: true, loading: false }));
        return;
      }

      // A guest who is also signed in stays the guest for this visit, and keeps the guest look,
      // which is what the docs ask for: "If they pick guest, your game opens with ?guest in
      // its address: skip your own sign-in question then."
      apply(
        forcedGuest.current
          ? { user: null, guest: identity.guest }
          : { user: identity.user ?? null, guest: identity.guest ?? null },
        justReturned,
      );
    };

    // The single initial check.
    void check({ force: true });

    // Later changes: focus, visibility and back/forward cache restores. These go through
    // onWhoChanged, which already only fires when something actually differs.
    return onWhoChanged((who) => {
      if (forcedGuest.current) return;
      apply('id' in who ? { user: who, guest: null } : { user: null, guest: who }, false);
    });
  }, [apply]);

  return { ...state, signIn };
}
