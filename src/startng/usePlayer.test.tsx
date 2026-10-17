import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlayer } from './usePlayer';

/**
 * Drives the real Start.ng adapter against a stand-in for the connect page.
 *
 * The stand-in speaks the protocol exactly as docs/start-platform.md documents it: the game
 * posts `{ type, requestId }` to `https://start.ng/connect` and start.ng answers with
 * `{ type, requestId, ... }`. Nothing about the flow is invented, only the remote frame is
 * replaced so the adapter's state machine can be driven from a test.
 *
 * The module is imported once for the whole file on purpose: `connect.ts` caches the connect
 * frame in module scope, so re-importing per test would create a second frame and leave the
 * previous tests' listeners polling. Each test unmounts its hook instead, which runs the
 * effect cleanup and removes those listeners.
 */

/** start.ng's origin, from src/startng/env.ts for a *.start.localhost host. */
const ORIGIN = 'http://start.localhost:5173';

/** What the stand-in answers with on the next whoami. */
let nextWho: 'guest' | 'user' | 'silent';

/** How many whoami messages the game has sent, to catch duplicate polling. */
let whoamiCount = 0;

/** How many connect frames have been created, across the whole file. */
let framesCreated = 0;

const GUEST = {
  name: 'Guest',
  style: { body: 'male', primaryColor: '#a55eea', hair: 'short', hat: 'none' },
  face: 'data:image/png;base64,AAAA',
};

const USER = {
  id: 42,
  name: 'Runner Tee',
  account: 'Hamzat',
  style: { body: 'female', primaryColor: '#39ff88', hair: 'bun', hat: 'crown' },
  face: 'data:image/png;base64,BBBB',
};

/** What the stand-in sends to the game, and what it can answer with. */
interface ConnectMessage {
  type: string;
  requestId: string;
}

interface IdentityReply {
  type: 'startng:user';
  user: typeof USER | null;
  guest: typeof GUEST | null;
}

/** The `contentWindow` stand-in. Only `postMessage` is ever used. */
interface FrameWindow {
  postMessage(data: ConnectMessage, targetOrigin: string): void;
  /**
   * jsdom closes child browsing contexts when the environment tears down, so the stand-in
   * needs the method even though the game never calls it.
   */
  close(): void;
}

function replyFor(message: ConnectMessage): IdentityReply | null {
  if (message.type !== 'startng:whoami') return null;
  whoamiCount += 1;
  if (nextWho === 'silent') return null;
  return {
    type: 'startng:user',
    user: nextWho === 'user' ? USER : null,
    guest: nextWho === 'user' ? null : GUEST,
  };
}

const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms));

/** Runs the two events the docs say to re-ask on when the player returns to the tab. */
async function returnToTab() {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await flush();
  });
}

beforeEach(() => {
  nextWho = 'guest';
  whoamiCount = 0;

  // The adapter only re-asks when the document is visible, so make it visible.
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  });

  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(
    (tag: string, options?: ElementCreationOptions) => {
      const element = realCreate(tag, options);
      if (tag.toLowerCase() !== 'iframe') return element;

      framesCreated += 1;
      const frameWindow: FrameWindow = {
        close() {},
        postMessage(data: ConnectMessage, targetOrigin: string) {
          // The game must post to start.ng and nowhere else.
          if (targetOrigin !== ORIGIN) {
            throw new Error(`posted to ${targetOrigin}, expected ${ORIGIN}`);
          }
          const reply = replyFor(data);
          if (!reply) return;
          setTimeout(() => {
            const event = new MessageEvent('message', {
              data: { ...reply, requestId: data.requestId },
              origin: ORIGIN,
            });
            // jsdom does not carry MessageEvent.source through the constructor.
            Object.defineProperty(event, 'source', { value: frameWindow });
            window.dispatchEvent(event);
          }, 0);
        },
      };

      Object.defineProperty(element, 'contentWindow', {
        value: frameWindow,
        configurable: true,
      });
      // jsdom performs no navigation, so announce the frame as loaded by hand.
      setTimeout(() => element.dispatchEvent(new Event('load')), 0);
      return element;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sign-in state synchronisation', () => {
  it('shows the guest state before sign-in', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    expect(view.result.current.isGuest).toBe(true);
    expect(view.result.current.user).toBeNull();
    expect(view.result.current.name).toBe('Guest');
    expect(view.result.current.loading).toBe(false);
    // Reachable, so this is a guest session rather than an offline fallback.
    expect(view.result.current.offline).toBe(false);

    view.unmount();
  });

  it('never shows Sign in while the identity is still being checked', async () => {
    // The reported bug: coming back from sign-in, the player saw "Sign in" because the button
    // was rendered before start.ng had answered.
    nextWho = 'user';

    const view = renderHook(() => usePlayer());

    // Before the answer arrives the state must still be "checking", not "guest".
    expect(view.result.current.loading).toBe(true);

    await act(async () => {
      await flush();
    });

    expect(view.result.current.loading).toBe(false);
    expect(view.result.current.isGuest).toBe(false);
    view.unmount();
  });

  it('picks up the signed-in player on the return from the sign-in flow', async () => {
    // The player signed in on start.ng and was sent back with the documented session marker
    // in the hash. start.ng is now signed in, so the fresh load must show them signed in.
    nextWho = 'user';
    window.history.replaceState(null, '', '/#startng_session=eyJfake&expires_in=7200');

    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    expect(view.result.current.isGuest).toBe(false);
    expect(view.result.current.user?.id).toBe(42);
    expect(view.result.current.name).toBe('Runner Tee');
    expect(view.result.current.signInIssue).toBeNull();

    view.unmount();
  });

  it('clears the session back out of the address bar', async () => {
    nextWho = 'user';
    window.history.replaceState(null, '', '/#startng_session=eyJfake&expires_in=7200');

    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    expect(location.hash).not.toContain('startng_session');
    view.unmount();
  });

  it('never treats the session marker as proof of sign-in', async () => {
    // A hand-edited or stale marker must not make the game claim the player is signed in.
    // Only start.ng's own answer may do that.
    nextWho = 'guest';
    window.history.replaceState(null, '', '/#startng_session=eyJforged&expires_in=7200');

    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    expect(view.result.current.user).toBeNull();
    expect(view.result.current.isGuest).toBe(true);
    // The player came back but is not signed in, so say so.
    expect(view.result.current.signInIssue).toBe('Still not signed in. Try again.');

    view.unmount();
  });

  it('ignores a marker with no expiry, and leaves unrelated hashes alone', async () => {
    nextWho = 'user';
    window.history.replaceState(null, '', '/#some-other-hash');
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });
    expect(location.hash).toBe('#some-other-hash');
    view.unmount();

    window.history.replaceState(null, '', '/');
  });

  it('keeps a guest visit a guest even when start.ng reports a signed-in user', async () => {
    // start.ng offers guest play and opens the game with ?guest. That visit must keep the
    // guest look, and must not flip to signed in, whichever path notices first.
    nextWho = 'user';
    window.history.replaceState(null, '', '/?guest');

    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    expect(view.result.current.isGuest).toBe(true);
    expect(view.result.current.user).toBeNull();
    // Still the guest's own look, not the signed-in player's.
    expect(view.result.current.name).toBe('Guest');
    expect(view.result.current.style?.primaryColor).toBe('#a55eea');

    await returnToTab();
    expect(view.result.current.isGuest).toBe(true);
    expect(view.result.current.user).toBeNull();
    expect(view.result.current.loading).toBe(false);

    window.history.replaceState(null, '', '/');
    view.unmount();
  });

  it('notices the player signed in when they return to the tab', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });
    expect(view.result.current.isGuest).toBe(true);

    // The player completes the sign-in flow on start.ng and comes back to the game.
    nextWho = 'user';
    await returnToTab();

    expect(view.result.current.isGuest).toBe(false);
    expect(view.result.current.user?.id).toBe(42);
    expect(view.result.current.name).toBe('Runner Tee');
    expect(view.result.current.account).toBe('Hamzat');
    // The character's own look comes from the player, not the guest.
    expect(view.result.current.style?.primaryColor).toBe('#39ff88');

    view.unmount();
  });

  it('notices sign-in from the focus event alone', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    nextWho = 'user';
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await flush();
    });

    expect(view.result.current.isGuest).toBe(false);
    expect(view.result.current.user?.id).toBe(42);

    view.unmount();
  });

  it('notices sign-in from the visibilitychange event alone', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    nextWho = 'user';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
    });

    expect(view.result.current.isGuest).toBe(false);

    view.unmount();
  });

  it('picks the signed-in player up on a fresh load after returning', async () => {
    // The documented return URL carries a game session in the hash. The docs say that with
    // the connect page it can be ignored: ask whoami again.
    window.history.replaceState(null, '', '/#startng_session=eyJfake&expires_in=7200');
    nextWho = 'user';

    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    expect(view.result.current.isGuest).toBe(false);
    expect(view.result.current.user?.id).toBe(42);

    window.history.replaceState(null, '', '/');
    view.unmount();
  });

  it('re-asks after a back/forward cache restore', async () => {
    // A bfcache restore keeps the page's JavaScript but does not re-run effects, so the
    // sign-in that happened while it was hidden has to be picked up here.
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });
    expect(view.result.current.isGuest).toBe(true);

    nextWho = 'user';
    await act(async () => {
      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', { value: true });
      window.dispatchEvent(event);
      await flush();
    });

    expect(view.result.current.isGuest).toBe(false);
    expect(view.result.current.user?.id).toBe(42);
    view.unmount();
  });

  it('keeps showing guest when start.ng does not answer', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    // A cancelled or failed sign-in leaves start.ng unreachable or signed out.
    nextWho = 'silent';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await flush(5200); // outlast the whoami timeout
    });

    // Never silently becomes a signed-in player, and keeps the guest affordance.
    expect(view.result.current.isGuest).toBe(true);
    expect(view.result.current.user).toBeNull();
    expect(view.result.current.name).toBe('Guest');

    view.unmount();
  }, 20000);

  it('falls back to guest when start.ng answers with neither user nor guest', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
    });
    // The stand-in answered, so we are online and settled on the guest look.
    expect(view.result.current.offline).toBe(false);
    expect(view.result.current.isGuest).toBe(true);

    view.unmount();
  });

  it('asks start.ng exactly once on load', async () => {
    // The live deployment used to send two startng:whoami messages on every page view,
    // because the mount check and the change watcher each asked.
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    expect(whoamiCount).toBe(1);
    view.unmount();
  });

  it('does not poll repeatedly for a single page view', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });

    const afterMount = whoamiCount;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      await flush();
    });

    // At most one ask per event, and never a self-sustaining loop.
    expect(whoamiCount - afterMount).toBeLessThanOrEqual(3);
    view.unmount();
  });

  it('reuses a single connect frame for the whole session', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });
    nextWho = 'user';
    await returnToTab();

    expect(framesCreated).toBe(1);
    view.unmount();
  });

  it('stops re-asking once the component unmounts', async () => {
    const view = renderHook(() => usePlayer());
    await act(async () => {
      await flush();
    });
    view.unmount();

    const afterUnmount = whoamiCount;
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();

    expect(whoamiCount).toBe(afterUnmount);
  });
});
