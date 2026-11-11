import React, { useEffect, useState } from 'react';
import { useStore, defaultSettings, profileLabel } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { dbEstimate, dbClear } from '../../os/db';
import { hashPassword, randomSalt, verifyPassword } from '../../os/security';
import { WALLPAPERS } from '../../assets/wallpapers';
import { useWallpaperUrl, saveCustomWallpaper, cropToWallpaper } from '../../hooks/useWallpaper';
import { RINGTONES, playRingtone, successChime } from '../../os/audio';
import { formatBytes } from '../../hooks';
import { APPS, appName } from '../../os/appRegistry';
import type { Lang, ThemeId } from '../../os/types';
import { SHORTCUT_LEGEND } from '../../os/keys';

type Section =
  | 'root' | 'display' | 'sound' | 'wallpaper' | 'themes' | 'home' | 'security' | 'datetime'
  | 'language' | 'battery' | 'storage' | 'accessibility' | 'reset' | 'about' | 'help' | 'keyboard' | 'ai';

export default function SettingsApp({ section }: { section?: string }) {
  const [stack, setStack] = useState<Section[]>([(section as Section) || 'root']);
  const current = stack[stack.length - 1];
  const push = (s: Section) => setStack((prev) => [...prev, s]);
  const back = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const settings = useStore((s) => s.settings);

  const title = current === 'root' ? 'Settings' : LABELS[current as Section] || 'Settings';

  return (
    <AppFrame
      title={title}
      icon="settings"
      actions={stack.length > 1 ? <button className="hbtn" onClick={back}>Back</button> : undefined}
    >
      <div className="appBody">
        {current === 'root' && <Root onOpen={push} />}
        {current === 'display' && <Display />}
        {current === 'sound' && <Sound />}
        {current === 'wallpaper' && <Wallpaper />}
        {current === 'themes' && <ThemeSection />}
        {current === 'home' && <HomeSection />}
        {current === 'keyboard' && <KeyboardSettings />}
        {current === 'ai' && <AISettings />}
        {current === 'security' && <Security />}
        {current === 'datetime' && <DateTime />}
        {current === 'language' && <Language />}
        {current === 'battery' && <Battery />}
        {current === 'storage' && <Storage />}
        {current === 'accessibility' && <Accessibility />}
        {current === 'reset' && <Reset onDone={() => setStack(['root'])} />}
        {current === 'about' && <About />}
        {current === 'help' && <Help />}
      </div>
    </AppFrame>
  );
}

const LABELS: Record<string, string> = {
  display: 'Display', sound: 'Sound', wallpaper: 'Wallpaper', themes: 'Themes', home: 'Home screen',
  security: 'Security', datetime: 'Date & Time', language: 'Language', battery: 'Battery',
  storage: 'Storage', accessibility: 'Accessibility', reset: 'Reset OS', about: 'About', help: 'Quick help',
  keyboard: 'Keyboard mode', ai: 'AI & online services',
};

function Root({ onOpen }: { onOpen: (s: Section) => void }) {
  const s = useStore((state) => state.settings);
  const rows: { id: Section; label: string; meta: string; icon: string }[] = [
    { id: 'keyboard', label: 'Keyboard mode', meta: s.keyboardMode === 'simple' ? 'Classic 12-key' : 'BlackBerry QWERTY', icon: 'key' },
    { id: 'ai', label: 'AI & online services', meta: s.geminiApiKey ? 'Gemini configured' : 'Set up Gemini / YouTube', icon: 'wand' },
    { id: 'display', label: 'Display', meta: `Brightness ${Math.round(s.brightness * 100)}%`, icon: 'sun' },
    { id: 'sound', label: 'Sound', meta: `${profileLabel(s.profile, s.language)}`, icon: 'volume' },
    { id: 'wallpaper', label: 'Wallpaper', meta: s.wallpaperId.startsWith('custom:') ? 'Custom image' : 'Built-in', icon: 'image' },
    { id: 'themes', label: 'Themes', meta: s.theme, icon: 'palette' },
    { id: 'home', label: 'Home screen', meta: `${s.dockRows} row${s.dockRows === 'one' ? '' : 's'}`, icon: 'grid' },
    { id: 'security', label: 'Security', meta: s.passwordHash ? 'Password set' : 'No password', icon: 'lock' },
    { id: 'datetime', label: 'Date & Time', meta: s.clock24 ? '24-hour' : '12-hour', icon: 'clock' },
    { id: 'language', label: 'Language', meta: s.language === 'ar' ? 'العربية' : 'English', icon: 'globe' },
    { id: 'battery', label: 'Battery', meta: s.powerSaver ? 'Power saver on' : 'Normal', icon: 'battery' },
    { id: 'storage', label: 'Storage', meta: 'IndexedDB usage', icon: 'folder' },
    { id: 'accessibility', label: 'Accessibility', meta: s.highContrast ? 'High contrast' : 'Standard', icon: 'eye' },
    { id: 'help', label: 'Quick help', meta: 'Keyboard map', icon: 'help' },
    { id: 'reset', label: 'Reset OS', meta: 'Wipes local data', icon: 'trash' },
    { id: 'about', label: 'About', meta: 'OWL OS 1.0', icon: 'info' },
  ];
  return (
    <div>
      <div style={{ padding: 8, display: 'flex', gap: 7, alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(150deg,var(--panel-3),var(--panel))', display: 'grid', placeItems: 'center', border: '1px solid var(--line)' }}>
          <Icon name="contacts" size={17} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{s.userName || 'OWL owner'}</div>
          <div className="tiny">OS 1.0 · all data stays on this device</div>
        </div>
      </div>
      {rows.map((r) => (
        <button key={r.id} className="rowBtn" onClick={() => onOpen(r.id)}>
          <Icon name={r.icon} size={12} />
          <span>{r.label}</span>
          <span className="meta">{r.meta}</span>
          <Icon name="arrowRight" size={8} style={{ opacity: 0.5 }} />
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Display -------------------------------- */

function Display() {
  const s = useStore((st) => st.settings);
  const set = useStore((st) => st.setSetting);
  return (
    <div style={{ padding: 8, display: 'grid', gap: 7 }}>
      <Slider label="Brightness" value={s.brightness} min={0.3} max={1} onChange={(v) => set('brightness', v)} format={(v) => `${Math.round(v * 100)}%`} />
      <div>
        <div className="fieldLabel">Backlight timeout</div>
        <div className="btnRow">
          {[15, 30, 60, 120, 0].map((v) => (
            <button key={v} className={`chip ${s.backlight === v ? 'on' : ''}`} onClick={() => set('backlight', v)}>{v === 0 ? 'Never' : `${v}s`}</button>
          ))}
        </div>
      </div>
      <Slider label="Font size" value={s.fontScale} min={0.85} max={1.35} onChange={(v) => set('fontScale', v)} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="UI scale" value={s.uiScale} min={0.85} max={1.15} onChange={(v) => set('uiScale', v)} format={(v) => `${Math.round(v * 100)}%`} />
      <div className="btnRow">
        <button className={`chip ${s.largeText ? 'on' : ''}`} onClick={() => set('largeText', !s.largeText)}>Large text</button>
        <button className={`chip ${s.highContrast ? 'on' : ''}`} onClick={() => set('highContrast', !s.highContrast)}>High contrast</button>
        <button className={`chip ${s.powerSaver ? 'on' : ''}`} onClick={() => set('powerSaver', !s.powerSaver)}>Power saver</button>
      </div>
      <div className="tiny">Screen: 480 × 360 logical pixels (4:3), scaled to fit the device.</div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange, format }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="fieldLabel">{label}</span>
        <span className="tiny">{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={0.01} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--hl)' }}
        inputMode="none"
        aria-label={label}
      />
    </div>
  );
}

/* --------------------------------- Sound --------------------------------- */

function Sound() {
  const s = useStore((st) => st.settings);
  const set = useStore((st) => st.setSetting);
  return (
    <div style={{ padding: 8, display: 'grid', gap: 7 }}>
      <div>
        <div className="fieldLabel">Profile</div>
        <div className="btnRow">
          {(['normal', 'loud', 'vibrate', 'silent', 'meeting'] as const).map((p) => (
            <button key={p} className={`chip ${s.profile === p ? 'on' : ''}`} onClick={() => set('profile', p)}>{profileLabel(p, s.language)}</button>
          ))}
        </div>
      </div>
      <Slider label="Volume" value={s.volume} min={0} max={1} onChange={(v) => set('volume', v)} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Ring volume" value={s.ringVolume} min={0} max={1} onChange={(v) => set('ringVolume', v)} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Alarm volume" value={s.alarmVolume} min={0} max={1} onChange={(v) => set('alarmVolume', v)} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Key click volume" value={s.keyClickVolume} min={0} max={1} onChange={(v) => set('keyClickVolume', v)} format={(v) => `${Math.round(v * 100)}%`} />
      <div>
        <div className="fieldLabel">Ringtone</div>
        <select
          value={s.ringtone}
          onChange={(e) => set('ringtone', e.target.value)}
          style={selectStyle}
        >
          {RINGTONES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="btn" style={{ marginTop: 3, fontSize: 9 }} onClick={() => playRingtone(s.ringtone, s.ringVolume, 2)}>Preview</button>
      </div>
      <div>
        <div className="fieldLabel">Message tone</div>
        <select value={s.messageTone} onChange={(e) => set('messageTone', e.target.value)} style={selectStyle}>
          {RINGTONES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div>
        <div className="fieldLabel">Alarm tone</div>
        <select value={s.alarmTone} onChange={(e) => set('alarmTone', e.target.value)} style={selectStyle}>
          {RINGTONES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div className="btnRow">
        <button className={`chip ${s.keyClick ? 'on' : ''}`} onClick={() => set('keyClick', !s.keyClick)}>Key clicks</button>
        <button className={`chip ${s.vibrate ? 'on' : ''}`} onClick={() => set('vibrate', !s.vibrate)}>Vibration</button>
        <button className={`chip ${s.vibrateKeys ? 'on' : ''}`} onClick={() => set('vibrateKeys', !s.vibrateKeys)}>Vibrate on key</button>
      </div>
      <div className="tiny">All tones are synthesised live with the Web Audio API. No samples or copyrighted audio.</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)',
  borderRadius: 4, padding: '3px 5px', fontSize: 10,
};

/* -------------------------------- Wallpaper ------------------------------- */

function Wallpaper() {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const bump = useStore((st) => st.bumpWallpaper);
  const toast = useStore((st) => st.toast);
  const [target, setTarget] = useState<'home' | 'lock'>('home');
  const [crop, setCrop] = useState<{ src: string; zoom: number; x: number; y: number } | null>(null);
  const toastRef = toast;
  const activeId = target === 'home' ? s.wallpaperId : s.lockWallpaperId;

  const upload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setCrop({ src: String(reader.result), zoom: 1, x: 0, y: 0 });
      reader.readAsDataURL(file);
    };
    input.click();
  };

  if (crop) {
    return (
      <div style={{ padding: 8, display: 'grid', gap: 6 }}>
        <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--hl)', background: '#000' }}>
          <img src={crop.src} alt="crop" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${crop.zoom}) translate(${crop.x}%, ${crop.y}%)` }} />
        </div>
        <Slider label="Zoom" value={crop.zoom} min={1} max={3} onChange={(v) => setCrop({ ...crop, zoom: v })} format={(v) => `${v.toFixed(2)}×`} />
        <Slider label="Horizontal" value={crop.x} min={-50} max={50} onChange={(v) => setCrop({ ...crop, x: v })} />
        <Slider label="Vertical" value={crop.y} min={-50} max={50} onChange={(v) => setCrop({ ...crop, y: v })} />
        <div className="btnRow" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setCrop(null)}>Cancel</button>
          <button
            className="btn primary"
            onClick={async () => {
              const data = await cropToWallpaper(crop.src, 960, 720, crop.zoom, crop.x, crop.y);
              const id = await saveCustomWallpaper(data);
              if (target === 'lock') update({ lockWallpaperId: id, useSeparateLockWallpaper: true });
              else update({ wallpaperId: id });
              bump();
              setCrop(null);
              toastRef('Wallpaper saved');
            }}
          >Crop & set</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 8, display: 'grid', gap: 6 }}>
      <div className="btnRow">
        <button className={`chip ${!s.useSeparateLockWallpaper ? 'on' : ''}`} onClick={() => { update({ useSeparateLockWallpaper: false }); setTarget('home'); }}>Same for both</button>
        <button className={`chip ${s.useSeparateLockWallpaper ? 'on' : ''}`} onClick={() => update({ useSeparateLockWallpaper: true })}>Separate lock wallpaper</button>
      </div>
      {s.useSeparateLockWallpaper && (
        <div className="btnRow">
          <button className={`chip ${target === 'home' ? 'on' : ''}`} onClick={() => setTarget('home')}>Home</button>
          <button className={`chip ${target === 'lock' ? 'on' : ''}`} onClick={() => setTarget('lock')}>Lock screen</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {WALLPAPERS.map((w) => (
          <button
            key={w.id}
            onClick={() => {
              if (target === 'lock') update({ lockWallpaperId: w.id, useSeparateLockWallpaper: true });
              else update({ wallpaperId: w.id });
              bump();
              toastRef(`${w.name} set`);
            }}
            aria-label={w.name}
            style={{
              padding: 0, height: 40, borderRadius: 5, cursor: 'pointer',
              border: activeId === w.id ? '2px solid var(--hl)' : '1px solid var(--line)',
              backgroundImage: w.css, backgroundSize: 'cover',
            }}
          />
        ))}
      </div>
      <div className="btnRow">
        <button className="btn primary" onClick={upload}>Upload & crop image</button>
      </div>
      <WallpaperPreview id={activeId} />
      <div className="tiny">Wallpapers are generated SVG or your own images, stored in IndexedDB. Nothing is uploaded.</div>
    </div>
  );
}

function WallpaperPreview({ id }: { id: string }) {
  const url = useWallpaperUrl(id);
  return (
    <div style={{ aspectRatio: '4 / 3', borderRadius: 6, border: '1px solid var(--line)', backgroundImage: url, backgroundSize: 'cover', backgroundPosition: 'center', display: 'grid', placeItems: 'center' }}>
      <span style={{ fontSize: 9, color: '#fff', textShadow: '0 1px 4px #000', background: 'rgba(0,0,0,.35)', padding: '1px 6px', borderRadius: 99 }}>
        Preview · 4:3
      </span>
    </div>
  );
}

/* --------------------------------- Themes -------------------------------- */

function ThemeSection() {
  const current = useStore((s) => s.settings.theme);
  const set = useStore((s) => s.setSetting);
  const toast = useStore((s) => s.toast);
  const themes: ThemeId[] = ['owl-night', 'classic-silver', 'forest', 'ruby', 'ocean', 'lcd'];
  return (
    <div style={{ padding: 8, display: 'grid', gap: 4 }}>
      {themes.map((t) => (
        <button key={t} className="rowBtn" onClick={() => { set('theme', t); toast(`${t} applied`); }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: `linear-gradient(140deg,var(--panel-2),var(--hl))`, border: '1px solid var(--line)' }} />
          <span style={{ textTransform: 'capitalize' }}>{t.replace('-', ' ')}</span>
          {current === t && <span className="pill amber meta">active</span>}
        </button>
      ))}
      <button className="btn" onClick={() => useStore.getState().openApp('themes')}>Open full theme gallery</button>
    </div>
  );
}

/* ------------------------------ Home screen ------------------------------ */

function HomeSection() {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const toast = useStore((st) => st.toast);
  const [editingHotkeys, setEditingHotkeys] = useState(false);
  const [hotkeyDraft, setHotkeyDraft] = useState(s.hotkeys);

  return (
    <div style={{ padding: 8, display: 'grid', gap: 7 }}>
      <div>
        <div className="fieldLabel">Shortcut rows</div>
        <div className="btnRow">
          {(['one', 'two', 'hidden'] as const).map((r) => (
            <button key={r} className={`chip ${s.dockRows === r ? 'on' : ''}`} onClick={() => update({ dockRows: r })}>
              {r === 'one' ? '1 row' : r === 'two' ? '2 rows' : 'Hidden'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="fieldLabel">Favorites ({s.favorites.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {APPS.slice(0, 24).map((a) => (
            <button
              key={a.id}
              className={`chip ${s.favorites.includes(a.id) ? 'on' : ''}`}
              style={{ fontSize: 8 }}
              onClick={() => update({ favorites: s.favorites.includes(a.id) ? s.favorites.filter((f) => f !== a.id) : [...s.favorites, a.id] })}
            >
              {a.name[s.language] || a.name.en}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="fieldLabel">Hotkeys</div>
        <button className="btn" onClick={() => setEditingHotkeys((v) => !v)}>{editingHotkeys ? 'Done' : 'Edit hotkeys'}</button>
        {(editingHotkeys ? Object.entries(hotkeyDraft) : Object.entries(s.hotkeys).slice(0, 6)).map(([key, appId]) => (
          <div key={key} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '1px 0' }}>
            <span className="mono" style={{ width: 16, textAlign: 'center', background: 'var(--panel-2)', borderRadius: 3, border: '1px solid var(--line)', fontSize: 9 }}>
              {key.toUpperCase()}
            </span>
            <select
              value={appId}
              onChange={(e) => {
                if (editingHotkeys) setHotkeyDraft((prev) => ({ ...prev, [key]: e.target.value }));
                else update({ hotkeys: { ...s.hotkeys, [key]: e.target.value } });
              }}
              style={{ ...selectStyle, flex: 1, fontSize: 9 }}
              disabled={!editingHotkeys}
            >
              {APPS.map((a) => <option key={a.id} value={a.id}>{a.name[s.language] || a.name.en}</option>)}
            </select>
          </div>
        ))}
        {editingHotkeys && (
          <button className="btn primary" style={{ marginTop: 3 }} onClick={() => { update({ hotkeys: hotkeyDraft }); setEditingHotkeys(false); toast('Hotkeys saved'); }}>
            Save hotkeys
          </button>
        )}
      </div>
      <div>
        <div className="fieldLabel">Hidden apps ({s.hiddenApps.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {s.hiddenApps.length === 0 && <span className="tiny">None hidden. Use Menu on an app icon to hide it.</span>}
          {s.hiddenApps.map((id) => (
            <button key={id} className="chip" onClick={() => update({ hiddenApps: s.hiddenApps.filter((x) => x !== id) })}>
              {appName(id, s.language)} ✕
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="fieldLabel">Folders ({s.folders.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {s.folders.map((f) => (
            <span key={f.id} className="chip">{f.name} · {f.apps.length}</span>
          ))}
          {s.folders.length === 0 && <span className="tiny">Create folders from Menu in the app drawer.</span>}
        </div>
      </div>
      <button className="btn" onClick={() => update({ appOrder: [] })}>Reset icon order</button>
    </div>
  );
}

/* -------------------------------- Security ------------------------------- */

function Security() {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const toast = useStore((st) => st.toast);
  const showDialog = useStore((st) => st.showDialog);
  const lock = useStore((st) => st.lock);
  const [oldPass, setOldPass] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [mode, setMode] = useState<'idle' | 'set' | 'change'>('idle');
  const [error, setError] = useState('');

  const savePassword = async () => {
    if (mode === 'change') {
      const ok = await verifyPassword(oldPass, s.passwordSalt, s.passwordHash);
      if (!ok) { setError('Current password is wrong'); return; }
    }
    if (pass.length < 4) { setError('Use 4–12 characters'); return; }
    if (pass.length > 12) { setError('Maximum 12 characters'); return; }
    if (pass !== pass2) { setError('Passwords do not match'); return; }
    const salt = randomSalt();
    const hash = await hashPassword(pass, salt);
    update({ passwordHash: hash, passwordSalt: salt, passwordIsPin: /^\d+$/.test(pass) });
    setMode('idle');
    setPass(''); setPass2(''); setOldPass(''); setError('');
    successChime();
    toast('Password saved (PBKDF2 hash)');
  };

  return (
    <div style={{ padding: 8, display: 'grid', gap: 7 }}>
      <div className="card" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icon name="shield" size={18} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{s.passwordHash ? 'Keyboard is locked on boot' : 'No password set'}</div>
          <div className="tiny">{s.passwordHash ? `Stored as a salted PBKDF2 hash${s.passwordIsPin ? ' (PIN)' : ''}` : 'Press End to lock at any time'}</div>
        </div>
      </div>

      {(mode === 'set' || mode === 'change') ? (
        <div style={{ display: 'grid', gap: 3 }}>
          {mode === 'change' && (
            <>
              <div className="fieldLabel">Current password</div>
              <Field value={oldPass} onChange={setOldPass} kind="password" placeholder="Current password" autoFocus maxLength={12} />
            </>
          )}
          <div className="fieldLabel">New password or PIN (4–12)</div>
          <Field value={pass} onChange={setPass} kind="password" placeholder="New password" autoFocus={mode === 'set'} maxLength={12} />
          <Field value={pass2} onChange={setPass2} kind="password" placeholder="Repeat new password" maxLength={12} onSubmit={() => void savePassword()} />
          {error && <div className="tiny" style={{ color: 'var(--red)' }}>{error}</div>}
          <div className="btnRow">
            <button className="btn" onClick={() => { setMode('idle'); setError(''); }}>Cancel</button>
            <button className="btn primary" onClick={() => void savePassword()}>Save password</button>
          </div>
          <div className="tiny">5 wrong attempts trigger a 10-second cool-down. Forgot it? Reset OS (wipes data).</div>
        </div>
      ) : (
        <div className="btnRow">
          <button className="btn primary" onClick={() => setMode(s.passwordHash ? 'change' : 'set')}>
            {s.passwordHash ? 'Change password' : 'Set password'}
          </button>
          {s.passwordHash && (
            <button
              className="btn danger"
              onClick={() => showDialog({
                title: 'Remove password?',
                body: 'The lock screen will stop asking for a password.',
                confirmLabel: 'Remove', danger: true,
                onConfirm: () => { update({ passwordHash: '', passwordSalt: '', passwordIsPin: false }); toast('Password removed'); },
              })}
            >Remove password</button>
          )}
        </div>
      )}

      <div>
        <div className="fieldLabel">Auto-lock</div>
        <div className="btnRow">
          {[30, 60, 120, 300, 0].map((v) => (
            <button key={v} className={`chip ${s.autoLock === v ? 'on' : ''}`} onClick={() => update({ autoLock: v })}>
              {v === 0 ? 'Never' : v < 60 ? `${v}s` : `${v / 60}m`}
            </button>
          ))}
        </div>
      </div>
      <button className="btn" onClick={lock}>Lock keyboard now</button>
    </div>
  );
}

/* ------------------------------- Date & Time ----------------------------- */

function DateTime() {
  const s = useStore((st) => st.settings);
  const set = useStore((st) => st.setSetting);
  const [zones, setZones] = useState<string[]>(['local']);
  useEffect(() => {
    try {
      const anyIntl = Intl as any;
      if (typeof anyIntl.supportedValuesOf === 'function') setZones(['local', ...anyIntl.supportedValuesOf('timeZone')]);
      else setZones(['local', 'UTC', 'Africa/Cairo', 'Europe/London', 'America/New_York', 'Asia/Tokyo']);
    } catch { /* ignore */ }
  }, []);
  return (
    <div style={{ padding: 8, display: 'grid', gap: 7 }}>
      <div>
        <div className="fieldLabel">Clock format</div>
        <div className="btnRow">
          <button className={`chip ${!s.clock24 ? 'on' : ''}`} onClick={() => set('clock24', false)}>12-hour</button>
          <button className={`chip ${s.clock24 ? 'on' : ''}`} onClick={() => set('clock24', true)}>24-hour</button>
        </div>
      </div>
      <div>
        <div className="fieldLabel">Time zone</div>
        <select value={s.timezone} onChange={(e) => set('timezone', e.target.value)} style={selectStyle}>
          {zones.map((z) => <option key={z} value={z}>{z === 'local' ? 'Device time zone' : z}</option>)}
        </select>
      </div>
      <div className="tiny">
        The clock follows your device's time; the time-zone list is used by the world clock and time formatting.
      </div>
    </div>
  );
}

/* -------------------------------- Language ------------------------------- */

function Language() {
  const s = useStore((st) => st.settings);
  const set = useStore((st) => st.setSetting);
  const toast = useStore((st) => st.toast);
  const choose = (lang: Lang) => {
    set('language', lang);
    toast(lang === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English');
  };
  return (
    <div style={{ padding: 8, display: 'grid', gap: 5 }}>
      <button className="rowBtn" onClick={() => choose('en')} style={{ border: s.language === 'en' ? '1px solid var(--hl)' : undefined, borderRadius: 5 }}>
        <span>English</span><span className="meta">Left to right</span>
      </button>
      <button className="rowBtn" onClick={() => choose('ar')} style={{ border: s.language === 'ar' ? '1px solid var(--hl)' : undefined, borderRadius: 5, direction: 'rtl' }}>
        <span>العربية</span><span className="meta">من اليمين إلى اليسار</span>
      </button>
      <div className="tiny">
        App names, labels and numbers switch locale. Dates and times use Intl for the active language.
      </div>
    </div>
  );
}

/* --------------------------------- Battery -------------------------------- */

function Battery() {
  const s = useStore((st) => st.settings);
  const battery = useStore((st) => st.battery);
  const set = useStore((st) => st.setSetting);
  const pct = Math.round(battery.level * 100);
  return (
    <div style={{ padding: 8, display: 'grid', gap: 7 }}>
      <div className="card" style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 42, height: 20, border: '2px solid var(--text)', borderRadius: 4, padding: 2, position: 'relative' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct < 20 ? 'var(--red)' : 'var(--green)', borderRadius: 1 }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{pct}%</div>
            <div className="tiny">{battery.charging ? 'Charging' : 'On battery'} · simulated drain</div>
          </div>
        </div>
        <div className="tiny">Uses the Battery Status API when available, otherwise drains ~1% per minute of use.</div>
      </div>
      <div className="btnRow">
        <button className={`chip ${s.powerSaver ? 'on' : ''}`} onClick={() => set('powerSaver', !s.powerSaver)}>Power saver</button>
        <button className="btn" onClick={() => set('brightness', 0.5)}>Dim to 50%</button>
      </div>
      <div className="tiny">Power saver dims the screen and lowers saturation. Music and alarms keep running.</div>
    </div>
  );
}

/* --------------------------------- Storage ------------------------------- */

function Storage() {
  const [estimate, setEstimate] = useState({ usage: 0, quota: 0 });
  const [keys, setKeys] = useState<number>(0);
  const toast = useStore((s) => s.toast);
  const showDialog = useStore((s) => s.showDialog);
  useEffect(() => {
    void dbEstimate().then(setEstimate);
    void import('../../os/db').then(({ dbKeys }) => dbKeys().then((k) => setKeys(k.length)));
  }, []);
  const pct = estimate.quota ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;
  return (
    <div style={{ padding: 8, display: 'grid', gap: 7 }}>
      <div>
        <div className="fieldLabel">IndexedDB usage</div>
        <div className="progress"><i style={{ width: `${Math.max(2, pct)}%` }} /></div>
        <div className="tiny" style={{ marginTop: 2 }}>{formatBytes(estimate.usage)} used of {formatBytes(estimate.quota)} · {keys} keys</div>
      </div>
      <div className="card tiny" style={{ lineHeight: 1.55 }}>
        Photos, wallpapers, voice notes, notes, contacts, scores and settings live here. Clearing
        local data removes them permanently — nothing is stored on a server.
      </div>
      <button
        className="btn danger"
        onClick={() => showDialog({
          title: 'Clear local data?',
          body: 'All apps, wallpapers, notes, photos and passwords stored in this browser will be deleted.',
          confirmLabel: 'Clear everything', danger: true,
          onConfirm: async () => {
            await dbClear();
            localStorage.clear();
            toast('Local data cleared — reloading');
            window.setTimeout(() => window.location.reload(), 800);
          },
        })}
      >Clear local data</button>
    </div>
  );
}

/* ------------------------------ Accessibility ---------------------------- */

function Accessibility() {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  return (
    <div style={{ padding: 8, display: 'grid', gap: 6 }}>
      <button className={`rowBtn ${s.highContrast ? 'active' : ''}`} onClick={() => update({ highContrast: !s.highContrast })}>
        <Icon name="eye" size={12} />
        <span>High contrast</span>
        <span className="meta">{s.highContrast ? 'On' : 'Off'}</span>
      </button>
      <button className="rowBtn" onClick={() => update({ largeText: !s.largeText })}>
        <Icon name="memo" size={12} />
        <span>Large text</span>
        <span className="meta">{s.largeText ? 'On' : 'Off'}</span>
      </button>
      <button className="rowBtn" onClick={() => update({ reduceMotion: !s.reduceMotion })}>
        <Icon name="sun" size={12} />
        <span>Reduce motion</span>
        <span className="meta">{s.reduceMotion ? 'On' : 'Off'}</span>
      </button>
      <div className="tiny">
        The OS respects <b>prefers-reduced-motion</b> from your system too. Every control is reachable
        with the arrow keys, Enter and Back, and screens carry ARIA labels for screen readers.
      </div>
    </div>
  );
}

/* ---------------------------------- Reset -------------------------------- */

function Reset({ onDone }: { onDone: () => void }) {
  const showDialog = useStore((s) => s.showDialog);
  const toast = useStore((s) => s.toast);
  const confirmReset = () => {
    showDialog({
      title: 'Reset OWL OS?',
      body: 'This wipes every setting and all local data on this device. Are you sure?',
      confirmLabel: 'Continue', danger: true,
      onConfirm: () => {
        showDialog({
          title: 'Last confirmation',
          body: 'There is no undo. Export anything important first.',
          confirmLabel: 'Erase everything', danger: true,
          onConfirm: async () => {
            await dbClear();
            try { localStorage.clear(); } catch { /* ignore */ }
            toast('OS reset — restarting');
            onDone();
            window.setTimeout(() => { window.location.hash = ''; window.location.reload(); }, 700);
          },
        });
      },
    });
  };
  return (
    <div style={{ padding: 8, display: 'grid', gap: 7 }}>
      <div className="card tiny" style={{ lineHeight: 1.55 }}>
        Reset returns the phone to factory state: the setup wizard runs again and all notes,
        contacts, photos, passwords and settings are removed from this browser.
      </div>
      <button className="btn danger" onClick={confirmReset}>Reset OS…</button>
      <button
        className="btn"
        onClick={() => {
          useStore.getState().updateSettings(defaultSettings());
          useStore.getState().toast('Settings restored to defaults');
        }}
      >
        Restore default settings only
      </button>
    </div>
  );
}

/* ---------------------------------- About -------------------------------- */

function About() {
  return (
    <div style={{ padding: 8, display: 'grid', gap: 5 }}>
      <div style={{ textAlign: 'center', padding: '4px 0' }}>
        <div style={{ fontSize: 34 }}>🦉</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.3em' }}>OWL</div>
        <div className="tiny">OS 1.0 “Retro Edition”</div>
      </div>
      <div className="card tiny" style={{ lineHeight: 1.6 }}>
        <b>Privacy:</b> Your files, photos, notes, contacts, messages and passwords stay in this
        browser on this device; OWL does not upload them to its own server. API keys are stored locally.
        When you use Gemini, the message or call text you submit is sent directly to Google. YouTube
        search terms are sent directly to YouTube. Opened websites also connect to their own services.
        There is no OWL tracking, analytics or advertising cookie.
        <hr className="sep" />
        <b>Credits:</b> React, Vite, Zustand, idb-keyval, jsmediatags. Icons and device artwork are
        original. All sounds are synthesised with the Web Audio API.
        <hr className="sep" />
        Device design inspired by classic QWERTY phones of 2010 — no third-party trademarks used.
      </div>
      <div className="kv"><b>Screen</b><span>480 × 360</span></div>
      <div className="kv"><b>Version</b><span>1.0.0</span></div>
      <div className="kv"><b>Storage</b><span>IndexedDB + localStorage</span></div>
      <div className="kv"><b>Source</b><span>github.com/aamrabdelhay/owl</span></div>
      <div className="tiny" style={{ textAlign: 'center', marginTop: 4 }}>
        Made for keyboard people. Hold a letter on the home screen to launch its hotkey.
      </div>
    </div>
  );
}

/* ---------------------------------- Help --------------------------------- */

function Help() {
  return (
    <div style={{ padding: 8, display: 'grid', gap: 5 }}>
      <div className="owlSection" style={{ padding: 0 }}>Keyboard map</div>
      {SHORTCUT_LEGEND.map(([k, d]) => (
        <div key={k} className="kv"><b className="mono">{k}</b><span style={{ textAlign: 'right' }}>{d}</span></div>
      ))}
      <div className="owlSection" style={{ padding: '6px 0 0' }}>Trackpad</div>
      <div className="tiny">Drag in any direction to move the highlight, click to select. Arrow keys do the same.</div>
      <div className="owlSection" style={{ padding: '6px 0 0' }}>Menus</div>
      <div className="tiny">Menu opens the app drawer on the home screen and the context menu inside apps. Hold Menu for recent apps. Hold Enter (or click and hold the trackpad) for long-press actions.</div>
      <div className="owlSection" style={{ padding: '6px 0 0' }}>Power</div>
      <div className="tiny">Short press End locks the phone. Hold End for one second for Lock / Restart / Shutdown.</div>
      <button className="btn" onClick={() => useStore.getState().openApp('setup')} style={{ marginTop: 4 }}>Re-run setup wizard</button>
    </div>
  );
}


/* ------------------------- Keyboard mode & AI ---------------------------- */

function KeyboardSettings() {
  const mode = useStore((st) => st.settings.keyboardMode);
  const set = useStore((st) => st.setSetting);
  return (
    <div style={{ padding: 8, display: 'grid', gap: 8 }}>
      <div className="fieldLabel">On-screen keyboard</div>
      <button className={`rowBtn ${mode === 'simple' ? 'active' : ''}`} onClick={() => set('keyboardMode', 'simple')}>
        <Icon name="phone" size={16} />
        <span style={{ flex: 1 }}>Classic phone keypad</span>
        <span className="meta">{mode === 'simple' ? 'Selected' : '12-key'}</span>
      </button>
      <button className={`rowBtn ${mode === 'blackberry' ? 'active' : ''}`} onClick={() => set('keyboardMode', 'blackberry')}>
        <Icon name="keyboard" size={16} />
        <span style={{ flex: 1 }}>BlackBerry QWERTY</span>
        <span className="meta">{mode === 'blackberry' ? 'Selected' : 'Full keyboard'}</span>
      </button>
      <div className="card tiny" style={{ lineHeight: 1.6 }}>
        Classic mode uses multi-tap letters on the number keys (2=ABC, 3=DEF … 9=WXYZ).
        Tap the same key again quickly to cycle letters. In the Phone dialler the same
        keypad enters digits. BlackBerry mode keeps the full QWERTY layout.
      </div>
      <div className="tiny">The selected mode is saved on this device and is used on touch screens and desktop clicks.</div>
    </div>
  );
}

function AISettings() {
  const settings = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const toast = useStore((st) => st.toast);
  const [gemini, setGemini] = useState(settings.geminiApiKey || '');
  const [youtube, setYoutube] = useState(settings.youtubeApiKey || '');
  useEffect(() => setGemini(settings.geminiApiKey || ''), [settings.geminiApiKey]);
  useEffect(() => setYoutube(settings.youtubeApiKey || ''), [settings.youtubeApiKey]);

  return (
    <div style={{ padding: 8, display: 'grid', gap: 8 }}>
      <div className="fieldLabel">Google Gemini API key</div>
      <Field value={gemini} onChange={setGemini} kind="password" placeholder="Paste your Gemini API key" />
      <button className="btn" onClick={async () => {
        try {
          if (!navigator.clipboard?.readText) throw new Error('Clipboard paste is not available in this browser. Use BlackBerry keyboard mode or paste into a supported field.');
          const value = (await navigator.clipboard.readText()).trim();
          if (!value) throw new Error('Clipboard is empty.');
          setGemini(value);
          toast('Gemini key pasted — press Save to keep it');
        } catch (error) {
          toast(error instanceof Error ? error.message : 'Could not read clipboard');
        }
      }}>Paste Gemini key from clipboard</button>
      <button className="btn primary" onClick={() => { update({ geminiApiKey: gemini.trim() }); toast(gemini.trim() ? 'Gemini key saved on this device' : 'Gemini key removed'); }}>
        Save Gemini key
      </button>
      <button className={`chip ${settings.aiAutoReply ? 'on' : ''}`} onClick={() => update({ aiAutoReply: !settings.aiAutoReply })}>
        {settings.aiAutoReply ? '✓ AI SMS auto-replies enabled' : 'Enable AI SMS auto-replies'}
      </button>
      <button className={`chip ${settings.aiAutoAnswer ? 'on' : ''}`} onClick={() => update({ aiAutoAnswer: !settings.aiAutoAnswer })}>
        {settings.aiAutoAnswer ? '✓ Gemini auto-answers simulated calls' : 'Enable Gemini call auto-answer'}
      </button>
      <div className="divider" />
      <div className="fieldLabel">YouTube Data API key</div>
      <Field value={youtube} onChange={setYoutube} kind="password" placeholder="Paste a YouTube Data API v3 key" />
      <button className="btn" onClick={async () => {
        try {
          if (!navigator.clipboard?.readText) throw new Error('Clipboard paste is not available in this browser.');
          const value = (await navigator.clipboard.readText()).trim();
          if (!value) throw new Error('Clipboard is empty.');
          setYoutube(value);
          toast('YouTube key pasted — press Save to keep it');
        } catch (error) {
          toast(error instanceof Error ? error.message : 'Could not read clipboard');
        }
      }}>Paste YouTube key from clipboard</button>
      <button className="btn" onClick={() => { update({ youtubeApiKey: youtube.trim() }); toast(youtube.trim() ? 'YouTube key saved on this device' : 'YouTube key removed'); }}>
        Save YouTube key
      </button>
      <div className="card tiny" style={{ lineHeight: 1.6 }}>
        <b>Privacy & billing:</b> Keys are stored in this browser's local settings, not on an OWL server.
        Requests go directly from this device to Google. Gemini receives the SMS text or conversation
        prompt when AI is used. AI auto-replies and call auto-answer are opt-in. Protect your keys, restrict them in Google AI Studio / Cloud Console,
        and review Google's own usage and billing limits.
      </div>
      <div className="tiny">
        YouTube search uses YouTube Data API v3 and needs its own Google Cloud key with the API enabled.
        Public embeddable videos can play without signing in; some age-restricted or embedding-disabled
        videos must open on YouTube instead.
      </div>
    </div>
  );
}
