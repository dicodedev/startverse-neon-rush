import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import { GameLoop } from './game/GameLoop';
import { NeonScene } from './game/NeonScene';
import { loadBoard, saveRun } from './game/scores';
import { useGame, type RunStats } from './game/store';
import {
  createPlayer,
  createWorld,
  jump,
  moveLane,
  type PlayerState,
  type WorldState,
} from './game/world';
import { usePlayer } from './startng/usePlayer';
import { Hud } from './ui/Hud';
import { Leaderboard } from './ui/Leaderboard';
import { GameOver, Menu } from './ui/Overlays';
import { PlayerCard } from './ui/PlayerCard';

export default function App() {
  const who = usePlayer();
  const phase = useGame((s) => s.phase);
  const stats = useGame((s) => s.stats);
  const lastRun = useGame((s) => s.lastRun);
  const best = useGame((s) => s.best);
  const newBest = useGame((s) => s.newBest);
  const rank = useGame((s) => s.rank);
  const leaderboard = useGame((s) => s.leaderboard);
  const offline = useGame((s) => s.offline);
  const notice = useGame((s) => s.notice);

  // The run lives in refs so the render loop can mutate it without re-rendering React.
  const worldRef = useRef<WorldState>(createWorld());
  const playerRef = useRef<PlayerState>(createPlayer());

  const startRun = useCallback(() => {
    worldRef.current = createWorld();
    playerRef.current = createPlayer();
    useGame.getState().setNotice(null);
    useGame.getState().start();
    void loadBoard(10).then((b) => {
      useGame.getState().setLeaderboard(b.entries);
      useGame.getState().setOffline(b.offline);
    });
  }, []);

  const finishRun = useCallback(() => {
    const { distance, shardsCollected, elapsed } = worldRef.current;
    const run: RunStats = {
      distance,
      shards: shardsCollected,
      survived: elapsed,
    };
    useGame.getState().end(run);
    useGame.getState().setStats(run);

    void (async () => {
      const result = await saveRun(run);
      useGame.getState().setBest(result.best);
      useGame.getState().setNewBest(result.improved);
      useGame.getState().setRank(result.rank);
      useGame.getState().setNotice(result.error ?? null);
      const board = await loadBoard(10);
      useGame.getState().setLeaderboard(board.entries);
      useGame.getState().setOffline(board.offline);
    })();
  }, []);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().phase !== 'running') return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          moveLane(playerRef.current, -1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          moveLane(playerRef.current, 1);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          jump(playerRef.current);
          break;
        default:
          return;
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  // Touch controls: a swipe left, right or up.
  useEffect(() => {
    const SWIPE = 24;
    let x = 0;
    let y = 0;
    let tracking = false;

    const start = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      x = t.clientX;
      y = t.clientY;
      tracking = true;
    };

    const end = (e: TouchEvent) => {
      if (!tracking || useGame.getState().phase !== 'running') return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - x;
      const dy = t.clientY - y;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE) {
        moveLane(playerRef.current, dx > 0 ? 1 : -1);
      } else if (dy < -SWIPE) {
        jump(playerRef.current);
      }
    };

    addEventListener('touchstart', start, { passive: true });
    addEventListener('touchend', end, { passive: true });
    return () => {
      removeEventListener('touchstart', start);
      removeEventListener('touchend', end);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 4, 8], fov: 50, near: 0.1, far: 220 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ camera }) => camera.lookAt(0, 1.2, -3)}
      >
        <GameLoop worldRef={worldRef} playerRef={playerRef} onHit={finishRun} />
        <NeonScene
          world={worldRef.current}
          player={playerRef.current}
          style={who.style}
          running={phase === 'running'}
        />
      </Canvas>

      <PlayerCard who={who} onSignIn={who.signIn} />

      {phase === 'running' && <Hud stats={stats} best={best} />}

      {phase === 'menu' && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-4">
          <Leaderboard
            entries={leaderboard}
            myId={who.user?.id ?? null}
            isGuest={who.isGuest}
            offline={offline}
          />
        </div>
      )}

      {phase === 'menu' && <Menu who={who} best={best} onStart={startRun} onSignIn={who.signIn} />}

      {phase === 'over' && lastRun && (
        <GameOver
          run={lastRun}
          best={best}
          newBest={newBest}
          rank={rank}
          notice={notice}
          isGuest={who.isGuest}
          onRestart={startRun}
          onSignIn={who.signIn}
        />
      )}
    </div>
  );
}
