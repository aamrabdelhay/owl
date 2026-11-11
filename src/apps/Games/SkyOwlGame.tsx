import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, useScores, useGameSfx, useGameKeys } from './gameKit';

const W = 320;
const H = 220;

interface Enemy { x: number; y: number; hp: number; kind: 'bat' | 'drone' | 'boss'; vx: number; vy: number; t: number; fireAt: number }
interface Shot { x: number; y: number; vx: number; vy: number; from: 'me' | 'them' }
interface Pickup { x: number; y: number; kind: 'rapid' | 'shield' | 'heal'; vx: number }

export default function SkyOwlGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(5);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState('Defend the night sky');
  const { best, submit } = useScores('skyowl');
  const sfx = useGameSfx();

  const state = useRef({
    owl: { x: 40, y: H / 2, vy: 0, hp: 5, shieldUntil: 0, rapidUntil: 0, invUntil: 0 },
    enemies: [] as Enemy[],
    shots: [] as Shot[],
    pickups: [] as Pickup[],
    score: 0,
    level: 1,
    spawnTimer: 0,
    time: 0,
    bossAlive: false,
    keys: { up: false, down: false },
    stars: Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.2 + Math.random() * 0.8 })),
  });

  const reset = useCallback(() => {
    const s = state.current;
    s.owl = { x: 40, y: H / 2, vy: 0, hp: 5, shieldUntil: 0, rapidUntil: 0, invUntil: 0 };
    s.enemies = [];
    s.shots = [];
    s.pickups = [];
    s.score = 0;
    s.level = 1;
    s.spawnTimer = 0;
    s.bossAlive = false;
    setScore(0);
    setHp(5);
    setLevel(1);
    setOver(false);
    setRunning(false);
    setPaused(false);
    setStatus('Defend the night sky');
  }, []);

  useEffect(() => { reset(); }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let shooting = false;

    const onDown = () => { shooting = true; };
    const onUp = () => { shooting = false; };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);

    const loop = (t: number) => {
      const dt = Math.min(34, t - last) / 16.6667;
      last = t;
      const s = state.current;
      s.time = t;

      if (running && !paused && !over) {
        // player movement
        const speed = 3.1 * dt;
        if (s.keys.up) s.owl.y -= speed;
        if (s.keys.down) s.owl.y += speed;
        s.owl.y = Math.max(14, Math.min(H - 16, s.owl.y));

        // shooting
        const rapid = t < s.owl.rapidUntil;
        if ((shooting || s.keys.up || s.keys.down) && (t % (rapid ? 110 : 230)) < 18) {
          s.shots.push({ x: s.owl.x + 14, y: s.owl.y, vx: 6.2, vy: 0, from: 'me' });
          sfx('shoot');
        }

        // spawn enemies
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          const lvl = s.level;
          const kinds: Enemy['kind'][] = lvl >= 3 ? ['bat', 'drone'] : ['bat'];
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          if (lvl % 3 === 0 && !s.bossAlive && s.enemies.length < 3) {
            s.enemies.push({ x: W + 40, y: H / 2, hp: 18 + lvl * 4, kind: 'boss', vx: -0.5, vy: 0, t: 0, fireAt: 900 });
            s.bossAlive = true;
            setStatus(`Boss inbound — level ${lvl}`);
          } else {
            s.enemies.push({
              x: W + 20, y: 20 + Math.random() * (H - 40),
              hp: kind === 'drone' ? 2 : 1, kind, vx: -(1.0 + lvl * 0.12), vy: 0, t: 0, fireAt: 900 + Math.random() * 900,
            });
          }
          s.spawnTimer = Math.max(32, 85 - lvl * 6);
        }

        // update enemies
        for (const e of s.enemies) {
          e.t += dt;
          e.x += e.vx * dt;
          if (e.kind === 'bat') e.y += Math.sin(e.t / 22) * 1.4 * dt;
          if (e.kind === 'boss') e.y = H / 2 + Math.sin(e.t / 40) * 60;
          if (e.kind === 'drone') e.y += Math.sin(e.t / 12) * 0.7 * dt;
          e.y = Math.max(12, Math.min(H - 12, e.y));
          if (e.kind !== 'bat' && e.t * 16 > e.fireAt) {
            e.fireAt = e.t * 16 + 1400;
            s.shots.push({ x: e.x - 6, y: e.y, vx: -2.4, vy: 0, from: 'them' });
          }
        }

        // shots
        s.shots = s.shots.filter((sh) => {
          sh.x += sh.vx * dt;
          sh.y += sh.vy * dt;
          if (sh.x < -10 || sh.x > W + 10) return false;
          if (sh.from === 'me') {
            for (const e of s.enemies) {
              if (Math.abs(sh.x - e.x) < (e.kind === 'boss' ? 20 : 10) && Math.abs(sh.y - e.y) < 9) {
                e.hp -= 1;
                sfx('hit');
                if (e.hp <= 0) {
                  e.hp = 0;
                  const points = e.kind === 'boss' ? 150 : e.kind === 'drone' ? 20 : 10;
                  s.score += points;
                  setScore(s.score);
                  sfx('bonus');
                  if (Math.random() < 0.16) {
                    const kinds: Pickup['kind'][] = ['rapid', 'shield', 'heal'];
                    s.pickups.push({ x: e.x, y: e.y, kind: kinds[Math.floor(Math.random() * 3)], vx: -1.2 });
                  }
                  if (e.kind === 'boss') {
                    s.bossAlive = false;
                    s.level += 1;
                    setLevel(s.level);
                    setStatus(`Level ${s.level}`);
                    sfx('win');
                  }
                }
                return false;
              }
            }
          } else {
            if (Math.abs(sh.x - s.owl.x) < 12 && Math.abs(sh.y - s.owl.y) < 9) {
              if (t < s.owl.invUntil) return false;
              s.owl.hp -= 1;
              s.owl.invUntil = t + 1200;
              setHp(Math.max(0, s.owl.hp));
              sfx('die');
              if (s.owl.hp <= 0) {
                setOver(true);
                setRunning(false);
                submit(s.score);
                setStatus('The bats got through');
              }
              return false;
            }
          }
          return true;
        });

        // enemy collisions with the owl
        for (const e of s.enemies) {
          if (e.x < 60 && Math.abs(e.y - s.owl.y) < 14 && t > s.owl.invUntil) {
            s.owl.hp -= 1;
            s.owl.invUntil = t + 1200;
            setHp(Math.max(0, s.owl.hp));
            sfx('die');
            e.hp = 0;
            if (s.owl.hp <= 0) { setOver(true); setRunning(false); submit(s.score); }
          }
        }
        s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -30);

        // pickups
        s.pickups = s.pickups.filter((p) => {
          p.x += p.vx * dt;
          if (Math.abs(p.x - s.owl.x) < 14 && Math.abs(p.y - s.owl.y) < 12) {
            if (p.kind === 'rapid') s.owl.rapidUntil = t + 8000;
            if (p.kind === 'shield') s.owl.invUntil = t + 5000;
            if (p.kind === 'heal') { s.owl.hp = Math.min(7, s.owl.hp + 1); setHp(s.owl.hp); }
            sfx('bonus');
            return false;
          }
          return p.x > -10;
        });

        // level up by score milestones even if no boss was reached
        const newLevel = Math.max(s.level, Math.min(9, 1 + Math.floor(s.score / 180)));
        if (newLevel !== s.level) {
          s.level = newLevel;
          setLevel(newLevel);
          setStatus(`Level ${newLevel}`);
        }
      }

      /* ------------------------------- drawing ------------------------------- */
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#071425');
      sky.addColorStop(0.6, '#0d2136');
      sky.addColorStop(1, '#152a1e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // parallax stars
      s.stars.forEach((star) => {
        star.x -= star.s * 0.5 * dt;
        if (star.x < 0) { star.x = W; star.y = Math.random() * H; }
        ctx.fillStyle = `rgba(220,240,255,${0.25 + star.s * 0.5})`;
        ctx.fillRect(star.x, star.y, 1, 1);
      });

      // moon
      ctx.beginPath();
      ctx.arc(W - 34, 30, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,240,200,.9)';
      ctx.fill();
      ctx.fillStyle = 'rgba(210,220,240,.35)';
      ctx.fillRect(W - 40, 26, 4, 3);
      ctx.fillRect(W - 31, 34, 3, 3);

      // ground silhouette
      ctx.fillStyle = '#0a1a12';
      ctx.beginPath();
      ctx.moveTo(0, H - 12);
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H - 12 - Math.sin(x / 30) * 4);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();

      // pickups
      s.pickups.forEach((p) => {
        const colors = { rapid: '#f6b93f', shield: '#4aa3ff', heal: '#5cc88f' };
        ctx.fillStyle = colors[p.kind];
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
        ctx.fillStyle = '#06121c';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.kind === 'rapid' ? 'R' : p.kind === 'shield' ? 'S' : '+', p.x, p.y + 2);
      });

      // enemies
      s.enemies.forEach((e) => {
        if (e.kind === 'boss') {
          ctx.fillStyle = '#6a3f7a';
          ctx.beginPath();
          ctx.ellipse(e.x, e.y, 20, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ff6b8a';
          ctx.fillRect(e.x - 10, e.y - 4, 5, 4);
          ctx.fillRect(e.x + 5, e.y - 4, 5, 4);
          ctx.fillStyle = '#f6b93f';
          ctx.fillRect(e.x - 22, e.y - 10, 6, 6);
          ctx.fillRect(e.x + 16, e.y - 10, 6, 6);
        } else if (e.kind === 'bat') {
          ctx.fillStyle = '#7b4bb0';
          const flap = Math.sin(e.t / 3) * 4;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x - 10, e.y - 6 - flap);
          ctx.lineTo(e.x - 4, e.y);
          ctx.lineTo(e.x - 10, e.y + 6 + flap);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + 10, e.y - 6 - flap);
          ctx.lineTo(e.x + 4, e.y);
          ctx.lineTo(e.x + 10, e.y + 6 + flap);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffd7a0';
          ctx.fillRect(e.x - 2, e.y - 1, 1.5, 1.5);
          ctx.fillRect(e.x + 1, e.y - 1, 1.5, 1.5);
        } else {
          ctx.fillStyle = '#4f6b7d';
          ctx.fillRect(e.x - 8, e.y - 5, 16, 10);
          ctx.fillStyle = '#ff5e5e';
          ctx.fillRect(e.x - 9, e.y - 1, 3, 3);
        }
      });

      // shots
      s.shots.forEach((sh) => {
        if (sh.from === 'me') {
          ctx.fillStyle = '#f6e2b0';
          ctx.fillRect(sh.x, sh.y - 1, 6, 2);
        } else {
          ctx.fillStyle = '#ff6b6b';
          ctx.fillRect(sh.x, sh.y - 2, 5, 4);
        }
      });

      // owl
      const owl = s.owl;
      const inv = t < owl.invUntil;
      if (!inv || Math.floor(t / 90) % 2 === 0) {
        ctx.save();
        ctx.translate(owl.x, owl.y);
        // wings
        const wing = Math.sin(t / 90) * 5;
        ctx.fillStyle = '#d9c79a';
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-12, -8 - wing);
        ctx.lineTo(-2, 6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-12, 8 + wing);
        ctx.lineTo(-2, -6);
        ctx.closePath();
        ctx.fill();
        // body
        ctx.fillStyle = '#e8d9a8';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        // ear tufts
        ctx.fillStyle = '#cbb98a';
        ctx.fillRect(-4, -12, 3, 4);
        ctx.fillRect(3, -12, 3, 4);
        // eyes
        ctx.fillStyle = '#f6b93f';
        ctx.beginPath(); ctx.arc(2, -2, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, -2, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#101820';
        ctx.fillRect(3, -3, 2, 2); ctx.fillRect(8, -3, 2, 2);
        // beak
        ctx.fillStyle = '#e07b2a';
        ctx.beginPath(); ctx.moveTo(7, 3); ctx.lineTo(10, 3); ctx.lineTo(8.5, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (inv) {
          ctx.strokeStyle = 'rgba(74,163,255,.7)';
          ctx.beginPath();
          ctx.arc(owl.x, owl.y, 18, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (t < owl.rapidUntil) {
          ctx.fillStyle = 'rgba(246,185,63,.8)';
          ctx.fillRect(4, 4, 34 * ((owl.rapidUntil - t) / 8000), 3);
        }
      }

      // HUD health
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE ${s.score}`, 5, 11);
      ctx.textAlign = 'right';
      for (let i = 0; i < Math.max(0, owl.hp); i++) {
        ctx.fillStyle = '#5cc88f';
        ctx.fillRect(W - 8 - i * 7, 5, 5, 5);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [running, paused, over, sfx, submit]);

  const launch = () => { setRunning(true); setPaused(false); };

  useGameKeys((key) => {
    const s = state.current;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') { s.keys.up = true; setTimeout(() => (s.keys.up = false), 180); return true; }
    if (key === 'ArrowDown' || key === 's' || key === 'S') { s.keys.down = true; setTimeout(() => (s.keys.down = false), 180); return true; }
    if (key === 'Enter' || key === ' ') { if (over) reset(); else launch(); return true; }
    if (key === 'p' || key === 'P') { setPaused((p) => !p); return true; }
    return false;
  }, [over, reset]);

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Sky Owl',
      actions: [
        { id: 'pause', label: paused ? 'Resume' : 'Pause', icon: 'pause', run: () => setPaused((p) => !p) },
        { id: 'restart', label: 'Restart', icon: 'repeat', run: reset },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'skyowl' }) },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
  }, [paused, reset]);

  return (
    <GameShell title="SKY OWL" score={score} best={best} status={status} onPause={() => setPaused((p) => !p)} paused={paused} onRestart={reset}>
      <div className="gameCanvasWrap">
        <canvas ref={canvasRef} className="gameCanvas" style={{ width: W, height: H, maxWidth: '100%', maxHeight: '100%' }} aria-label={`Sky Owl, score ${score}`} />
        {!running && !over && (
          <Overlay onDismiss={launch}>
            <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.16em', fontSize: 13 }}>SKY OWL</div>
            <div className="tiny" style={{ maxWidth: 250, lineHeight: 1.5 }}>
              Fly with ↑/↓ (or tap), shoot feathers automatically. Bats are fragile, drones shoot back,
              and a boss arrives every third level. Grab R (rapid), S (shield), + (heal).
            </div>
            <button className="btn primary" onClick={launch}>Take off</button>
          </Overlay>
        )}
        {paused && !over && <Overlay><div style={{ fontSize: 12, fontWeight: 700 }}>Paused</div><button className="btn primary" onClick={() => setPaused(false)}>Resume</button></Overlay>}
        {over && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>DOWNED</div>
            <div className="tiny">Score {score} · Level {level} · Best {Math.max(best, score)}</div>
            <button className="btn primary" onClick={reset}>Fly again</button>
          </Overlay>
        )}
      </div>
      <div style={{ padding: '2px 6px', display: 'flex', gap: 4, alignItems: 'center' }}>
        <span className="tiny">Level {level}</span>
        <span className="tiny">Health</span>
        <div className="progress" style={{ width: 60 }}><i style={{ width: `${(hp / 7) * 100}%`, background: 'var(--green)' }} /></div>
        <div style={{ flex: 1 }} />
        <button className="btn" style={{ fontSize: 8.5, padding: '1px 6px' }} onClick={() => { state.current.keys.up = true; setTimeout(() => (state.current.keys.up = false), 500); }}>▲</button>
        <button className="btn" style={{ fontSize: 8.5, padding: '1px 6px' }} onClick={() => { state.current.keys.down = true; setTimeout(() => (state.current.keys.down = false), 500); }}>▼</button>
      </div>
    </GameShell>
  );
}
