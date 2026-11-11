import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, useScores, useGameSfx, useGameKeys } from './gameKit';
import { useLocalStorageState } from '../../hooks';

type Grid = number[]; // 81 cells, 0 = empty

const BASE = 3;
const N = 9;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pattern(r: number, c: number) {
  return (BASE * (r % BASE) + Math.floor(r / BASE) + c) % N;
}

function generateSolution(): Grid {
  const rows = shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const cols = shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const nums = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const grid: Grid = new Array(81).fill(0);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      grid[r * 9 + c] = nums[pattern(rows[r], cols[c])];
    }
  }
  return grid;
}

function solve(grid: Grid): Grid | null {
  const idx = grid.indexOf(0);
  if (idx === -1) return grid;
  const row = Math.floor(idx / 9);
  const col = idx % 9;
  const used = new Set<number>();
  for (let i = 0; i < 9; i++) {
    used.add(grid[row * 9 + i]);
    used.add(grid[i * 9 + col]);
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) used.add(grid[(br + r) * 9 + bc + c]);
  for (let n = 1; n <= 9; n++) {
    if (used.has(n)) continue;
    grid[idx] = n;
    const out = solve(grid);
    if (out) return out;
    grid[idx] = 0;
  }
  return null;
}

function countSolutions(grid: Grid, limit = 2): number {
  const idx = grid.indexOf(0);
  if (idx === -1) return 1;
  const row = Math.floor(idx / 9);
  const col = idx % 9;
  const used = new Set<number>();
  for (let i = 0; i < 9; i++) {
    used.add(grid[row * 9 + i]);
    used.add(grid[i * 9 + col]);
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) used.add(grid[(br + r) * 9 + bc + c]);
  let total = 0;
  for (let n = 1; n <= 9; n++) {
    if (used.has(n)) continue;
    grid[idx] = n;
    total += countSolutions(grid, limit - total);
    grid[idx] = 0;
    if (total >= limit) break;
  }
  return total;
}

function makePuzzle(difficulty: 'easy' | 'medium' | 'hard'): { puzzle: Grid; solution: Grid } {
  const solution = generateSolution();
  const puzzle = [...solution];
  const holes = difficulty === 'easy' ? 38 : difficulty === 'medium' ? 48 : 54;
  const positions = shuffled(Array.from({ length: 81 }, (_, i) => i));
  let removed = 0;
  for (const pos of positions) {
    if (removed >= holes) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    const copy = [...puzzle];
    if (countSolutions(copy) !== 1) {
      puzzle[pos] = backup;
    } else {
      removed += 1;
    }
  }
  return { puzzle, solution };
}

export default function SudokuGame() {
  const [difficulty, setDifficulty] = useLocalStorageState<'easy' | 'medium' | 'hard'>('owl:sudoku-difficulty', 'medium');
  const [state, setState] = useLocalStorageState<{ puzzle: Grid; solution: Grid; notes: number[] } | null>('owl:sudoku-save', null);
  const [grid, setGrid] = useState<Grid>([]);
  const [notes, setNotes] = useState<number[]>(Array.from({ length: 81 }, () => 0));
  const [selected, setSelected] = useState<number | null>(40);
  const [noteMode, setNoteMode] = useState(false);
  const [history, setHistory] = useState<Grid[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [won, setWon] = useState(false);
  const [status, setStatus] = useState('');
  const sfx = useGameSfx();
  const { best, submit } = useScores('sudoku');
  const toast = useStore((s) => s.toast);
  const startedAt = useRef<number>(Date.now());

  const newGame = useCallback((diff = difficulty) => {
    const { puzzle, solution } = makePuzzle(diff);
    setState({ puzzle, solution, notes: Array.from({ length: 81 }, () => 0) });
    setGrid(puzzle);
    setNotes(Array.from({ length: 81 }, () => 0));
    setHistory([]);
    setSelected(puzzle.findIndex((v) => v === 0));
    setSeconds(0);
    setWon(false);
    setStatus('');
    startedAt.current = Date.now();
    sfx('click');
  }, [difficulty, setState, sfx]);

  // hydrate from saved game
  useEffect(() => {
    if (state) {
      setGrid(state.puzzle);
      setNotes(state.notes || Array.from({ length: 81 }, () => 0));
      setSelected(state.puzzle.findIndex((v) => v === 0));
    } else {
      newGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (won || !grid.length) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [won, grid.length]);

  const puzzle = state?.puzzle ?? grid;
  const solution = state?.solution ?? grid;

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    if (!grid.length) return bad;
    for (let i = 0; i < 81; i++) {
      const v = grid[i];
      if (!v) continue;
      const row = Math.floor(i / 9);
      const col = i % 9;
      for (let j = 0; j < 81; j++) {
        if (j === i || grid[j] !== v) continue;
        const r2 = Math.floor(j / 9);
        const c2 = j % 9;
        if (r2 === row || c2 === col) { bad.add(i); bad.add(j); }
        else if (Math.floor(r2 / 3) === Math.floor(row / 3) && Math.floor(c2 / 3) === Math.floor(col / 3)) { bad.add(i); bad.add(j); }
      }
    }
    return bad;
  }, [grid]);

  const remaining = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let n = 1; n <= 9; n++) counts[n] = 9 - grid.filter((v) => v === n).length;
    return counts;
  }, [grid]);

  const place = useCallback((index: number, value: number) => {
    if (!grid.length || won) return;
    if (puzzle[index] !== 0) return;
    setHistory((h) => [...h.slice(-40), grid]);
    if (noteMode) {
      setNotes((prev) => {
        const next = [...prev];
        next[index] = next[index] ^ (1 << value);
        setState((s) => (s ? { ...s, notes: next } : s));
        return next;
      });
      sfx('click');
      return;
    }
    const next = [...grid];
    next[index] = next[index] === value ? 0 : value;
    setGrid(next);
    setState((s) => (s ? { ...s, puzzle: next } : s));
    sfx(next[index] ? 'drop' : 'click');
    if (next.every((v, i) => v === solution[i]) && !next.includes(0)) {
      setWon(true);
      sfx('win');
      const score = Math.max(50, 3000 - seconds * 2 - Math.floor(seconds / 1) + (difficulty === 'hard' ? 600 : difficulty === 'easy' ? 0 : 300));
      submit(score, `${difficulty} · ${Math.floor(seconds / 60)}m ${seconds % 60}s`);
      toast('Puzzle solved!');
    }
  }, [grid, puzzle, solution, noteMode, won, seconds, difficulty, sfx, setState, submit, toast]);

  const moveSelection = (dr: number, dc: number) => {
    setSelected((prev) => {
      if (prev === null) return 0;
      const r = Math.max(0, Math.min(8, Math.floor(prev / 9) + dr));
      const c = Math.max(0, Math.min(8, (prev % 9) + dc));
      return r * 9 + c;
    });
  };

  useGameKeys((key, code) => {
    if (key >= '1' && key <= '9') { if (selected !== null) place(selected, Number(key)); return true; }
    if (key === 'Backspace' || key === 'Delete' || key === '0') { if (selected !== null) place(selected, 0); return true; }
    if (key === 'ArrowUp') { moveSelection(-1, 0); return true; }
    if (key === 'ArrowDown') { moveSelection(1, 0); return true; }
    if (key === 'ArrowLeft') { moveSelection(0, -1); return true; }
    if (key === 'ArrowRight') { moveSelection(0, 1); return true; }
    if (key === 'n' || key === 'N') { setNoteMode((n) => !n); return true; }
    if (key === 'h' || key === 'H') { if (selected !== null) hint(selected); return true; }
    if (key === 'z' || key === 'Z') { undo(); return true; }
    if (key === 'Enter' && won) { newGame(); return true; }
    if (code === 'Space') { setNoteMode((n) => !n); return true; }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, grid, noteMode, won, puzzle, noteMode]);

  const hint = (index: number) => {
    if (puzzle[index] !== 0 || !solution[index]) return;
    const value = solution[index];
    const next = [...grid];
    next[index] = value;
    setGrid(next);
    setState((s) => (s ? { ...s, puzzle: next } : s));
    sfx('bonus');
    toast('Hint revealed');
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setGrid(prev);
      setState((s) => (s ? { ...s, puzzle: prev } : s));
      sfx('click');
      return h.slice(0, -1);
    });
  };

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Sudoku',
      actions: [
        { id: 'new', label: 'New puzzle', icon: 'plus', run: () => newGame() },
        { id: 'easy', label: 'Easy', icon: 'grid', run: () => { setDifficulty('easy'); newGame('easy'); } },
        { id: 'medium', label: 'Medium', icon: 'grid', run: () => { setDifficulty('medium'); newGame('medium'); } },
        { id: 'hard', label: 'Hard', icon: 'grid', run: () => { setDifficulty('hard'); newGame('hard'); } },
        { id: 'notes', label: noteMode ? 'Typing: answers' : 'Typing: notes', icon: 'memo', run: () => setNoteMode((n) => !n) },
        { id: 'undo', label: 'Undo', icon: 'repeat', run: undo },
        { id: 'hint', label: 'Reveal cell', icon: 'help', run: () => selected !== null && hint(selected) },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'sudoku' }) },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteMode, selected, grid, puzzle, solution]);

  const selRow = selected !== null ? Math.floor(selected / 9) : -1;
  const selCol = selected !== null ? selected % 9 : -1;
  const selVal = selected !== null ? grid[selected] : 0;

  return (
    <GameShell
      title="SUDOKU"
      score={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
      best={best}
      status={status || (noteMode ? 'Notes mode' : 'Answer mode')}
      onRestart={() => newGame()}
    >
      <div className="gameCanvasWrap" style={{ background: 'linear-gradient(160deg,#101c26,#070d12)', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', width: 252, height: 252,
              border: '2px solid #d9c79a', background: '#0c1620', borderRadius: 3, overflow: 'hidden',
            }}
            role="grid"
            aria-label="Sudoku grid"
          >
            {grid.map((value, i) => {
              const isGiven = puzzle[i] !== 0;
              const isSel = selected === i;
              const r = Math.floor(i / 9);
              const c = i % 9;
              const sameRow = r === selRow, sameCol = c === selCol;
              const sameBox = selRow >= 0 && Math.floor(r / 3) === Math.floor(selRow / 3) && Math.floor(c / 3) === Math.floor(selCol / 3);
              const sameVal = selVal !== 0 && value === selVal;
              const conflict = conflicts.has(i);
              return (
                <button
                  key={i}
                  role="gridcell"
                  aria-label={`Row ${r + 1} column ${c + 1}: ${value || 'empty'}`}
                  onClick={() => setSelected(i)}
                  style={{
                    position: 'relative', padding: 0, border: 'none',
                    borderRight: c % 3 === 2 && c !== 8 ? '1.5px solid #d9c79a' : '1px solid rgba(217,199,154,.18)',
                    borderBottom: r % 3 === 2 && r !== 8 ? '1.5px solid #d9c79a' : '1px solid rgba(217,199,154,.18)',
                    background: isSel ? '#37536b' : sameVal ? '#25425a' : sameRow || sameCol || sameBox ? '#16283a' : 'transparent',
                    color: conflict ? '#ff7b7b' : isGiven ? '#e8eef5' : '#f6b93f',
                    fontWeight: isGiven ? 700 : 500,
                    fontSize: 13, fontFamily: 'var(--font-display)', cursor: 'pointer',
                  }}
                >
                  {value || (
                    <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', width: '100%', height: '100%', fontSize: 5.5, color: '#7fa4c4' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <span key={n} style={{ display: 'grid', placeItems: 'center' }}>{notes[i] & (1 << n) ? n : ''}</span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', width: 260 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                className="btn"
                onClick={() => selected !== null && place(selected, n)}
                style={{ width: 24, height: 22, fontSize: 11, padding: 0, position: 'relative', opacity: remaining[n] === 0 ? 0.35 : 1 }}
                aria-label={`Place ${n}, ${remaining[n]} remaining`}
              >
                {n}
                <span style={{ position: 'absolute', bottom: 0, right: 1, fontSize: 5.5, opacity: 0.6 }}>{remaining[n]}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`chip ${noteMode ? 'on' : ''}`} onClick={() => setNoteMode((n) => !n)}>Notes</button>
            <button className="chip" onClick={undo} disabled={!history.length}>Undo</button>
            <button className="chip" onClick={() => selected !== null && place(selected, 0)}>Erase</button>
            <button className="chip" onClick={() => selected !== null && hint(selected)}>Hint</button>
          </div>
        </div>
        {won && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>SOLVED</div>
            <div className="tiny">{difficulty} · {Math.floor(seconds / 60)}m {seconds % 60}s</div>
            <button className="btn primary" onClick={() => newGame()}>New puzzle</button>
          </Overlay>
        )}
      </div>
      <div style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        {(['easy', 'medium', 'hard'] as const).map((d) => (
          <button key={d} className={`chip ${difficulty === d ? 'on' : ''}`} onClick={() => { setDifficulty(d); newGame(d); }}>{d}</button>
        ))}
        <span className="tiny" style={{ marginLeft: 'auto' }}>Keys 1–9 place · N notes · H hint · Z undo</span>
      </div>
    </GameShell>
  );
}
