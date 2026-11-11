import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, useScores, useGameSfx, useGameKeys } from './gameKit';

const SYMBOLS = ['🦉', '🪶', '🌙', '🐭', '🌲', '⭐', '🍂', '🥚', '🌰', '🕯', '🧭', '☕', '🌊', '🪵', '🔔', '🎵'];

interface Card { id: number; symbol: string; flipped: boolean; matched: boolean }

export default function PairsGame() {
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [cards, setCards] = useState<Card[]>([]);
  const [moves, setMoves] = useState(0);
  const [pairsFound, setPairsFound] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [won, setWon] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const lock = useRef(false);
  const sfx = useGameSfx();
  const { best, submit } = useScores('pairs');
  const [bestTime, setBestTime] = useState<number | null>(null);

  const gridFor = (s: 'small' | 'medium' | 'large') => (s === 'small' ? 8 : s === 'medium' ? 12 : 16);
  const colsFor = (s: 'small' | 'medium' | 'large') => (s === 'small' ? 4 : s === 'medium' ? 4 : 4);

  const build = useCallback((s: 'small' | 'medium' | 'large') => {
    const count = gridFor(s);
    const chosen = SYMBOLS.slice(0, count);
    const deck = [...chosen, ...chosen]
      .map((symbol) => ({ id: Math.random(), symbol, flipped: false, matched: false }))
      .sort(() => Math.random() - 0.5)
      .map((c, i) => ({ ...c, id: i }));
    setCards(deck);
    setMoves(0);
    setPairsFound(0);
    setSeconds(0);
    setWon(false);
    setStarted(false);
    setRunning(false);
    setSelected(null);
    lock.current = false;
  }, []);

  useEffect(() => { build(size); }, [size, build]);

  useEffect(() => {
    if (!started || won) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [started, won]);

  const flip = (index: number) => {
    if (lock.current || won) return;
    const card = cards[index];
    if (!card || card.matched || card.flipped) return;
    if (!started) { setStarted(true); setRunning(true); }
    sfx('flip');
    const next = cards.map((c, i) => (i === index ? { ...c, flipped: true } : c));
    setCards(next);
    const open = next.map((c, i) => ({ c, i })).filter(({ c }) => c.flipped && !c.matched);
    if (open.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = open;
      if (a.c.symbol === b.c.symbol) {
        setTimeout(() => {
          setCards((prev) => prev.map((c, i) => (i === a.i || i === b.i ? { ...c, matched: true } : c)));
          setPairsFound((p) => p + 1);
          sfx('eat');
        }, 280);
      } else {
        lock.current = true;
        setTimeout(() => {
          setCards((prev) => prev.map((c, i) => (i === a.i || i === b.i ? { ...c, flipped: false } : c)));
          lock.current = false;
        }, 780);
      }
    }
  };

  useEffect(() => {
    const total = cards.length / 2;
    if (total > 0 && pairsFound === total && !won) {
      setWon(true);
      setRunning(false);
      sfx('win');
      const points = Math.max(10, 400 - moves * 8 - seconds * 2);
      submit(points, `${moves} moves · ${seconds}s`);
      setBestTime((prev) => (prev === null || seconds < prev ? seconds : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairsFound, cards.length]);

  useGameKeys((key) => {
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'Enter' || key === ' ') {
      if (won) { build(size); return true; }
      const next = selected === null ? 0 : (selected + 1) % Math.max(1, cards.length);
      setSelected(next);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      const next = selected === null ? 0 : (selected - 1 + cards.length) % Math.max(1, cards.length);
      setSelected(next);
      return true;
    }
    if (key === 'f' || key === 'F') { if (selected !== null) flip(selected); return true; }
    return false;
  }, [selected, cards, won, size, build]);

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Pairs',
      actions: [
        { id: 'restart', label: 'New board', icon: 'repeat', run: () => build(size) },
        { id: 'small', label: '3×4 board', icon: 'grid', run: () => setSize('small') },
        { id: 'medium', label: '4×4 board', icon: 'grid', run: () => setSize('medium') },
        { id: 'large', label: '4×5 board', icon: 'grid', run: () => setSize('large') },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'pairs' }) },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
  }, [size, build]);

  const cols = colsFor(size);
  return (
    <GameShell
      title="PAIRS"
      score={moves}
      status={`${pairsFound}/${cards.length / 2} pairs · ${seconds}s`}
      onPause={() => setRunning((r) => !r)}
      paused={!running && started && !won}
      onRestart={() => build(size)}
    >
      <div className="gameCanvasWrap" style={{ alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#12202e,#070d14)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, padding: 8, width: '100%', maxWidth: 340 }}>
          {cards.map((c, i) => (
            <button
              key={c.id}
              onClick={() => { setSelected(i); flip(i); }}
              aria-label={c.flipped || c.matched ? c.symbol : `Hidden card ${i + 1}`}
              style={{
                aspectRatio: '3 / 4', borderRadius: 6, cursor: 'pointer', padding: 0,
                fontSize: 20, display: 'grid', placeItems: 'center',
                border: selected === i ? '2px solid var(--hl)' : '1px solid var(--line)',
                background: c.matched
                  ? 'linear-gradient(160deg,#2c5241,#163124)'
                  : c.flipped
                    ? 'linear-gradient(160deg,#f6f1e2,#d6c9ae)'
                    : 'linear-gradient(160deg,#2b3a4d,#131d28)',
                color: '#1b2415',
                transform: c.matched ? 'scale(.94)' : undefined,
                transition: 'transform 120ms ease, background 120ms ease',
                opacity: c.matched ? 0.75 : 1,
              }}
            >
              {c.flipped || c.matched ? c.symbol : <span style={{ fontSize: 11, opacity: 0.45 }}>🦉</span>}
            </button>
          ))}
        </div>
        {won && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>ALL PAIRS FOUND</div>
            <div className="tiny">{moves} moves · {seconds}s{bestTime !== null ? ` · best time ${bestTime}s` : ''}</div>
            <button className="btn primary" onClick={() => build(size)}>New board</button>
          </Overlay>
        )}
      </div>
      <div style={{ padding: '2px 6px', display: 'flex', gap: 4, alignItems: 'center' }}>
        <span className="tiny">Board</span>
        {(['small', 'medium', 'large'] as const).map((s) => (
          <button key={s} className={`chip ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}>{s}</button>
        ))}
        <span className="tiny" style={{ marginLeft: 'auto' }}>Best score {best}</span>
        <button className="btn" style={{ fontSize: 8.5, padding: '1px 6px' }} onClick={() => { if (selected !== null) flip(selected); }}>Flip</button>
      </div>
    </GameShell>
  );
}
