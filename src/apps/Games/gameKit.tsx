import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid } from '../../hooks';
import { DB_KEYS } from '../../os/db';
import type { GameScore } from '../../os/types';
import { gameSfx, type GameSfx } from '../../os/audio';
import { registerAppKeys } from '../../os/kernel';
import { Icon } from '../../components/Icon';

/* ------------------------------ score storage ----------------------------- */

export function useScores(game: string) {
  const [scores, setScores] = useCollection<GameScore>(DB_KEYS.scores);
  const mine = scores.filter((s) => s.game === game).sort((a, b) => b.score - a.score);
  const best = mine[0]?.score || 0;
  const submit = useCallback((score: number, extra?: string) => {
    if (score <= 0) return;
    setScores((prev) => [...prev, { game, score, extra, at: Date.now() }].slice(-300));
  }, [game, setScores]);
  return { best, mine, submit };
}

/* --------------------------------- helpers -------------------------------- */

export function useGameSfx() {
  const volume = useStore((s) => s.settings.volume);
  return useCallback((name: GameSfx) => gameSfx(name, volume), [volume]);
}

/** Keyboard routing for games: returns true when a key was consumed. */
export function useGameKeys(handler: (key: string, code: string) => boolean, deps: unknown[] = []) {
  useEffect(() => {
    const off = registerAppKeys((e) => {
      if (useStore.getState().activeFieldId) return false;
      return handler(e.key, e.code);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function DPad({ onDir, onAction, label }: { onDir: (dir: 'up' | 'down' | 'left' | 'right') => void; onAction?: () => void; label?: string }) {
  return (
    <div className="dpad" aria-label={label || 'Direction pad'}>
      <span />
      <button onClick={() => onDir('up')} aria-label="Up">▲</button>
      <span />
      <button onClick={() => onDir('left')} aria-label="Left">◀</button>
      <button onClick={() => (onAction ? onAction() : onDir('down'))} aria-label={onAction ? 'Action' : 'Down'}>●</button>
      <button onClick={() => onDir('right')} aria-label="Right">▶</button>
      <span />
      <button onClick={() => onDir('down')} aria-label="Down">▼</button>
      <span />
    </div>
  );
}

/* --------------------------------- canvas --------------------------------- */

export function useGameCanvas(width: number, height: number, scale = 2) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctxRef.current = ctx;
    }
  }, [width, height]);
  return { canvasRef, ctx: () => ctxRef.current, scale };
}

export function GameShell({
  title,
  score,
  best,
  status,
  children,
  onPause,
  paused,
  footer,
  onRestart,
}: {
  title: string;
  score?: string | number;
  best?: number;
  status?: string;
  children: React.ReactNode;
  onPause?: () => void;
  paused?: boolean;
  footer?: React.ReactNode;
  onRestart?: () => void;
}) {
  return (
    <div className="gameWrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', fontSize: 9.5 }}>
        <strong style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em', fontSize: 11 }}>{title}</strong>
        {score !== undefined && <span className="mono">Score {score}</span>}
        {best !== undefined && <span className="mono" style={{ color: 'var(--hl)' }}>Best {best}</span>}
        {status && <span className="tiny" style={{ marginLeft: 'auto' }}>{status}</span>}
        <div style={{ marginLeft: status ? 0 : 'auto', display: 'flex', gap: 3 }}>
          {onRestart && <button className="iconBtn" onClick={onRestart} aria-label="Restart" style={{ width: 17, height: 17 }}><Icon name="repeat" size={8} /></button>}
          {onPause && <button className="iconBtn" onClick={onPause} aria-label="Pause" style={{ width: 17, height: 17 }}>{paused ? '▶' : '❚❚'}</button>}
          <button className="iconBtn" onClick={() => useStore.getState().closeApp()} aria-label="Exit game" style={{ width: 17, height: 17 }}>✕</button>
        </div>
      </div>
      {children}
      {footer && <div style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>{footer}</div>}
    </div>
  );
}

export function Overlay({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, background: 'rgba(4,9,7,.78)', display: 'grid', placeItems: 'center',
        textAlign: 'center', color: '#e8f5ee', zIndex: 8, padding: 10,
      }}
      onClick={onDismiss}
    >
      <div style={{ display: 'grid', gap: 5, placeItems: 'center', maxWidth: 280 }}>{children}</div>
    </div>
  );
}

/* ---------------------------------- audio --------------------------------- */

/** Draws the mother owl as pixel art on a canvas grid. */
export function drawOwl(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, cell: number,
  opts: { dir?: 'up' | 'down' | 'left' | 'right'; baby?: boolean; blink?: boolean; body?: string; eye?: string }
) {
  const { dir = 'up', baby = false, blink = false } = opts;
  const body = opts.body || (baby ? '#7a8f6a' : '#e8d9a8');
  const eye = opts.eye || (baby ? '#b6d38f' : '#f6b93f');
  const s = cell;
  const r = (gx: number, gy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + gx * s, y + gy * s, w * s, h * s);
  };
  // shadow
  ctx.globalAlpha = 0.25;
  r(1, baby ? 5 : 7, baby ? 5 : 6, 1, '#000');
  ctx.globalAlpha = 1;

  if (baby) {
    // rounder owlet
    r(1, 2, 5, 3, body);
    r(1, 1, 3, 1, body);
    r(3, 0, 2, 1, body);
    r(1, 5, 1, 1, '#c9a94a');
    r(4, 5, 1, 1, '#c9a94a');
    r(2, 3, 1, 1, blink ? '#2a3324' : eye);
    r(4, 3, 1, 1, blink ? '#2a3324' : eye);
    r(3, 4, 1, 1, '#c9762a');
    return;
  }

  // ear tufts
  r(1, 0, 1, 1, body);
  r(5, 0, 1, 1, body);
  // head/body
  r(1, 1, 5, 1, body);
  r(1, 2, 6, 4, body);
  r(2, 6, 4, 1, body);
  // eyes
  const eyeRowY = 2;
  const lx = dir === 'left' ? 1 : 1;
  const rx = dir === 'right' ? 5 : 4;
  r(lx + 1, eyeRowY + 1, 1, 1, '#11202a');
  r(rx, eyeRowY + 1, 1, 1, '#11202a');
  if (!blink) {
    r(lx + 1, eyeRowY, 1, 1, eye);
    r(rx, eyeRowY, 1, 1, eye);
    r(lx + 1, eyeRowY + 2, 1, 1, eye);
    r(rx, eyeRowY + 2, 1, 1, eye);
  } else {
    r(lx + 1, eyeRowY + 1, 1, 1, '#11202a');
    r(rx, eyeRowY + 1, 1, 1, '#11202a');
  }
  // beak
  r(3, 4, 1, 1, '#f2a33c');
  // wings
  r(0, 4, 1, 2, baby ? body : '#cbb98a');
  r(6, 4, 1, 2, baby ? body : '#cbb98a');
}

/** Little mouse sprite (the food). */
export function drawMouse(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, golden = false, t = 0) {
  const s = cell;
  const body = golden ? '#f6c945' : '#c9c3b8';
  const wiggle = Math.sin(t / 90) > 0 ? 1 : 0;
  ctx.fillStyle = body;
  ctx.fillRect(x + 1 * s, y + 2 * s, 3 * s, 2 * s);
  ctx.fillRect(x + 2 * s, y + 1 * s + wiggle * s * 0.2, 2 * s, 1 * s);
  ctx.fillStyle = golden ? '#fff3b0' : '#8d8a84';
  ctx.fillRect(x + 2 * s, y + 1 * s, 1 * s, 1 * s);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 1 * s, y + 2 * s, 1, 1);
  ctx.fillStyle = golden ? '#a97d0a' : '#7b7770';
  ctx.fillRect(x + 4 * s, y + 3 * s, 1 * s, 1);
}
