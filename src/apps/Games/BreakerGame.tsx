import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, useScores, useGameSfx, useGameKeys } from './gameKit';

const W = 320;
const H = 240;
const PADDLE_W = 52;
const PADDLE_H = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_H = 10;
const TOP = 26;

const COLORS = ['#e4572e', '#f2a33c', '#f6d55c', '#5cc88f', '#4aa3ff', '#b06cf0'];

interface Ball { x: number; y: number; vx: number; vy: number; r: number; stuck?: boolean }
interface Brick { x: number; y: number; w: number; h: number; hp: number; color: string; alive: boolean }
interface Power { x: number; y: number; kind: 'wide' | 'multiball' | 'laser' | 'slow'; }
interface Laser { x: number; y: number }

export default function BreakerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [status, setStatus] = useState('Clear the flock of bricks');
  const { best, submit } = useScores('breaker');
  const sfx = useGameSfx();

  const state = useRef({
    paddleX: W / 2 - PADDLE_W / 2,
    paddleW: PADDLE_W,
    balls: [] as Ball[],
    bricks: [] as Brick[],
    powers: [] as Power[],
    lasers: [] as Laser[],
    laserUntil: 0,
    slowUntil: 0,
    wideUntil: 0,
    score: 0,
    lives: 3,
    level: 1,
    keys: { left: false, right: false },
  });

  const buildLevel = useCallback((lvl: number) => {
    const s = state.current;
    s.bricks = [];
    const cols = BRICK_COLS;
    const bw = (W - 20) / cols;
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c + lvl) % 7 === 0) continue;
        s.bricks.push({
          x: 10 + c * bw,
          y: TOP + r * (BRICK_H + 3),
          w: bw - 2,
          h: BRICK_H,
          hp: r < 1 && lvl > 1 ? 2 : 1,
          color: COLORS[(r + lvl) % COLORS.length],
          alive: true,
        });
      }
    }
    s.balls = [{ x: W / 2, y: H - 40, vx: 0, vy: 0, r: 3.4, stuck: true }];
    s.powers = [];
    s.lasers = [];
    s.paddleW = PADDLE_W;
    s.paddleX = W / 2 - PADDLE_W / 2;
    s.wideUntil = 0;
    s.slowUntil = 0;
    s.laserUntil = 0;
  }, []);

  const reset = useCallback(() => {
    const s = state.current;
    s.score = 0;
    s.lives = 3;
    s.level = 1;
    setScore(0);
    setLives(3);
    setLevel(1);
    setOver(false);
    setWon(false);
    setRunning(false);
    setPaused(false);
    setStatus('Clear the flock of bricks');
    buildLevel(1);
  }, [buildLevel]);

  const launch = useCallback(() => {
    const s = state.current;
    s.balls.forEach((b) => {
      if (b.stuck) {
        b.stuck = false;
        b.vx = (Math.random() > 0.5 ? 1 : -1) * (1.6 + s.level * 0.12);
        b.vy = -(2.4 + s.level * 0.12);
        sfx('shoot');
      }
    });
    setRunning(true);
  }, [sfx]);

  const loseLife = useCallback(() => {
    const s = state.current;
    s.lives -= 1;
    setLives(s.lives);
    sfx('die');
    if (s.lives <= 0) {
      setOver(true);
      setRunning(false);
      submit(s.score);
      setStatus('Game over');
    } else {
      s.balls = [{ x: W / 2, y: H - 40, vx: 0, vy: 0, r: 3.4, stuck: true }];
      s.powers = [];
      setRunning(false);
      setStatus(`${s.lives} lives left — press Enter to serve`);
    }
  }, [sfx, submit]);

  useEffect(() => {
    buildLevel(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------- game loop ------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let mouseTarget: number | null = null;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX === undefined) return;
      const rel = ((clientX - rect.left) / rect.width) * W;
      mouseTarget = rel;
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onMove as any, { passive: true });
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const s = state.current;
      if (s.balls.some((b) => b.stuck)) launch();
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });

    let raf = 0;
    let last = performance.now();

    const loop = (t: number) => {
      const dt = Math.min(32, t - last) / 16.6667;
      last = t;
      const s = state.current;

      // paddle movement
      const wide = t < s.wideUntil;
      s.paddleW = wide ? PADDLE_W * 1.7 : PADDLE_W;
      if (mouseTarget !== null) {
        s.paddleX = Math.max(0, Math.min(W - s.paddleW, mouseTarget - s.paddleW / 2));
      }
      const pSpeed = 4.4 * dt;
      if (s.keys.left) s.paddleX = Math.max(0, s.paddleX - pSpeed);
      if (s.keys.right) s.paddleX = Math.min(W - s.paddleW, s.paddleX + pSpeed);

      if (running && !paused && !over) {
        const slow = t < s.slowUntil ? 0.6 : 1;
        for (const ball of s.balls) {
          if (ball.stuck) {
            ball.x = s.paddleX + s.paddleW / 2;
            ball.y = H - 26;
            continue;
          }
          ball.x += ball.vx * dt * slow;
          ball.y += ball.vy * dt * slow;

          // walls
          if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); sfx('hit'); }
          if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); sfx('hit'); }
          if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); sfx('hit'); }
          if (ball.y - ball.r > H) { ball.y = H + 20; }

          // paddle
          if (ball.vy > 0 && ball.y + ball.r >= H - 14 && ball.y - ball.r <= H - 8
            && ball.x >= s.paddleX - 2 && ball.x <= s.paddleX + s.paddleW + 2) {
            ball.y = H - 14 - ball.r;
            const hitPos = (ball.x - s.paddleX) / s.paddleW;
            const angle = (hitPos - 0.5) * 1.5;
            const speed = Math.min(6.4, Math.hypot(ball.vx, ball.vy) * 1.02);
            ball.vx = Math.sin(angle) * speed;
            ball.vy = -Math.abs(Math.cos(angle) * speed);
            sfx('hit');
          }

          // bricks
          for (const brick of s.bricks) {
            if (!brick.alive) continue;
            if (ball.x + ball.r > brick.x && ball.x - ball.r < brick.x + brick.w
              && ball.y + ball.r > brick.y && ball.y - ball.r < brick.y + brick.h) {
              brick.hp -= 1;
              if (brick.hp <= 0) {
                brick.alive = false;
                s.score += 10;
                setScore(s.score);
                sfx('brick');
                if (Math.random() < 0.14) {
                  const kinds: Power['kind'][] = ['wide', 'multiball', 'laser', 'slow'];
                  s.powers.push({ x: brick.x + brick.w / 2, y: brick.y, kind: kinds[Math.floor(Math.random() * kinds.length)] });
                }
              }
              // bounce
              if (ball.x < brick.x || ball.x > brick.x + brick.w) ball.vx *= -1;
              else ball.vy *= -1;
              break;
            }
          }
        }

        s.balls = s.balls.filter((b) => b.y < H + 30);
        if (!s.balls.length) loseLife();

        // power-ups
        s.powers = s.powers.filter((p) => {
          p.y += 1.5 * dt;
          if (p.y > H) return false;
          if (p.y > H - 22 && p.x > s.paddleX && p.x < s.paddleX + s.paddleW) {
            sfx('bonus');
            if (p.kind === 'wide') s.wideUntil = t + 12000;
            if (p.kind === 'slow') s.slowUntil = t + 9000;
            if (p.kind === 'laser') s.laserUntil = t + 9000;
            if (p.kind === 'multiball') {
              const base = s.balls[0];
              if (base) {
                s.balls.push({ ...base, vx: base.vx + 1.4, vy: base.vy - 0.6 });
                s.balls.push({ ...base, vx: base.vx - 1.4, vy: base.vy - 0.6 });
              }
            }
            return false;
          }
          return true;
        });

        // lasers
        if (t < s.laserUntil && Math.random() < 0.25) {
          s.lasers.push({ x: s.paddleX + 4, y: H - 18 });
          s.lasers.push({ x: s.paddleX + s.paddleW - 4, y: H - 18 });
        }
        s.lasers = s.lasers.filter((l) => {
          l.y -= 5 * dt;
          if (l.y < 0) return false;
          for (const brick of s.bricks) {
            if (brick.alive && l.x > brick.x && l.x < brick.x + brick.w && l.y > brick.y && l.y < brick.y + brick.h) {
              brick.hp -= 1;
              if (brick.hp <= 0) { brick.alive = false; s.score += 10; setScore(s.score); sfx('brick'); }
              return false;
            }
          }
          return true;
        });

        // level cleared?
        if (s.bricks.every((b) => !b.alive)) {
          if (s.level >= 6) {
            setWon(true);
            setRunning(false);
            submit(s.score + 200);
            sfx('win');
          } else {
            s.level += 1;
            setLevel(s.level);
            setStatus(`Level ${s.level}`);
            buildLevel(s.level);
            setRunning(false);
            sfx('win');
          }
        }
      }

      /* ------------------------------- drawing ------------------------------- */
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, '#0b1522');
      gradient.addColorStop(1, '#060a10');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // bricks
      for (const b of s.bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = 'rgba(255,255,255,.32)';
        ctx.fillRect(b.x, b.y, b.w, 2);
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.fillRect(b.x, b.y + b.h - 2, b.w, 2);
        if (b.hp > 1) {
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          ctx.fillRect(b.x + b.w / 2 - 3, b.y + 4, 6, 2);
        }
      }

      // powers
      const POWER_LABEL: Record<Power['kind'], string> = { wide: 'W', multiball: '3', laser: 'L', slow: 'S' };
      for (const p of s.powers) {
        ctx.fillStyle = '#f6b93f';
        ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
        ctx.fillStyle = '#1a1205';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(POWER_LABEL[p.kind], p.x, p.y + 3);
      }

      // lasers
      ctx.fillStyle = '#ff6b6b';
      s.lasers.forEach((l) => ctx.fillRect(l.x - 1, l.y, 2, 6));

      // paddle (owl wings)
      const px = s.paddleX;
      const pgrad = ctx.createLinearGradient(0, H - 16, 0, H - 8);
      pgrad.addColorStop(0, '#f6e7c1');
      pgrad.addColorStop(1, '#a37a3a');
      ctx.fillStyle = pgrad;
      ctx.fillRect(px, H - 16, s.paddleW, 7);
      ctx.fillStyle = '#2b1f10';
      ctx.fillRect(px + 8, H - 14, 4, 3);
      ctx.fillRect(px + s.paddleW - 12, H - 14, 4, 3);

      // balls
      for (const b of s.balls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#f6b93f';
        ctx.fill();
        ctx.strokeStyle = '#fff2cf';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE ${s.score}`, 6, 13);
      ctx.textAlign = 'right';
      ctx.fillText(`LVL ${s.level}`, W - 6, 13);
      ctx.textAlign = 'center';
      ctx.fillText('♥'.repeat(Math.max(0, s.lives)), W / 2, 13);

      if (s.balls.length && s.balls.every((b) => b.stuck) && !over && !won) {
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.font = '8px monospace';
        ctx.fillText('ENTER to serve · move with arrows or drag', W / 2, H - 30);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchmove', onMove as any);
      canvas.removeEventListener('touchstart', onTouchStart);
    };
  }, [running, paused, over, won, buildLevel, loseLife, sfx, submit]);

  useGameKeys((key) => {
    const s = state.current;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') { s.keys.left = true; setTimeout(() => (s.keys.left = false), 220); return true; }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { s.keys.right = true; setTimeout(() => (s.keys.right = false), 220); return true; }
    if (key === 'Enter') {
      if (over || won) reset();
      else if (!running) launch();
      return true;
    }
    if (key === ' ') { launch(); return true; }
    if (key === 'p' || key === 'P') { setPaused((p) => !p); return true; }
    return false;
  }, [running, over, won, launch, reset]);

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Owl Breaker',
      actions: [
        { id: 'pause', label: paused ? 'Resume' : 'Pause', icon: 'pause', run: () => setPaused((p) => !p) },
        { id: 'serve', label: 'Serve ball', icon: 'play', run: launch },
        { id: 'restart', label: 'Restart', icon: 'repeat', run: reset },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'breaker' }) },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
  }, [paused, launch, reset]);

  return (
    <GameShell title="OWL BREAKER" score={score} best={best} status={status} onPause={() => setPaused((p) => !p)} paused={paused} onRestart={reset}>
      <div className="gameCanvasWrap">
        <canvas ref={canvasRef} className="gameCanvas" style={{ width: W, height: H, maxWidth: '100%', maxHeight: '100%' }} aria-label={`Owl Breaker, score ${score}`} />
        {!running && !over && !won && (
          <Overlay onDismiss={launch}>
            <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.16em', fontSize: 13 }}>OWL BREAKER</div>
            <div className="tiny" style={{ maxWidth: 240, lineHeight: 1.5 }}>
              Bounce the feather-ball, clear every brick. Catch power-ups: W wider paddle, 3 multiball,
              L lasers, S slow ball. Move with arrows or drag your finger.
            </div>
            <div className="btnRow" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={launch}>Serve ball</button>
            </div>
          </Overlay>
        )}
        {paused && !over && <Overlay><div style={{ fontSize: 12, fontWeight: 700 }}>Paused</div><button className="btn primary" onClick={() => setPaused(false)}>Resume</button></Overlay>}
        {over && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.1em' }}>GAME OVER</div>
            <div className="tiny">Score {score} · Best {Math.max(best, score)}</div>
            <button className="btn primary" onClick={reset}>Play again</button>
          </Overlay>
        )}
        {won && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>ALL LEVELS CLEARED</div>
            <div className="tiny">Score {score}</div>
            <button className="btn primary" onClick={reset}>Play again</button>
          </Overlay>
        )}
      </div>
      <div style={{ padding: '2px 6px', display: 'flex', gap: 4, alignItems: 'center' }}>
        <span className="tiny">Lives {lives}</span>
        <span className="tiny">Level {level}</span>
        <div style={{ flex: 1 }} />
        <button className="btn" style={{ fontSize: 8.5, padding: '1px 6px' }} onClick={() => { const s = state.current; s.keys.left = true; setTimeout(() => (s.keys.left = false), 240); }}>◀</button>
        <button className="btn" style={{ fontSize: 8.5, padding: '1px 6px' }} onClick={() => { const s = state.current; s.keys.right = true; setTimeout(() => (s.keys.right = false), 240); }}>▶</button>
        <button className="btn" style={{ fontSize: 8.5, padding: '1px 6px' }} onClick={launch}>Serve</button>
      </div>
    </GameShell>
  );
}
