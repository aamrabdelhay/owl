import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, useScores, useGameSfx, useGameKeys } from './gameKit';
import { useLocalStorageState } from '../../hooks';

type Suit = 'S' | 'H' | 'D' | 'C';
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

interface Card { id: string; suit: Suit; rank: Rank; faceUp: boolean }
interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Record<Suit, Card[]>;
  tableau: Card[][];
  moves: number;
  startTime: number;
  won: boolean;
}

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LABEL: Record<Rank, string> = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K' };
const isRed = (suit: Suit) => suit === 'H' || suit === 'D';

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1 as Rank; rank <= 13; rank++) {
      deck.push({ id: `${suit}${rank}`, suit, rank: rank as Rank, faceUp: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function newGame(): GameState {
  const deck = buildDeck();
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop()!;
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }
  return {
    stock: deck.map((c) => ({ ...c, faceUp: false })),
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    tableau,
    moves: 0,
    startTime: Date.now(),
    won: false,
  };
}

type Selection = { source: 'waste' } | { source: 'tableau'; col: number; index: number } | null;

export default function SolitaireGame() {
  const [state, setState] = useLocalStorageState<GameState>('owl:solitaire-save', newGame());
  const [selection, setSelection] = useState<Selection>(null);
  const [cursor, setCursor] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const { best, submit } = useScores('solitaire');
  const sfx = useGameSfx();
  const toast = useStore((s) => s.toast);
  const autoDone = useRef(false);

  useEffect(() => {
    const s = {
      ...state,
      stock: state.stock.map((c) => ({ ...c })),
      waste: state.waste.map((c) => ({ ...c })),
      foundations: { S: [...state.foundations.S], H: [...state.foundations.H], D: [...state.foundations.D], C: [...state.foundations.C] },
      tableau: state.tableau.map((col) => col.map((c) => ({ ...c }))),
    } as GameState;
    setState(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.won) return;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - state.startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [state.won, state.startTime]);

  useEffect(() => {
    const total = SUITS.reduce((acc, s) => acc + state.foundations[s].length, 0);
    if (total === 52 && !state.won) {
      setState((prev) => ({ ...prev, won: true }));
      sfx('win');
      submit(Math.max(120, 2200 - seconds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.foundations]);

  const canPlaceOnTableau = (card: Card, target: Card | undefined) => {
    if (!target) return card.rank === 13;
    return target.faceUp && isRed(card.suit) !== isRed(target.suit) && card.rank === target.rank - 1;
  };

  const canPlaceOnFoundation = (card: Card, suit: Suit) => {
    const pile = state.foundations[suit];
    if (card.suit !== suit) return false;
    if (!pile.length) return card.rank === 1;
    return card.rank === pile[pile.length - 1].rank + 1;
  };

  const draw = () => {
    const s = { ...state };
    if (!s.stock.length) {
      if (!s.waste.length) return;
      s.stock = s.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      s.waste = [];
      sfx('flip');
    } else {
      const card = s.stock[s.stock.length - 1];
      s.stock = s.stock.slice(0, -1);
      s.waste = [...s.waste, { ...card, faceUp: true }];
      sfx('flip');
    }
    s.moves += 1;
    setState(s);
    setSelection(null);
  };

  const flipTop = (col: Card[]) => {
    if (col.length && !col[col.length - 1].faceUp) col[col.length - 1].faceUp = true;
  };

  const moveToFoundation = (card: Card, from: Selection, suit: Suit) => {
    if (!from) return;
    if (!canPlaceOnFoundation(card, suit)) { sfx('error'); return; }
    const s = { ...state, foundations: { ...state.foundations } as Record<Suit, Card[]> };
    s.foundations[suit] = [...s.foundations[suit], { ...card, faceUp: true }];
    if (from.source === 'waste') s.waste = s.waste.slice(0, -1);
    else {
      s.tableau = s.tableau.map((col, i) => (i === from.col ? col.slice(0, from.index) : col));
      flipTop(s.tableau[from.col]);
    }
    s.moves += 1;
    setState(s);
    setSelection(null);
    sfx('drop');
  };

  const moveToTableau = (card: Card, from: Selection, col: number) => {
    if (!from) return;
    const target = state.tableau[col][state.tableau[col].length - 1];
    if (!canPlaceOnTableau(card, target)) { sfx('error'); return; }
    const s = { ...state, tableau: state.tableau.map((c) => [...c]) };
    if (from.source === 'waste') {
      s.tableau[col] = [...s.tableau[col], { ...card, faceUp: true }];
      s.waste = s.waste.slice(0, -1);
    } else {
      if (from.col === col) return;
      const moving = s.tableau[from.col].slice(from.index);
      s.tableau[from.col] = s.tableau[from.col].slice(0, from.index);
      s.tableau[col] = [...s.tableau[col], ...moving];
      flipTop(s.tableau[from.col]);
    }
    s.moves += 1;
    setState(s);
    setSelection(null);
    sfx('drop');
  };

  const autoMove = (card: Card, from: Selection) => {
    for (const suit of SUITS) {
      if (canPlaceOnFoundation(card, suit)) { moveToFoundation(card, from, suit); return; }
    }
    for (let col = 0; col < 7; col++) {
      if (from && from.source === 'tableau' && from.col === col) continue;
      const target = state.tableau[col][state.tableau[col].length - 1];
      if (canPlaceOnTableau(card, target)) { moveToTableau(card, from, col); return; }
    }
    sfx('error');
  };

  const tapWaste = () => {
    if (!state.waste.length) return;
    const card = state.waste[state.waste.length - 1];
    if (selection?.source === 'waste') autoMove(card, { source: 'waste' });
    else { setSelection({ source: 'waste' }); sfx('click'); }
  };

  const tapTableau = (col: number, index: number) => {
    const card = state.tableau[col][index];
    if (!card) {
      if (selection) moveToTableau({ id: 'K', suit: 'S', rank: 13, faceUp: true }, selection, col);
      return;
    }
    if (!card.faceUp) {
      if (index === state.tableau[col].length - 1) {
        const s = { ...state, tableau: state.tableau.map((c, i) => (i === col ? c.map((cc, j) => (j === index ? { ...cc, faceUp: true } : cc)) : c)) };
        setState(s);
        sfx('flip');
      }
      return;
    }
    if (selection) {
      if (selection.source === 'tableau' && selection.col === col) {
        if (index === selection.index) { setSelection(null); return; }
        // selecting a different card in the same column
        const run = state.tableau[col].slice(index);
        if (run.every((c, i) => i === 0 || (c.rank === run[i - 1].rank - 1 && isRed(c.suit) !== isRed(run[i - 1].suit)))) {
          setSelection({ source: 'tableau', col, index });
          return;
        }
      }
      const moving = selection.source === 'waste' ? state.waste[state.waste.length - 1] : state.tableau[selection.col][selection.index];
      const run = selection.source === 'tableau' ? state.tableau[selection.col].slice(selection.index) : [moving];
      const target = state.tableau[col][state.tableau[col].length - 1];
      if (run.length && canPlaceOnTableau(run[0], target)) {
        if (selection.source === 'waste') moveToTableau(moving, selection, col);
        else moveToTableau(moving, selection, col);
        return;
      }
      // try foundation
      if (run.length === 1) {
        for (const suit of SUITS) {
          if (canPlaceOnFoundation(moving, suit)) { moveToFoundation(moving, selection, suit); return; }
        }
      }
      sfx('error');
      return;
    }
    // new selection: only valid if the run below is sequential
    const run = state.tableau[col].slice(index);
    const validRun = run.every((c, i) => i === 0 || (c.faceUp && c.rank === run[i - 1].rank - 1 && isRed(c.suit) !== isRed(run[i - 1].suit)));
    if (!validRun) { sfx('error'); return; }
    setSelection({ source: 'tableau', col, index });
    sfx('click');
  };

  const tapFoundation = (suit: Suit) => {
    if (!selection) return;
    const card = selection.source === 'waste' ? state.waste[state.waste.length - 1] : state.tableau[selection.col][selection.index];
    if (card) moveToFoundation(card, selection, suit);
  };

  const hint = () => {
    if (state.waste.length) {
      const card = state.waste[state.waste.length - 1];
      for (const suit of SUITS) if (canPlaceOnFoundation(card, suit)) { toast(`Play ${RANK_LABEL[card.rank]}${SUIT_GLYPH[card.suit]} to the ${suit} foundation`); return; }
    }
    for (let col = 0; col < 7; col++) {
      const pile = state.tableau[col];
      const top = pile[pile.length - 1];
      if (top && top.faceUp) {
        for (const suit of SUITS) if (canPlaceOnFoundation(top, suit)) { toast(`Play ${RANK_LABEL[top.rank]}${SUIT_GLYPH[top.suit]} to the ${suit} foundation`); return; }
        for (let other = 0; other < 7; other++) {
          if (other === col) continue;
          const target = state.tableau[other][state.tableau[other].length - 1];
          if (canPlaceOnTableau(top, target)) { toast(`Move ${RANK_LABEL[top.rank]}${SUIT_GLYPH[top.suit]} onto column ${other + 1}`); return; }
        }
      }
    }
    toast('No obvious move — draw a card');
  };

  const restart = useCallback(() => {
    setState(newGame());
    setSelection(null);
    autoDone.current = false;
  }, [setState]);

  useGameKeys((key, code) => {
    if (state.won) { if (key === 'Enter') restart(); return true; }
    if (key === 'ArrowLeft') { setCursor((c) => (c + 9) % 10); return true; }
    if (key === 'ArrowRight') { setCursor((c) => (c + 1) % 10); return true; }
    if (key === 'Enter' || code === 'Space') {
      if (cursor === 0) draw();
      else if (cursor >= 8) tapFoundation(SUITS[cursor - 8]);
      else {
        const col = cursor - 1;
        const pile = state.tableau[col];
        tapTableau(col, Math.max(0, pile.length - 1));
      }
      return true;
    }
    if (key === 'd' || key === 'D') { draw(); return true; }
    if (key === 'h' || key === 'H') { hint(); return true; }
    if (key === 'r' || key === 'R') { restart(); return true; }
    return false;
  }, [state, cursor, selection]);

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Solitaire',
      actions: [
        { id: 'new', label: 'New deal', icon: 'repeat', run: restart },
        { id: 'draw', label: 'Draw card', icon: 'chevron', run: draw },
        { id: 'hint', label: 'Hint', icon: 'help', run: hint },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'solitaire' }) },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const totalDone = useMemo(() => SUITS.reduce((acc, s) => acc + state.foundations[s].length, 0), [state.foundations]);

  return (
    <GameShell
      title="SOLITAIRE"
      score={`${state.moves} moves`}
      best={best}
      status={state.won ? 'You won!' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · ${totalDone}/52`}
      onRestart={restart}
    >
      <div className="solitaire" style={{ background: 'linear-gradient(160deg,#0a3d24,#052012)' }}>
        <div className="solTop">
          <button className={`solStock ${state.stock.length ? '' : 'empty'}`} onClick={draw} aria-label={`Stock, ${state.stock.length} cards`}>
            {state.stock.length ? '🂠' : '↻'}
          </button>
          <div className="solWaste" onClick={tapWaste} style={{ cursor: state.waste.length ? 'pointer' : 'default' }}>
            {state.waste.slice(-3).map((card, i, arr) => (
              <CardView key={card.id} card={card} stacked offset={(arr.length - 1 - i) * 3} selected={i === arr.length - 1 && selection?.source === 'waste'} />
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {SUITS.map((suit) => (
            <div key={suit} className="solFoundation" onClick={() => tapFoundation(suit)} style={{ cursor: selection ? 'pointer' : 'default' }}>
              {state.foundations[suit].length ? (
                <CardView card={state.foundations[suit][state.foundations[suit].length - 1]} />
              ) : (
                <span className="solEmpty">{SUIT_GLYPH[suit]}</span>
              )}
            </div>
          ))}
        </div>
        <div className="solTableau">
          {state.tableau.map((col, colIndex) => (
            <div key={colIndex} className="solColumn" onClick={() => { if (!col.length) tapTableau(colIndex, 0); }}>
              {col.map((card, index) => (
                <CardView
                  key={card.id}
                  card={card}
                  offset={index * (card.faceUp ? 14 : 6)}
                  selected={selection?.source === 'tableau' && selection.col === colIndex && index === selection.index}
                  onClick={(e) => { e.stopPropagation(); tapTableau(colIndex, index); }}
                  cursor={cursor === colIndex + 1 && index === col.length - 1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '2px 6px', display: 'flex', gap: 4, alignItems: 'center' }}>
        <button className="chip" onClick={draw}>Draw</button>
        <button className="chip" onClick={hint}>Hint</button>
        <button className="chip" onClick={() => { if (selection) setSelection(null); }}>Cancel</button>
        <span className="tiny" style={{ marginLeft: 'auto' }}>←/→ column · Enter play · D draw · R new deal</span>
      </div>
      {state.won && (
        <Overlay>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>SOLITAIRE WON</div>
          <div className="tiny">{state.moves} moves · {Math.floor(seconds / 60)}m {seconds % 60}s</div>
          <button className="btn primary" onClick={restart}>New deal</button>
        </Overlay>
      )}
    </GameShell>
  );
}

function CardView({ card, offset = 0, selected, onClick, stacked, cursor }: { card: Card; offset?: number; selected?: boolean; onClick?: (e: React.MouseEvent) => void; stacked?: boolean; cursor?: boolean }) {
  if (!card.faceUp) {
    return (
      <div className="solCard back" style={{ top: offset, position: stacked ? 'absolute' : 'absolute', left: stacked ? 0 : undefined }} aria-label="Face down card" />
    );
  }
  return (
    <div
      className={`solCard face ${isRed(card.suit) ? 'red' : 'black'} ${selected ? 'sel' : ''} ${cursor ? 'cursor' : ''}`}
      style={{ top: offset }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={`${RANK_LABEL[card.rank]} of ${card.suit}`}
    >
      <span className="solRank">{RANK_LABEL[card.rank]}</span>
      <span className="solSuit">{SUIT_GLYPH[card.suit]}</span>
    </div>
  );
}
