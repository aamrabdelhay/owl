import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { useStore } from '../../os/store';
import { GameShell, useScores, useGameSfx } from './gameKit';

const FILES = 'abcdefgh';
const PIECES: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};
const VALUE: Record<string, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
const UNLOCK_KEY = 'owl:chess:unlocked-level:v1';

function readUnlocked(): number {
  try {
    return Math.min(25, Math.max(1, Number(localStorage.getItem(UNLOCK_KEY)) || 1));
  } catch { return 1; }
}

function evaluate(position: Chess, perspective: 'w' | 'b'): number {
  let score = 0;
  const board = position.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const sign = piece.color === perspective ? 1 : -1;
      const center = 3.5 - (Math.abs(3.5 - row) + Math.abs(3.5 - col)) / 2;
      const activity = piece.type === 'p' ? (piece.color === 'w' ? 6 - row : row - 1) * 3 : center * 3;
      score += sign * (VALUE[piece.type] + activity);
    }
  }
  if (position.isCheck()) score += position.turn() === perspective ? -22 : 22;
  return score;
}

function minimax(position: Chess, depth: number, alpha: number, beta: number, perspective: 'w' | 'b'): number {
  if (position.isCheckmate()) return position.turn() === perspective ? -100000 - depth : 100000 + depth;
  if (position.isDraw()) return 0;
  if (depth <= 0) return evaluate(position, perspective);

  const maximizing = position.turn() === perspective;
  let best = maximizing ? -Infinity : Infinity;
  const moves = position.moves({ verbose: true });
  for (const move of moves) {
    position.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    const value = minimax(position, depth - 1, alpha, beta, perspective);
    position.undo();
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function chooseComputerMove(position: Chess, level: number) {
  const moves = position.moves({ verbose: true });
  if (!moves.length) return null;
  const perspective = position.turn();
  const depth = level < 9 ? 1 : level < 18 ? 2 : 3;
  const ranked = moves.map((move) => {
    position.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    const base = minimax(position, depth - 1, -Infinity, Infinity, perspective);
    position.undo();
    const imperfection = Math.max(0, 25 - level) * 18;
    return { move, value: base + (Math.random() - 0.5) * imperfection };
  }).sort((a, b) => b.value - a.value);

  // Lower levels intentionally make more mistakes; the top levels use the best searched move.
  const mistakeChance = Math.max(0.025, 0.72 - (level - 1) * 0.029);
  if (ranked.length > 1 && Math.random() < mistakeChance) {
    return ranked[Math.floor(Math.random() * Math.min(ranked.length, Math.max(2, 10 - Math.floor(level / 3))))].move;
  }
  return ranked[0].move;
}

export default function ChessGame() {
  const [game, setGame] = useState(() => new Chess());
  const gameRef = useRef(game);
  const [fen, setFen] = useState(game.fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [level, setLevel] = useState(1);
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [thinking, setThinking] = useState(false);
  const [message, setMessage] = useState('Your move — White starts.');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [finished, setFinished] = useState(false);
  const sfx = useGameSfx();
  const { best, submit } = useScores('chess');

  const legalTargets = useMemo(() => {
    if (!selected) return [];
    return gameRef.current.moves({ square: selected, verbose: true }).map((move) => move.to);
  }, [fen, selected]);

  const statusText = thinking ? 'Computer is thinking…' : message;
  const board = game.board();

  const completeMove = (current: Chess, from: Square, to: Square) => {
    try {
      const move = current.move({ from, to, promotion: 'q' });
      if (!move) return false;
      setSelected(null);
      setLastMove({ from: move.from, to: move.to });
      setFen(current.fen());
      setGame(new Chess(current.fen()));
      sfx(move.captured ? 'eat' : 'click');
      if (current.isCheckmate()) {
        const winner = current.turn() === 'w' ? 'Black' : 'White';
        const playerWon = (winner === 'White' && playerColor === 'w') || (winner === 'Black' && playerColor === 'b');
        setFinished(true);
        setThinking(false);
        setMessage(playerWon ? 'Checkmate — you won!' : 'Checkmate — computer wins.');
        if (playerWon) {
          submit(level * 500, `Level ${level}`);
          const next = Math.min(25, Math.max(unlocked, level + 1));
          setUnlocked(next);
          try { localStorage.setItem(UNLOCK_KEY, String(next)); } catch { /* storage may be unavailable */ }
          sfx('win');
        } else {
          sfx('die');
        }
      } else if (current.isDraw()) {
        setFinished(true);
        setThinking(false);
        setMessage('Draw — the game is over.');
      } else {
        setMessage(current.isCheck() ? 'Check!' : current.turn() === playerColor ? 'Your move.' : 'Computer to move.');
      }
      return true;
    } catch {
      setMessage('That move is not legal.');
      return false;
    }
  };

  const reset = (nextLevel = level, nextColor = playerColor) => {
    const fresh = new Chess();
    gameRef.current = fresh;
    setGame(fresh);
    setFen(fresh.fen());
    setLevel(nextLevel);
    setPlayerColor(nextColor);
    setSelected(null);
    setLastMove(null);
    setFinished(false);
    setThinking(false);
    setMessage(nextColor === 'w' ? 'Your move — White starts.' : 'Computer starts — get ready.');
  };

  useEffect(() => {
    const current = gameRef.current;
    if (finished || current.isGameOver() || current.turn() === playerColor) return;
    setThinking(true);
    const timer = window.setTimeout(() => {
      const live = gameRef.current;
      if (live.isGameOver() || live.turn() === playerColor) { setThinking(false); return; }
      const move = chooseComputerMove(live, level);
      if (!move) { setThinking(false); return; }
      setThinking(false);
      completeMove(live, move.from, move.to);
    }, 260);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, playerColor, level, finished]);

  const chooseSquare = (square: Square, row: number, col: number) => {
    if (finished || thinking || gameRef.current.turn() !== playerColor) return;
    const piece = gameRef.current.get(square);
    if (selected && legalTargets.includes(square)) {
      completeMove(gameRef.current, selected, square);
      return;
    }
    if (piece?.color === playerColor) {
      setSelected(square);
      sfx('click');
      return;
    }
    setSelected(null);
  };

  const undoTurn = () => {
    if (thinking) return;
    const current = gameRef.current;
    if (current.history().length < 1) return;
    current.undo();
    if (current.turn() !== playerColor && current.history().length) current.undo();
    const copy = new Chess(current.fen());
    gameRef.current = copy;
    setGame(copy);
    setFen(copy.fen());
    setSelected(null);
    setLastMove(null);
    setFinished(false);
    setMessage('Last turn undone.');
  };

  const files = playerColor === 'w' ? Array.from(FILES) : Array.from(FILES).reverse();
  const rankOrder = playerColor === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <GameShell
      title="OWL CHESS"
      score={`Level ${level}/25`}
      best={best}
      status={statusText}
      onRestart={() => reset()}
    >
      <div style={{ padding: 6, display: 'grid', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
          <span className="tiny">25 computer levels · legal chess rules</span>
          <div className="btnRow">
            <button className="chip" onClick={() => reset(level, 'w')}>Play White</button>
            <button className="chip" onClick={() => reset(level, 'b')}>Play Black</button>
          </div>
        </div>
        <div className="chessBoard" role="grid" aria-label="Chess board">
          {rankOrder.map((rowIndex, displayRow) => files.map((file, displayCol) => {
            const actualCol = FILES.indexOf(file);
            const piece = board[rowIndex][actualCol];
            const square = `${file}${8 - rowIndex}` as Square;
            const isDark = (rowIndex + actualCol) % 2 === 1;
            const isSelected = selected === square;
            const isTarget = legalTargets.includes(square);
            const isLast = lastMove?.from === square || lastMove?.to === square;
            const id = piece ? `${piece.color}${piece.type}` : '';
            return (
              <button
                key={square}
                type="button"
                className={`chessSquare ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isLast ? 'last' : ''}`}
                onClick={() => chooseSquare(square, displayRow, displayCol)}
                aria-label={`${square} ${piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}` : 'empty'}`}
              >
                {piece && <span className={`chessPiece ${piece.color === 'w' ? 'white' : 'black'}`}>{PIECES[id]}</span>}
                {isTarget && <span className="chessTarget" />}
                {displayCol === 0 && <small className="chessCoord">{8 - rowIndex}</small>}
                {displayRow === 7 && <small className="chessCoord file">{file}</small>}
              </button>
            );
          }))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <button className="btn" onClick={undoTurn} disabled={thinking || !game.history().length}>Undo turn</button>
          <button className="btn" onClick={() => reset(level, playerColor)}>New game</button>
          {finished && level < 25 && level < unlocked && (
            <button className="btn primary" onClick={() => reset(level + 1, playerColor)}>Next level</button>
          )}
        </div>
        <div className="chessLevels" aria-label="Chess difficulty levels">
          {Array.from({ length: 25 }, (_, index) => index + 1).map((n) => (
            <button
              key={n}
              className={`chip ${level === n ? 'on' : ''}`}
              disabled={n > unlocked}
              onClick={() => reset(n, playerColor)}
              title={n > unlocked ? 'Win the current level to unlock this level' : `Level ${n}`}
            >{n > unlocked ? '·' : n}</button>
          ))}
        </div>
        <div className="tiny">Levels 1–8: beginner · 9–17: intermediate search · 18–25: deeper computer search. Progress is saved on this device.</div>
      </div>
    </GameShell>
  );
}
