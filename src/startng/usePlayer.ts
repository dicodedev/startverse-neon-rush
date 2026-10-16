import { useCallback, useEffect, useState } from 'react';
import { getWho, onWhoChanged, signIn } from './connect';
import { isOnStartNg } from './env';
import { normalizeStyle } from '../character/style';
import type { CharacterStyle, Player } from './types';

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
  /** Still asking start.ng who is playing. */
  loading: boolean;
}

/**
 * Finds out who is playing and keeps that up to date.
 *
 * Docs: the player may sign in or out on start.ng while the game is open, so this
 * re-asks on `visibilitychange` and `focus`.
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
  });

  const apply = useCallback((who: Awaited<ReturnType<typeof getWho>>) => {
    // `undefined` means start.ng could not be reached, which is not the same as a guest.
    if (who === undefined) {
      setState((s) => ({ ...s, offline: true, loading: false }));
      return;
    }

    // A guest gets start.ng's shared look, so guests look the same in every game.
    const style = normalizeStyle(who.style);
    setState({
      user: 'id' in who ? (who as Player) : null,
      offline: false,
      isGuest: !('id' in who),
      style,
      name: who.name,
      account: 'account' in who && who.account ? who.account : null,
      face: who.face,
      loading: false,
    });
  }, []);

  useEffect(() => {
    if (!isOnStartNg) {
      setState((s) => ({ ...s, offline: true, loading: false }));
      return;
    }

    // start.ng's homepage offers guest play, and opens the game with `?guest`.
    const forcedGuest = new URLSearchParams(location.search).has('guest');
    void getWho().then((who) => {
      if (forcedGuest && who && 'id' in who) return; // stay a guest
      apply(who);
    });

    return onWhoChanged(apply);
  }, [apply]);

  return { ...state, signIn };
}
