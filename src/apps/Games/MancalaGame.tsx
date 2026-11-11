import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, useScores, useGameSfx, useGameKeys } from './gameKit';

/**
 * Mancala (Bantumi rules): 6 pits per player, sow counter-clockwise, capture
 * opposite pit when the last stone lands in an empty pit on your side, extra
 * turn when the last stone lands in your store.
 */
type Pits = number[]; // 0..5 player (bottom), 6 player store, 7..12 opponent pits, 13 opponent store

const initial = (): Pits => [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];

const isPlayerPit = (i: number) => i >= 0 && i <= 5;
const isOpponentPit = (i: number) => i >= 7 && i <= 12;
const opposite = (i: number) => 12 - i;

export default function MancalaGame() {
  const [pits, setPits] = useState<Pits>(initial);
  const [turn, setTurn] = useState<'me' | 'ai'>('me');
  const [message, setMessage] = useState('Your turn — pick a pit');
  const [lastSown, setLastSown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('hard');
  const [games, setGames] = useState({ wins: 0, losses: 0, draws: 0 });
  const sfx = useGameSfx();
  const { best, submit } = useScores('mancala');

  const finished = pits[0] + pits[1] + pits[2] + pits[3] + pits[4] + pits[5] === 0
    || pits[7] + pits[8] + pits[9] + pits[10] + pits[11] + pits[12] === 0;

  useEffect(() => {
    if (!finished) return;
    const mine = pits[6] + pits.slice(0, 6).reduce((a, b) => a + b, 0);
    const theirs = pits[13] + pits.slice(7, 13).reduce((a, b) => a + b, 0);
    setGames((g) => ({
      wins: g.wins + (mine > theirs ? 1 : 0),
      losses: g.losses + (theirs > mine ? 1 : 0),
      draws: g.draws + (mine === theirs ? 1 : 0),
    }));
    if (mine > theirs) {
      setMessage(`You win ${mine}–${theirs}!`);
      sfx('win');
      submit(mine * 10);
    } else if (theirs > mine) {
      setMessage(`Owl AI wins ${theirs}–${mine}`);
      sfx('die');
    } else {
      setMessage(`Draw ${mine}–${theirs}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const sow = useCallback((start: number, player: 'me' | 'ai'): { extraTurn: boolean; next: Pits } => {
    const board = [...pits];
    let stones = board[start];
    board[start] = 0;
    let i = start;
    while (stones > 0) {
      i = (i + 1) % 14;
      if (player === 'me' && i === 13) continue;
      if (player === 'ai' && i === 6) continue;
      board[i] += 1;
      stones -= 1;
      setLastSown(i);
    }
    // capture
    if (player === 'me' && isPlayerPit(i) && board[i] === 1) {
      const opp = opposite(i);
      if (board[opp] > 0) {
        board[6] += board[opp] + 1;
        board[opp] = 0;
        board[i] = 0;
        sfx('bonus');
      }
    }
    if (player === 'ai' && isOpponentPit(i) && board[i] === 1) {
      const opp = opposite(i);
      if (board[opp] > 0) {
        board[13] += board[opp] + 1;
        board[opp] = 0;
        board[i] = 0;
        sfx('bonus');
      }
    }
    const extraTurn = (player === 'me' && i === 6) || (player === 'ai' && i === 13);
    return { extraTurn, next: board };
  }, [pits, sfx]);

  const animateSow = async (start: number, player: 'me' | 'ai') => {
    setBusy(true);
    const { extraTurn, next } = sow(start, player);
    setPits(next);
    sfx('drop');
    await new Promise((r) => setTimeout(r, 320));
    setBusy(false);
    if (extraTurn) {
      setMessage(player === 'me' ? 'Extra turn!' : 'Owl gets another turn');
      setTurn(player);
      if (player === 'ai') void aiPlay();
      return;
    }
    setTurn(player === 'me' ? 'ai' : 'me');
    if (player === 'me') {
      setMessage("Owl AI is thinking…");
      void aiPlay();
    } else {
      setMessage('Your turn — pick a pit');
    }
  };

  const aiPlay = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 620));
    const board = pits;
    const legal = [7, 8, 9, 10, 11, 12].filter((i) => board[i] > 0);
    if (!legal.length) return;
    let choice = legal[0];
    if (difficulty === 'hard') {
      // prefer moves landing in the store, then captures
      let bestScore = -1;
      for (const pit of legal) {
        let stones = board[pit];
        let i = pit;
        while (stones > 0) {
          i = (i + 1) % 14;
          if (i === 6) continue;
          stones -= 1;
        }
        let value = 0;
        if (i === 13) value = 10;
        else if (isOpponentPit(i) && board[i] === 0 && board[opposite(i)] > 0) value = board[opposite(i)] + 3;
        else value = board[i];
        if (value > bestScore) { bestScore = value; choice = pit; }
      }
    } else {
      choice = legal[Math.floor(Math.random() * legal.length)];
    }
    await animateSow(choice, 'ai');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pits, difficulty, sow]);

  const playerMove = (index: number) => {
    if (busy || turn !== 'me' || finished) return;
    if (!isPlayerPit(index) || pits[index] === 0) {
      if (isPlayerPit(index)) setMessage('That pit is empty');
      return;
    }
    void animateSow(index, 'me');
  };

  useGameKeys((key) => {
    if (finished) {
      if (key === 'Enter' || key === ' ') { setPits(initial()); setTurn('me'); setMessage('Your turn — pick a pit'); }
      return true;
    }
    if (key >= '1' && key <= '6') { playerMove(Number(key) - 1); return true; }
    return false;
  }, [pits, busy, turn, finished]);

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Mancala',
      actions: [
        { id: 'new', label: 'New game', icon: 'repeat', run: () => { setPits(initial()); setTurn('me'); setMessage('Your turn'); } },
        { id: 'easy', label: 'Easy AI', icon: 'settings', run: () => setDifficulty('easy') },
        { id: 'hard', label: 'Hard AI', icon: 'settings', run: () => setDifficulty('hard') },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'mancala' }) },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
  }, []);

  const total = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return (
    <GameShell
      title="MANCALA"
      score={`You ${pits[6]} · Owl ${pits[13]}`}
      status={message}
      onPause={() => setMessage('Paused — Menu to resume')}
      onRestart={() => { setPits(initial()); setTurn('me'); setMessage('Your turn'); }}
    >
      <div className="gameCanvasWrap" style={{ background: 'linear-gradient(160deg,#2a1c10,#120c07)', alignItems: 'center' }}>
        <div style={{ width: 'min(100%, 340px)', padding: 6 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
            <Store label="Owl" value={pits[13]} side="left" />
            <div style={{ flex: 1, display: 'grid', gap: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
                {[12, 11, 10, 9, 8, 7].map((i) => (
                  <PitView key={i} index={i} count={pits[i]} onClick={() => {}} last={lastSown === i} disabled />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <PitView key={i} index={i} count={pits[i]} onClick={() => playerMove(i)} last={lastSown === i} disabled={turn !== 'me' || busy || finished} />
                ))}
              </div>
            </div>
            <Store label="You" value={pits[6]} side="right" />
          </div>
          <div className="tiny" style={{ textAlign: 'center', marginTop: 4, color: '#e8d9c0' }}>
            Keys 1–6 play pits · {difficulty} AI · W {games.wins} / L {games.losses} / D {games.draws}
          </div>
        </div>
        {finished && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{message}</div>
            <div className="tiny">{games.wins} wins · {games.losses} losses · {games.draws} draws · best {best}</div>
            <button className="btn primary" onClick={() => { setPits(initial()); setTurn('me'); setMessage('Your turn'); }}>New game</button>
          </Overlay>
        )}
      </div>
    </GameShell>
  );
}

function PitView({ index, count, onClick, last, disabled }: { index: number; count: number; onClick: () => void; last: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || count === 0}
      aria-label={`Pit ${index < 6 ? index + 1 : 12 - index} with ${count} stones`}
      style={{
        aspectRatio: '1', borderRadius: '50%', border: last ? '2px solid var(--hl)' : '1px solid rgba(230,200,150,.3)',
        background: 'radial-gradient(circle at 45% 35%, #4a3320, #241609)',
        color: '#f2e3c8', display: 'grid', placeItems: 'center', cursor: disabled || count === 0 ? 'default' : 'pointer',
        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)',
        boxShadow: last ? '0 0 10px rgba(246,185,63,.5)' : 'inset 0 2px 6px rgba(0,0,0,.6)',
        opacity: count === 0 ? 0.65 : 1,
        padding: 0,
      }}
    >
      {count}
    </button>
  );
}

function Store({ label, value, side }: { label: string; value: number; side: 'left' | 'right' }) {
  return (
    <div
      style={{
        width: 44, borderRadius: 99, background: 'radial-gradient(circle at 50% 20%, #55371d, #1d1208)',
        border: '1px solid rgba(230,200,150,.35)', display: 'grid', placeItems: 'center', gap: 2, padding: '6px 2px',
        boxShadow: 'inset 0 3px 10px rgba(0,0,0,.6)',
      }}
      aria-label={`${label} store: ${value} stones`}
    >
      <span className="tiny" style={{ color: '#d8bf94', fontSize: 8 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: '#f6b93f' }}>{value}</span>
    </div>
  );
}
