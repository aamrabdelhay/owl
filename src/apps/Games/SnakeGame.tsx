import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, DPad, useScores, useGameSfx, useGameKeys, drawOwl, drawMouse } from './gameKit';
import { formatDate } from '../../os/i18n';

const COLS = 20;
const ROWS = 15;
const CELL = 20;

type Dir = 'up' | 'down' | 'left' | 'right';
type Mode = 'classic' | 'maze' | 'daily';
interface Pt { x: number; y: number }

const DIRS: Record<Dir, Pt> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

const MAZES: { name: string; walls: [number, number][][] }[] = [
  {
    name: 'Meadow',
    walls: [
      [[6, 3], [6, 4], [6, 5], [6, 6]],
      [[13, 8], [13, 9], [13, 10], [13, 11]],
      [[3, 11], [4, 11], [5, 11]],
      [[14, 3], [15, 3], [16, 3]],
    ],
  },
  {
    name: 'Barn',
    walls: [
      [[4, 4], [5, 4], [6, 4], [7, 4], [8, 4]],
      [[11, 10], [12, 10], [13, 10], [14, 10], [15, 10]],
      [[15, 4], [15, 5], [15, 6], [15, 7]],
      [[4, 8], [5, 8], [6, 8], [7, 8]],
      [[10, 2], [10, 3]],
    ],
  },
  {
    name: 'Nest',
    walls: [
      [[9, 2], [10, 2], [9, 3], [10, 3]],
      [[9, 11], [10, 11], [9, 12], [10, 12]],
      [[2, 6], [3, 6], [4, 6], [2, 7], [4, 7], [2, 8], [3, 8], [4, 8]],
      [[15, 6], [16, 6], [17, 6], [15, 7], [17, 7], [15, 8], [16, 8], [17, 8]],
    ],
  },
  {
    name: 'Night Tower',
    walls: [
      [[5, 3], [5, 4], [5, 5], [5, 10], [5, 11], [5, 12]],
      [[14, 3], [14, 4], [14, 5], [14, 10], [14, 11], [14, 12]],
      [[8, 6], [9, 6], [10, 6], [11, 6]],
      [[8, 9], [9, 9], [10, 9], [11, 9]],
      [[9, 7], [10, 7], [9, 8], [10, 8]],
    ],
  },
];

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function mazeName(level: number): string {
  return MAZES[level - 1]?.name || `Challenge ${level}`;
}

function buildWalls(mode: Mode, level: number, wrap: boolean): Set<string> {
  const walls = new Set<string>();
  if (mode === 'maze') {
    const maze = MAZES[level - 1];
    if (maze) {
      maze.walls.forEach((run) => run.forEach(([x, y]) => walls.add(`${x},${y}`)));
    } else {
      // Later campaign stages are generated deterministically from the level.
      const rand = seededRandom(dailySeed() + level * 7919);
      const blocks = 5 + Math.min(8, Math.floor(level / 3));
      for (let b = 0; b < blocks; b++) {
        const horizontal = rand() > 0.5;
        const len = 2 + Math.floor(rand() * 4);
        const x = 2 + Math.floor(rand() * (COLS - 6));
        const y = 2 + Math.floor(rand() * (ROWS - 5));
        for (let i = 0; i < len; i++) {
          const wx = horizontal ? x + i : x;
          const wy = horizontal ? y : y + i;
          if (wx > 1 && wx < COLS - 2 && wy > 1 && wy < ROWS - 2 && !(Math.abs(wx - 9) < 3 && Math.abs(wy - 7) < 2)) walls.add(`${wx},${wy}`);
        }
      }
    }
  } else if (mode === 'daily') {
    const rand = seededRandom(dailySeed());
    const blocks = 4 + Math.floor(rand() * 3);
    for (let b = 0; b < blocks; b++) {
      const horizontal = rand() > 0.5;
      const len = 2 + Math.floor(rand() * 3);
      const x = 2 + Math.floor(rand() * (COLS - 5));
      const y = 2 + Math.floor(rand() * (ROWS - 5));
      for (let i = 0; i < len; i++) {
        const wx = horizontal ? x + i : x;
        const wy = horizontal ? y : y + i;
        if (wx < COLS - 1 && wy < ROWS - 1) walls.add(`${wx},${wy}`);
      }
    }
  } else if (!wrap) {
    // classic without wrap uses the border as a wall
    for (let x = 0; x < COLS; x++) { walls.add(`${x},0`); walls.add(`${x},${ROWS - 1}`); }
    for (let y = 0; y < ROWS; y++) { walls.add(`0,${y}`); walls.add(`${COLS - 1},${y}`); }
  }
  return walls;
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('classic');
  const [speed, setSpeed] = useState(4);
  const [wrap, setWrap] = useState(true);
  const [colorMode, setColorMode] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [miceEaten, setMiceEaten] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [ready, setReady] = useState(true);
  const [status, setStatus] = useState('');
  const [bestRow, setBestRow] = useState<number | null>(null);
  const { best, submit } = useScores('snake');
  const sfx = useGameSfx();
  const toast = useStore((s) => s.toast);
  const settings = useStore((s) => s.settings);

  const game = useRef({
    snake: [{ x: 9, y: 7 }] as Pt[],
    dir: 'right' as Dir,
    queue: [] as Dir[],
    mouse: { x: 14, y: 7, golden: false, born: 0 } as { x: number; y: number; golden: boolean; born: number },
    walls: new Set<string>(),
    score: 0,
    miceEaten: 0,
    level: 1,
    tickMs: 150,
    lastTick: 0,
    boostUntil: 0,
    miceSpawned: 0,
    alive: true,
    blink: false,
  });

  const rafRef = useRef(0);

  const spawnMouse = useCallback(() => {
    const g = game.current;
    const occupied = new Set(g.snake.map((p) => `${p.x},${p.y}`));
    g.walls.forEach((w) => occupied.add(w));
    const free: Pt[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (!free.length) return;
    const pick = free[Math.floor(Math.random() * free.length)];
    g.miceSpawned += 1;
    g.mouse = { ...pick, golden: g.miceSpawned % 5 === 0 || Math.random() < 0.12, born: performance.now() };
  }, []);

  const reset = useCallback((nextMode: Mode = mode, nextLevel = 1, wrapOverride = wrap) => {
    const g = game.current;
    const startY = Math.floor(ROWS / 2);
    g.snake = [{ x: 4, y: startY }, { x: 3, y: startY }];
    g.dir = 'right';
    g.queue = [];
    g.walls = buildWalls(nextMode, nextLevel, wrapOverride);
    g.score = 0;
    g.miceEaten = 0;
    g.level = nextLevel;
    g.boostUntil = 0;
    g.miceSpawned = 0;
    g.alive = true;
    g.tickMs = 240 - speed * 16;
    g.lastTick = 0;
    setScore(0);
    setLevel(nextLevel);
    setMiceEaten(0);
    setGameOver(false);
    setPaused(false);
    setRunning(false);
    setReady(true);
    setStatus(nextMode === 'maze' ? `${mazeName(nextLevel)} · eat 6 mice` : nextMode === 'daily' ? `Daily maze · ${formatDate(settings.language, new Date(), { month: 'short', day: 'numeric' })}` : 'Classic');
    spawnMouse();
  }, [mode, wrap, speed, spawnMouse, settings.language]);

  useEffect(() => {
    reset(mode, 1, wrap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wrap]);

  const die = useCallback((reason: string) => {
    const g = game.current;
    if (!g.alive) return;
    g.alive = false;
    setRunning(false);
    setGameOver(true);
    setStatus(reason);
    sfx('die');
    const final = g.score;
    submit(final);
    const row = final > 0 ? final : null;
    setBestRow(row);
    if (final > best) toast(`New best score: ${final}`);
  }, [sfx, submit, best, toast]);

  const step = useCallback(() => {
    const g = game.current;
    if (!g.alive) return;
    if (g.queue.length) {
      const next = g.queue.shift()!;
      if (OPPOSITE[g.dir] !== next) g.dir = next;
    }
    const delta = DIRS[g.dir];
    const head = g.snake[0];
    let nx = head.x + delta.x;
    let ny = head.y + delta.y;

    if (mode === 'classic' && wrap) {
      nx = (nx + COLS) % COLS;
      ny = (ny + ROWS) % ROWS;
    } else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      die('You hit the wall');
      return;
    }

    if (g.walls.has(`${nx},${ny}`)) { die('You hit a wall'); return; }

    const willEat = nx === g.mouse.x && ny === g.mouse.y;
    const bodyToCheck = willEat ? g.snake : g.snake.slice(0, -1);
    if (bodyToCheck.some((p) => p.x === nx && p.y === ny)) {
      die('You ran into your owlets');
      return;
    }

    g.snake = [{ x: nx, y: ny }, ...g.snake];
    if (!willEat) {
      g.snake.pop();
    } else {
      g.miceEaten += 1;
      const golden = g.mouse.golden;
      const points = golden ? 25 : 5;
      g.score += points;
      g.boostUntil = golden ? performance.now() + 4200 : g.boostUntil;
      sfx(golden ? 'bonus' : 'eat');
      setScore(g.score);
      setMiceEaten(g.miceEaten);
      spawnMouse();
      if (mode === 'maze' && g.miceEaten >= 6) {
        if (g.level >= 30) {
          sfx('win');
          die('Campaign complete!');
          return;
        }
        const nextLevel = g.level + 1;
        g.level = nextLevel;
        g.walls = buildWalls('maze', nextLevel, wrap);
        g.miceEaten = 0;
        setLevel(nextLevel);
        setMiceEaten(0);
        setStatus(`${mazeName(nextLevel)} · eat 6 mice`);
        toast(`Level ${nextLevel}: ${mazeName(nextLevel)}`);
        spawnMouse();
      }
    }
  }, [mode, wrap, die, sfx, spawnMouse, toast]);

  /* --------------------------- render + game loop --------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const palette = colorMode
      ? { bg: '#0d1f16', grid: 'rgba(120,200,150,.07)', wall: '#2f4a3a', wallEdge: '#4d6f57', text: '#d8f5e2' }
      : { bg: '#a8bb8f', grid: 'rgba(60,80,45,.15)', wall: '#5c6f45', wallEdge: '#41532f', text: '#243019' };

    const draw = () => {
      const g = game.current;
      const now = performance.now();
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // grid
      ctx.strokeStyle = palette.grid;
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
      }

      // walls
      g.walls.forEach((key) => {
        const [x, y] = key.split(',').map(Number);
        ctx.fillStyle = palette.wall;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        ctx.fillStyle = palette.wallEdge;
        ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, 3);
      });

      // mouse
      if (g.alive || gameOver) {
        drawMouse(ctx, g.mouse.x * CELL, g.mouse.y * CELL, CELL / 5, g.mouse.golden, now - g.mouse.born);
        if (g.mouse.golden) {
          ctx.strokeStyle = 'rgba(255,230,140,.75)';
          ctx.lineWidth = 1.5;
          const pulse = 2 + Math.sin(now / 220) * 2;
          ctx.strokeRect(g.mouse.x * CELL - pulse / 2, g.mouse.y * CELL - pulse / 2, CELL + pulse, CELL + pulse);
        }
      }

      // owlets then mother
      const blink = Math.floor(now / 3000) % 12 === 0;
      for (let i = g.snake.length - 1; i >= 1; i--) {
        const seg = g.snake[i];
        drawOwl(
          ctx,
          seg.x * CELL + (CELL / 7) * 0.6,
          seg.y * CELL + (CELL / 8) * 0.8,
          CELL / 7,
          {
            baby: true,
            blink: blink && i % 2 === 0,
            body: colorMode ? '#86b98f' : '#6d7f57',
            eye: colorMode ? '#bdf5b0' : '#2c3a22',
          }
        );
      }
      const head = g.snake[0];
      if (head) {
        drawOwl(ctx, head.x * CELL + CELL * 0.06, head.y * CELL + CELL * 0.05, CELL / 7, {
          dir: g.dir,
          blink,
          body: colorMode ? '#f3e2b0' : '#e8d9a8',
          eye: '#f6b93f',
        });
      }

      // boost indicator
      if (now < g.boostUntil) {
        ctx.fillStyle = 'rgba(246,185,63,.9)';
        ctx.fillRect(4, 4, 40 * ((g.boostUntil - now) / 4200), 3);
      }
    };

    const loop = (t: number) => {
      const g = game.current;
      if (running && !paused && g.alive) {
        const boost = t < g.boostUntil ? 0.62 : 1;
        const tick = g.tickMs * boost;
        if (!g.lastTick || t - g.lastTick >= tick) {
          g.lastTick = t;
          step();
        }
      } else if (!running) {
        g.lastTick = 0;
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, paused, step, colorMode, gameOver]);

  /* -------------------------------- controls -------------------------------- */
  const turn = useCallback((dir: Dir) => {
    const g = game.current;
    if (!g.alive) return;
    const last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
    if (OPPOSITE[last] === dir || last === dir) return;
    if (g.queue.length < 2) g.queue.push(dir);
    if (!running) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const start = useCallback(() => {
    const g = game.current;
    if (!g.alive) { reset(mode, 1, wrap); return; }
    setRunning(true);
    setReady(false);
    setPaused(false);
    g.lastTick = 0;
    sfx('click');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wrap, reset]);

  const pause = useCallback(() => {
    setPaused((p) => !p);
    sfx('click');
  }, [sfx]);

  useGameKeys((key, code) => {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') { turn('up'); return true; }
    if (key === 'ArrowDown' || key === 's' || key === 'S') { turn('down'); return true; }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') { turn('left'); return true; }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { turn('right'); return true; }
    if (key === 'Enter' || key === ' ' || code === 'Enter') {
      if (gameOver) reset(mode, 1, wrap); else if (!running) start(); else pause();
      return true;
    }
    if (key === 'p' || key === 'P') { pause(); return true; }
    return false;
  }, [turn, running, gameOver, mode, wrap, start, pause, reset]);

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Owl Snake',
      actions: [
        { id: 'pause', label: paused ? 'Resume' : 'Pause', icon: 'pause', run: () => pause() },
        { id: 'restart', label: 'Restart', icon: 'repeat', run: () => reset(mode, 1, wrap) },
        { id: 'color', label: colorMode ? 'Monochrome LCD' : 'Colour mode', icon: 'palette', run: () => setColorMode((c) => !c) },
        { id: 'wrap', label: wrap ? 'Walls on' : 'Wrap-around on', icon: 'repeat', run: () => setWrap((w) => !w) },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'snake' }) },
        { id: 'exit', label: 'Exit game', icon: 'close', danger: true, run: () => useStore.getState().closeApp() },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
  }, [paused, colorMode, wrap, mode, pause, reset]);

  useEffect(() => () => useStore.getState().setAppMenu(null), []);

  const speedLabel = speed;

  return (
    <GameShell
      title="OWL SNAKE"
      score={score}
      best={best}
      status={status}
      onPause={pause}
      paused={paused}
      onRestart={() => reset(mode, 1, wrap)}
    >
      <div className="gameCanvasWrap">
        <canvas
          ref={canvasRef}
          className="gameCanvas"
          style={{ width: COLS * CELL, height: ROWS * CELL, maxWidth: '100%', maxHeight: '100%' }}
          aria-label={`Owl Snake board. Score ${score}. ${status}`}
        />
        {ready && !gameOver && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.2em', fontSize: 13 }}>OWL SNAKE</div>
            <div className="tiny" style={{ lineHeight: 1.5, maxWidth: 250 }}>
              Eat mice — every mouse adds a baby owlet behind you. Golden mice score 5× and speed you up.
              Avoid the walls and your own owlets.
            </div>
            <div className="btnRow" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={start}>Start (Enter)</button>
            </div>
            <div className="tiny">Arrows / WASD · Enter starts · Menu pauses</div>
          </Overlay>
        )}
        {paused && !gameOver && (
          <Overlay>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Paused</div>
            <div className="btnRow">
              <button className="btn primary" onClick={pause}>Resume</button>
              <button className="btn" onClick={() => reset(mode, 1, wrap)}>Restart</button>
            </div>
          </Overlay>
        )}
        {gameOver && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.12em' }}>GAME OVER</div>
            <div style={{ fontSize: 12 }}>{status}</div>
            <div className="tiny">Score {score} · Owlets {Math.max(0, game.current.snake.length - 1)} · Best {Math.max(best, score)}</div>
            <div className="btnRow" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => reset(mode, 1, wrap)}>Play again</button>
              <button className="btn" onClick={() => useStore.getState().openApp('games', { view: 'scores', game: 'snake' })}>Scores</button>
            </div>
          </Overlay>
        )}
        <DPad onDir={turn} onAction={() => (gameOver ? reset(mode, 1, wrap) : start())} label="Snake direction pad" />
      </div>
      <div style={{ padding: '3px 5px', display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['classic', 'maze', 'daily'] as Mode[]).map((m) => (
          <button key={m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => { setMode(m); }}>
            {m === 'classic' ? 'Classic' : m === 'maze' ? `Maze ${level}` : 'Daily'}
          </button>
        ))}
        <span className="tiny">Speed</span>
        {[1, 3, 5, 7, 9].map((s) => (
          <button key={s} className={`chip ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)} style={{ padding: '1px 4px' }}>{s}</button>
        ))}
        <button className={`chip ${wrap ? 'on' : ''}`} onClick={() => setWrap((w) => !w)} title="Classic wrap-around">Wrap</button>
        <button className={`chip ${colorMode ? 'on' : ''}`} onClick={() => setColorMode((c) => !c)}>{colorMode ? 'Colour' : 'LCD'}</button>
        <span className="tiny" style={{ marginLeft: 'auto' }}>{miceEaten} mice</span>
      </div>
    </GameShell>
  );
}
