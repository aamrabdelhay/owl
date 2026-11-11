import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Icon, type IconName } from '../../components/Icon';
import { useCollection } from '../../hooks';
import { DB_KEYS } from '../../os/db';
import type { GameScore } from '../../os/types';
import { gameSfx } from '../../os/audio';
import { formatDate } from '../../os/i18n';

export interface GameMeta {
  id: string;
  name: string;
  nameAr: string;
  icon: IconName;
  color: string;
  blurb: string;
  keys: string;
}

export const GAMES: GameMeta[] = [
  { id: 'snake', name: 'Owl Snake', nameAr: 'أفعى البومة', icon: 'snake', color: '#4caf50', blurb: 'Mother owl leads a growing line of owlets. 25 maze levels; golden mice double the danger.', keys: 'Arrows / WASD' },
  { id: 'breaker', name: 'Owl Breaker', nameAr: 'كسّار البومة', icon: 'block', color: '#ef7d3f', blurb: 'Feather-ball versus a wall of bricks. 25 progressive levels and four power-ups.', keys: '← → / drag' },
  { id: 'skyowl', name: 'Sky Owl', nameAr: 'بومة السماء', icon: 'skyowl', color: '#4f9dff', blurb: 'Fly through the night and shoot down bats before they reach the nest.', keys: '↑ ↓ / tap' },
  { id: 'pairs', name: 'Pairs', nameAr: 'الأزواج', icon: 'cards', color: '#b06cf0', blurb: 'Flip and match the owl collection. Three board sizes.', keys: 'Arrows + F' },
  { id: 'mancala', name: 'Mancala', nameAr: 'المنقلة', icon: 'mancala', color: '#c9922f', blurb: 'Classic sowing game against an owl AI that hates losing.', keys: '1 – 6' },
  { id: 'sudoku', name: 'Sudoku', nameAr: 'سودوكو', icon: 'sudoku', color: '#4f8dd4', blurb: 'Proper generated puzzles with notes, hints and a timer.', keys: '1–9 + arrows' },
  { id: 'blocks', name: 'Block Stack', nameAr: 'مكعبات', icon: 'tetris', color: '#e0575b', blurb: 'Falling crates with ghost preview. Ten rows to a level.', keys: 'Arrows + Space' },
  { id: 'wordowl', name: 'Word Owl', nameAr: 'كلمة البومة', icon: 'word', color: '#e0b34b', blurb: 'Six guesses, two languages. English and Arabic dictionaries included.', keys: 'Type + Enter' },
  { id: 'solitaire', name: 'Solitaire', nameAr: 'سوليتير', icon: 'solitaire', color: '#3fa36b', blurb: 'Klondike with hints, auto-flip, and a saved game between visits.', keys: 'Arrows + Enter' },
  { id: 'chess', name: 'Chess', nameAr: 'الشطرنج', icon: 'game', color: '#b7a27b', blurb: 'Play legal chess against the OWL computer across 25 difficulty levels.', keys: 'Tap squares / trackpad' },
];

export default function GamesHub({ view, game }: { view?: string; game?: string }) {
  const language = useStore((s) => s.settings.language);
  const volume = useStore((s) => s.settings.volume);
  const openApp = useStore((s) => s.openApp);
  const [tab, setTab] = useState<'all' | 'scores'>(view === 'scores' ? 'scores' : 'all');
  const [focusGame, setFocusGame] = useState<string | null>(game || null);
  const [scores] = useCollection<GameScore>(DB_KEYS.scores);

  useEffect(() => {
    if (view) setTab('scores');
    if (game) setFocusGame(game);
  }, [view, game]);

  const leaderboard = useMemo(() => {
    const list = focusGame ? scores.filter((s) => s.game === focusGame) : scores;
    return [...list].sort((a, b) => b.score - a.score).slice(0, 40);
  }, [scores, focusGame]);

  const bestFor = (id: string) => scores.filter((s) => s.game === id).reduce((max, s) => Math.max(max, s.score), 0);
  const nameFor = (id: string) => GAMES.find((g) => g.id === id)?.name || id;

  const launch = (id: string) => {
    gameSfx('click', volume);
    openApp(id);
  };

  return (
    <AppFrame
      title="Games"
      icon="game"
      actions={
        <>
          <button className="hbtn" onClick={() => setTab(tab === 'all' ? 'scores' : 'all')}>
            {tab === 'all' ? 'Scores' : 'Library'}
          </button>
        </>
      }
    >
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div className="chipRow" style={{ flex: 'none' }}>
          <button className={`chip ${tab === 'all' ? 'on' : ''}`} onClick={() => setTab('all')}>All games</button>
          <button className={`chip ${tab === 'scores' ? 'on' : ''}`} onClick={() => setTab('scores')}>High scores</button>
          <span className="tiny" style={{ marginLeft: 'auto' }}>{GAMES.length} installed</span>
        </div>

        {tab === 'all' ? (
          <div className="gameGrid">
            {GAMES.map((g) => {
              const best = bestFor(g.id);
              return (
                <button
                  key={g.id}
                  className={`gameTile ${focusGame === g.id ? 'focus' : ''}`}
                  onMouseEnter={() => setFocusGame(g.id)}
                  onFocus={() => setFocusGame(g.id)}
                  onClick={() => launch(g.id)}
                  aria-label={`${g.name}: ${g.blurb}`}
                >
                  <span className="gameTileIcon" style={{ background: `linear-gradient(160deg, ${g.color}, rgba(0,0,0,.55))` }}>
                    <Icon name={g.icon} size={18} />
                  </span>
                  <span className="gameTileBody">
                    <strong>{language === 'ar' ? g.nameAr : g.name}</strong>
                    <span className="tiny" style={{ lineHeight: 1.35, display: 'block' }}>{g.blurb}</span>
                    <span className="tiny gameTileMeta">
                      <span>{g.keys}</span>
                      {best > 0 && <span style={{ color: 'var(--hl)' }}>best {best}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, overflow: 'auto' }}>
            <div className="chipRow">
              <button className={`chip ${!focusGame ? 'on' : ''}`} onClick={() => setFocusGame(null)}>All</button>
              {GAMES.map((g) => (
                <button key={g.id} className={`chip ${focusGame === g.id ? 'on' : ''}`} onClick={() => setFocusGame(g.id)}>
                  {language === 'ar' ? g.nameAr : g.name}
                </button>
              ))}
            </div>
            {leaderboard.length === 0 ? (
              <div className="empty">
                <Icon name="star" size={22} />
                <div><strong>No scores yet</strong></div>
                <div className="tiny">Play a game and your best runs appear here, stored only on this device.</div>
                <button className="btn" onClick={() => setTab('all')}>Browse games</button>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {leaderboard.map((entry, index) => (
                  <div key={`${entry.game}-${entry.at}-${index}`} className="kv" style={{ borderBottom: '1px solid var(--line)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <b className="mono" style={{ width: 16, color: index < 3 ? 'var(--hl)' : undefined }}>{index + 1}</b>
                      <span style={{ fontSize: 9.5 }}>{nameFor(entry.game)}</span>
                      {entry.extra && <span className="tiny">· {entry.extra}</span>}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="tiny">{formatDate(language, new Date(entry.at), { month: 'short', day: 'numeric' })}</span>
                      <b className="mono" style={{ color: 'var(--hl)' }}>{entry.score}</b>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              className="btn"
              onClick={() => {
                useStore.getState().showDialog({
                  title: 'Clear high scores?',
                  body: 'This removes every saved score on this device. Game saves stay intact.',
                  confirmLabel: 'Clear',
                  danger: true,
                  onConfirm: () => {
                    useStore.getState().closeDialog();
                    useStore.getState().toast('Scores cleared');
                    import('../../os/db').then(({ collectionSet }) => collectionSet(DB_KEYS.scores, []));
                  },
                });
              }}
            >
              <Icon name="trash" size={10} /> Clear scores
            </button>
          </div>
        )}
      </div>
    </AppFrame>
  );
}
