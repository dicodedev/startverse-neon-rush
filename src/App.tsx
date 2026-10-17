import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import { play, unlockAudio } from './audio/sfx';
import { CAMERA_FOV, CAMERA_POSITION, CAMERA_TARGET } from './game/constants';
import { GameLoop } from './game/GameLoop';
import { NeonScene } from './game/NeonScene';
import { loadBoard, saveRun } from './game/scores';
import { useGame, type RunStats } from './game/store';
import {
  canJump,
  createPlayer,
  createWorld,
  jump,
  moveLane,
  swipeAction,
  type PlayerState,
  type PickedShard,
  type WorldState,
} from './game/world';
import { usePlayer } from './startng/usePlayer';
import { Hud } from './ui/Hud';
import { Leaderboard } from './ui/Leaderboard';
import { GameOver, Menu, Paused, Victory } from './ui/Overlays';
import { PlayerCard } from './ui/PlayerCard';
import { RunControls } from './ui/RunControls';

/** How long the checkpoint distance stays on the HUD. */
const CHECKPOINT_FLASH_MS = 1600;

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
  const checkpoint = useGame((s) => s.checkpoint);
  const soundOn = useGame((s) => s.soundOn);
  const toggleSound = useGame((s) => s.toggleSound);

  // The run lives in refs so the render loop can mutate it without re-rendering React.
  const worldRef = useRef<WorldState>(createWorld());
  const playerRef = useRef<PlayerState>(createPlayer());

  // Treats collected this frame, waiting to be animated. A ref, because the render loop
  // drains it every frame and must not re-render React to do so.
  const pendingPickups = useRef<PickedShard[]>([]);
  const takePending = useCallback(() => {
    if (pendingPickups.current.length === 0) return [];
    const queued = pendingPickups.current;
    pendingPickups.current = [];
    return queued;
  }, []);

  // Hides the checkpoint flash again after a moment.
  useEffect(() => {
    if (checkpoint === null) return;
    const timer = setTimeout(() => useGame.getState().setCheckpoint(null), CHECKPOINT_FLASH_MS);
    return () => clearTimeout(timer);
  }, [checkpoint]);

  const startRun = useCallback(() => {
    worldRef.current = createWorld();
    playerRef.current = createPlayer();
    // Clear any pickup still animating from the previous run.
    pendingPickups.current = [];
    useGame.getState().setNotice(null);
    unlockAudio();
    play('uiStart');
    useGame.getState().start();
    void loadBoard(10).then((b) => {
      useGame.getState().setLeaderboard(b.entries);
      useGame.getState().setOffline(b.offline);
    });
  }, []);

  const togglePause = useCallback(() => {
    const phase = useGame.getState().phase;
    if (phase === 'running') {
      useGame.getState().pause();
      play('uiPause');
    } else if (phase === 'paused') {
      useGame.getState().resume();
      play('uiResume');
    }
  }, []);

  /** Saves the run and shows the right end card. */
  const endRun = useCallback((won: boolean) => {
    const { distance, shardsCollected, elapsed } = worldRef.current;
    const run: RunStats = {
      distance,
      shards: shardsCollected,
      survived: elapsed,
    };
    if (won) useGame.getState().win(run);
    else useGame.getState().end(run);
    useGame.getState().setStats(run);
    play(won ? 'victory' : 'gameOver');

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

  const finishRun = useCallback(() => endRun(false), [endRun]);
  const winRun = useCallback(() => endRun(true), [endRun]);

  const onPickup = useCallback((picked: PickedShard[]) => {
    for (const shard of picked) pendingPickups.current.push(shard);
  }, []);

  const onCheckpoint = useCallback((distance: number) => {
    useGame.getState().setCheckpoint(distance);
    play('checkpoint');
  }, []);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const phase = useGame.getState().phase;

      // Pause and resume work in both directions, from anywhere in a run.
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (phase === 'running' || phase === 'paused') {
          e.preventDefault();
          togglePause();
        }
        return;
      }

      if (phase !== 'running') return;
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
          // Only sound when the jump actually leaves the ground.
          if (canJump(playerRef.current)) play('jump');
          jump(playerRef.current);
          break;
        default:
          return;
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [togglePause]);

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
      const action = swipeAction(t.clientX - x, t.clientY - y, SWIPE);
      if (!action) return;

      if (action.type === 'jump') {
        if (canJump(playerRef.current)) play('jump');
        jump(playerRef.current);
      } else {
        moveLane(playerRef.current, action.dir);
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
        // The chase camera sits behind the player on -z and looks towards +z.
        // world.ts scrolls the world towards -z, so the player travels towards +z and
        // hazards arrive from +z. Putting the camera at -z makes it chase from behind and
        // keeps the incoming track, rather than looking back up the track it has passed.
        // Note that looking along +z mirrors world x on screen, which is why LANES is
        // ordered so that a higher lane index is further right. See constants.ts.
        camera={{
          position: [...CAMERA_POSITION],
          fov: CAMERA_FOV,
          near: 0.1,
          far: 220,
        }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ camera }) => camera.lookAt(...CAMERA_TARGET)}
      >
        <GameLoop
          worldRef={worldRef}
          playerRef={playerRef}
          onHit={finishRun}
          onWin={winRun}
          onPickup={onPickup}
          onCheckpoint={onCheckpoint}
        />
        <NeonScene
          world={worldRef.current}
          player={playerRef.current}
          style={who.style}
          running={phase === 'running'}
          takePending={takePending}
        />
      </Canvas>

      <PlayerCard who={who} onSignIn={who.signIn} />

      {phase === 'running' && <Hud stats={stats} best={best} checkpoint={checkpoint} />}
      {phase === 'running' && <RunControls onPause={togglePause} />}

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
          who={who}
          onRestart={startRun}
          onSignIn={who.signIn}
        />
      )}

      {phase === 'paused' && <Paused onResume={() => togglePause()} onRestart={startRun} soundOn={soundOn} onToggleSound={toggleSound} />}

      {phase === 'won' && lastRun && (
        <Victory
          run={lastRun}
          best={best}
          newBest={newBest}
          onRestart={startRun}
          who={who}
        />
      )}
    </div>
  );
}
