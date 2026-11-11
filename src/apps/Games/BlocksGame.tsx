import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, useScores, useGameSfx, useGameKeys } from './gameKit';

const COLS = 10;
const ROWS = 16;
const CELL = 14;

type Cell = string | null;

const SHAPES: { name: string; cells: number[][]; color: string }[] = [
  { name: 'I', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: '#4aa3ff' },
  { name: 'O', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#f6d55c' },
  { name: 'T', cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: '#b06cf0' },
  { name: 'S', cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#5cc88f' },
  { name: 'Z', cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#e4572e' },
  { name: 'J', cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#f2a33c' },
  { name: 'L', cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#f08f4c' },
];

interface Piece { cells: number[][]; color: string; name: string; x: number; y: number }

const rotate = (cells: number[][]): number[][] => {
  const maxY = Math.max(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [maxY - y, x]);
};

const emptyBoard = (): Cell[][] => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));

export default function BlocksGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [next, setNext] = useState<typeof SHAPES[number]>(SHAPES[0]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState('Stack the owls’ crates');
  const { best, submit } = useScores('blocks');
  const sfx = useGameSfx();

  const st = useRef({
    board: emptyBoard(),
    piece: null as Piece | null,
    nextIndex: 0,
    dropTimer: 0,
    score: 0,
    lines: 0,
    level: 1,
    bag: [] as number[],
  });

  const pickFromBag = (): number => {
    const s = st.current;
    if (!s.bag.length) s.bag = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    return s.bag.pop()!;
  };

  const spawn = useCallback(() => {
    const s = st.current;
    const shape = SHAPES[s.nextIndex];
    s.piece = { cells: shape.cells.map((c) => [...c]), color: shape.color, name: shape.name, x: 3, y: 0 };
    s.nextIndex = pickFromBag();
    setNext(SHAPES[s.nextIndex]);
  }, []);

  const reset = useCallback(() => {
    const s = st.current;
    s.board = emptyBoard();
    s.score = 0;
    s.lines = 0;
    s.level = 1;
    s.bag = [];
    s.dropTimer = 0;
    s.nextIndex = pickFromBag();
    setScore(0);
    setLines(0);
    setLevel(1);
    setOver(false);
    setRunning(false);
    setPaused(false);
    setStatus('Stack the owls’ crates');
    spawn();
  }, [spawn]);

  useEffect(() => { reset(); }, [reset]);

  const collides = (piece: Piece, board: Cell[][], dx = 0, dy = 0, cells = piece.cells): boolean => {
    for (const [cx, cy] of cells) {
      const x = piece.x + cx + dx;
      const y = piece.y + cy + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
    return false;
  };

  const lockPiece = useCallback(() => {
    const s = st.current;
    const piece = s.piece;
    if (!piece) return;
    let toppedOut = false;
    piece.cells.forEach(([cx, cy]) => {
      const x = piece.x + cx;
      const y = piece.y + cy;
      if (y < 0) { toppedOut = true; return; }
      s.board[y][x] = piece.color;
    });
    // clear lines
    let cleared = 0;
    s.board = s.board.filter((row) => {
      if (row.every((c) => c)) { cleared += 1; return false; }
      return true;
    });
    while (s.board.length < ROWS) s.board.unshift(Array<Cell>(COLS).fill(null));
    if (cleared) {
      const points = [0, 40, 100, 300, 1200][cleared] * s.level;
      s.score += points;
      s.lines += cleared;
      s.level = 1 + Math.floor(s.lines / 10);
      setScore(s.score);
      setLines(s.lines);
      setLevel(s.level);
      setStatus(cleared === 4 ? 'TETRIS! 4 rows cleared' : `${cleared} row${cleared > 1 ? 's' : ''} cleared`);
      sfx(cleared >= 4 ? 'bonus' : 'brick');
    } else {
      sfx('drop');
    }
    if (toppedOut) {
      setOver(true);
      setRunning(false);
      submit(s.score);
      sfx('die');
      return;
    }
    spawn();
    if (collides({ ...s.piece!, x: 3, y: 0 }, s.board)) {
      setOver(true);
      setRunning(false);
      submit(s.score);
      sfx('die');
    }
  }, [sfx, spawn, submit]);

  const move = useCallback((dx: number) => {
    const s = st.current;
    if (!s.piece || over) return;
    if (!collides(s.piece, s.board, dx, 0)) {
      s.piece.x += dx;
      sfx('click');
    }
  }, [over, sfx]);

  const rotatePiece = useCallback(() => {
    const s = st.current;
    if (!s.piece || over) return;
    const rotated = rotate(s.piece.cells);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(s.piece, s.board, kick, 0, rotated)) {
        s.piece.cells = rotated;
        s.piece.x += kick;
        sfx('flip');
        return;
      }
    }
  }, [over, sfx]);

  const softDrop = useCallback(() => {
    const s = st.current;
    if (!s.piece || over) return;
    if (!collides(s.piece, s.board, 0, 1)) {
      s.piece.y += 1;
    } else {
      lockPiece();
    }
  }, [lockPiece, over]);

  const hardDrop = useCallback(() => {
    const s = st.current;
    if (!s.piece || over) return;
    let dropped = 0;
    while (!collides(s.piece, s.board, 0, 1)) {
      s.piece.y += 1;
      dropped += 1;
    }
    s.score += dropped * 2;
    setScore(s.score);
    sfx('hit');
    lockPiece();
  }, [lockPiece, over, sfx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let dropAcc = 0;

    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      const s = st.current;

      if (running && !paused && !over && s.piece) {
        dropAcc += dt;
        const interval = Math.max(90, 800 - (s.level - 1) * 70);
        if (dropAcc > interval) {
          dropAcc = 0;
          if (!collides(s.piece, s.board, 0, 1)) s.piece.y += 1;
          else lockPiece();
        }
      }

      ctx.fillStyle = '#070f16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // grid
      ctx.strokeStyle = 'rgba(120,170,210,.06)';
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
      }

      const block = (x: number, y: number, color: string, ghost = false) => {
        if (ghost) {
          ctx.strokeStyle = 'rgba(255,255,255,.22)';
          ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
          return;
        }
        ctx.fillStyle = color;
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.fillRect(x, y, CELL, 2);
        ctx.fillRect(x, y, 2, CELL);
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.fillRect(x, y + CELL - 2, CELL, 2);
        ctx.fillRect(x + CELL - 2, y, 2, CELL);
        // owl eyes on each crate
        ctx.fillStyle = 'rgba(10,15,20,.55)';
        ctx.fillRect(x + 3, y + 5, 2, 2);
        ctx.fillRect(x + CELL - 5, y + 5, 2, 2);
      };

      s.board.forEach((row, y) => row.forEach((cell, x) => {
        if (cell) block(x * CELL, y * CELL, cell);
      }));

      if (s.piece) {
        // ghost
        const ghostY = (() => {
          let gy = s.piece!.y;
          const ghostPiece = { ...s.piece!, y: gy };
          while (!collides(ghostPiece, s.board, 0, 1)) { gy += 1; ghostPiece.y = gy; }
          return gy;
        })();
        s.piece.cells.forEach(([cx, cy]) => block((s.piece!.x + cx) * CELL, (ghostY + cy) * CELL, '#fff', true));
        s.piece.cells.forEach(([cx, cy]) => {
          const yy = s.piece!.y + cy;
          if (yy >= 0) block((s.piece!.x + cx) * CELL, yy * CELL, s.piece!.color);
        });
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, paused, over, lockPiece]);

  useGameKeys((key, code) => {
    if (over) {
      if (key === 'Enter' || key === ' ') reset();
      return true;
    }
    if (!running && (key === 'Enter' || key === ' ')) { setRunning(true); return true; }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') { move(-1); return true; }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { move(1); return true; }
    if (key === 'ArrowDown' || key === 's' || key === 'S') { softDrop(); return true; }
    if (key === 'ArrowUp' || key === 'w' || key === 'W') { rotatePiece(); return true; }
    if (code === 'Space') { hardDrop(); return true; }
    if (key === 'p' || key === 'P') { setPaused((p) => !p); return true; }
    return false;
  }, [running, over, move, rotatePiece, softDrop, hardDrop, reset]);

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Block Stack',
      actions: [
        { id: 'pause', label: paused ? 'Resume' : 'Pause', icon: 'pause', run: () => setPaused((p) => !p) },
        { id: 'restart', label: 'New game', icon: 'repeat', run: reset },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'blocks' }) },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
  }, [paused, reset]);

  return (
    <GameShell title="BLOCK STACK" score={score} best={best} status={status} onPause={() => setPaused((p) => !p)} paused={paused} onRestart={reset}>
      <div className="gameCanvasWrap" style={{ background: 'linear-gradient(160deg,#0c1620,#050b10)', justifyContent: 'center', alignItems: 'flex-start', gap: 6 }}>
        <canvas ref={canvasRef} className="gameCanvas" style={{ width: COLS * CELL, height: ROWS * CELL, maxHeight: '100%', maxWidth: '60%' }} aria-label={`Block Stack, score ${score}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 58, paddingTop: 4 }}>
          <div className="tiny" style={{ color: '#cfe6f5' }}>NEXT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', width: 52, height: 52, gap: 1 }}>
            {Array.from({ length: 16 }).map((_, i) => {
              const x = i % 4;
              const y = Math.floor(i / 4);
              const filledBy = next.cells.some(([cx, cy]) => cx === x && cy === y + 1);
              return (
                <div key={i} style={{ background: filledBy ? next.color : 'rgba(255,255,255,.05)', borderRadius: 1 }} />
              );
            })}
          </div>
          <div className="kv" style={{ border: 'none', padding: 0 }}><span className="tiny">Lines</span><b className="tiny">{lines}</b></div>
          <div className="kv" style={{ border: 'none', padding: 0 }}><span className="tiny">Level</span><b className="tiny">{level}</b></div>
          <button className="btn" style={{ fontSize: 8, padding: '2px 0' }} onClick={() => { if (!running) setRunning(true); rotatePiece(); }}>Rotate</button>
          <button className="btn" style={{ fontSize: 8, padding: '2px 0' }} onClick={hardDrop}>Drop</button>
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="btn" style={{ fontSize: 8, padding: '2px 0', flex: 1 }} onClick={() => move(-1)}>◀</button>
            <button className="btn" style={{ fontSize: 8, padding: '2px 0', flex: 1 }} onClick={() => move(1)}>▶</button>
          </div>
          <button className="btn" style={{ fontSize: 8, padding: '2px 0' }} onClick={softDrop}>▼</button>
        </div>
        {!running && !over && (
          <Overlay onDismiss={() => setRunning(true)}>
            <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.14em', fontSize: 13 }}>BLOCK STACK</div>
            <div className="tiny" style={{ maxWidth: 220, lineHeight: 1.5 }}>←/→ move, ↑ rotate, ↓ soft drop, Space hard drop. Clear four rows for a TETRIS.</div>
            <button className="btn primary" onClick={() => setRunning(true)}>Start</button>
          </Overlay>
        )}
        {paused && !over && <Overlay><div style={{ fontSize: 12, fontWeight: 700 }}>Paused</div><button className="btn primary" onClick={() => setPaused(false)}>Resume</button></Overlay>}
        {over && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>TOPPLED</div>
            <div className="tiny">Score {score} · {lines} lines · Best {Math.max(best, score)}</div>
            <button className="btn primary" onClick={reset}>Play again</button>
          </Overlay>
        )}
      </div>
    </GameShell>
  );
}
