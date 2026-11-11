import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid, useNow } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { Alarm } from '../../os/types';
import { formatDuration } from '../../hooks';
import { playRingtone, stopRingtone } from '../../os/audio';

type Tab = 'world' | 'alarm' | 'stopwatch' | 'timer' | 'bedside';

const CITY_ZONES: [string, string][] = [
  ['Cairo', 'Africa/Cairo'], ['London', 'Europe/London'], ['New York', 'America/New_York'],
  ['Tokyo', 'Asia/Tokyo'], ['Dubai', 'Asia/Dubai'], ['Sydney', 'Australia/Sydney'],
  ['Paris', 'Europe/Paris'], ['Los Angeles', 'America/Los_Angeles'], ['Riyadh', 'Asia/Riyadh'],
  ['Berlin', 'Europe/Berlin'], ['Istanbul', 'Europe/Istanbul'], ['Mumbai', 'Asia/Kolkata'],
];

export default function ClockApp() {
  const [tab, setTab] = useState<Tab>('world');
  const settings = useStore((s) => s.settings);
  const now = useNow(1000);

  return (
    <AppFrame
      title="Clock"
      icon="clock"
      actions={<span className="tiny mono">{now.toLocaleTimeString(undefined, { hour12: !settings.clock24 })}</span>}
      menu={[
        { id: 'world', label: 'World clock', icon: 'globe', run: () => setTab('world') },
        { id: 'alarms', label: 'Alarms', icon: 'bell', run: () => setTab('alarm') },
        { id: 'stopwatch', label: 'Stopwatch', icon: 'clock', run: () => setTab('stopwatch') },
        { id: 'timer', label: 'Timer', icon: 'clock', run: () => setTab('timer') },
        { id: 'bedside', label: 'Bedside mode', icon: 'sun', run: () => setTab('bedside') },
      ]}
    >
      <div className="owlTabBar">
        {(['world', 'alarm', 'stopwatch', 'timer', 'bedside'] as Tab[]).map((t) => (
          <button key={t} className={`owlTab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'bedside' ? 'Bedside' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="appBody">
        {tab === 'world' && <WorldClock />}
        {tab === 'alarm' && <Alarms />}
        {tab === 'stopwatch' && <Stopwatch />}
        {tab === 'timer' && <Countdown />}
        {tab === 'bedside' && <Bedside />}
      </div>
    </AppFrame>
  );
}

function WorldClock() {
  const [cities, setCities] = useState(CITY_ZONES.slice(0, 4));
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const now = useNow(1000);
  const settings = useStore((s) => s.settings);
  const allZones = useMemoZones();

  const filtered = allZones
    .filter((z) => !cities.some(([, tz]) => tz === z))
    .filter((z) => !query || z.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40);

  const timeIn = (tz: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !settings.clock24 }).format(now);
    } catch {
      return '--:--';
    }
  };
  const dayDiff = (tz: string) => {
    try {
      const there = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const here = new Date(now.toLocaleString('en-US'));
      return Math.round((there.setHours(0, 0, 0, 0) - here.setHours(0, 0, 0, 0)) / 86400000);
    } catch { return 0; }
  };

  return (
    <div>
      <div className="owlSection">World clock</div>
      {cities.map(([name, tz], i) => {
        const diff = dayDiff(tz);
        return (
          <button key={tz} className="rowBtn" onClick={() => setCities((prev) => prev.filter((_, idx) => idx !== i))} title="Tap to remove">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600 }}>{name}</span>
              <span className="tiny">{tz.split('/')[1]?.replace(/_/g, ' ')}</span>
            </div>
            <span className="meta mono" style={{ fontSize: 12 }}>
              {timeIn(tz)} {diff !== 0 && <span className="tiny">({diff > 0 ? '+' : ''}{diff}d)</span>}
            </span>
          </button>
        );
      })}
      {adding ? (
        <div style={{ padding: 6 }}>
          <Field value={query} onChange={setQuery} placeholder="Filter time zones" autoFocus />
          <div style={{ maxHeight: 130, overflow: 'auto', marginTop: 4 }}>
            {filtered.map((z) => (
              <button key={z} className="rowBtn" onClick={() => { setCities((prev) => [...prev, [z.split('/').pop()!.replace(/_/g, ' '), z]]); setAdding(false); setQuery(''); }}>
                <span>{z.split('/').pop()?.replace(/_/g, ' ')}</span>
                <span className="meta">{z.split('/')[0]}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="tiny">No zones match.</div>}
          </div>
        </div>
      ) : (
        <button className="btn" style={{ margin: 6 }} onClick={() => setAdding(true)}>+ Add city</button>
      )}
      <div className="tiny" style={{ padding: '0 8px 8px' }}>Tap a city to remove it. Times use your device clock and Intl time zones.</div>
    </div>
  );
}

function useMemoZones(): string[] {
  return React.useMemo(() => {
    try {
      const anyIntl = Intl as any;
      if (typeof anyIntl.supportedValuesOf === 'function') return anyIntl.supportedValuesOf('timeZone');
    } catch { /* fall through */ }
    return [
      'Africa/Cairo', 'Africa/Lagos', 'America/Chicago', 'America/Denver', 'America/Mexico_City',
      'America/Sao_Paulo', 'Asia/Baghdad', 'Asia/Dhaka', 'Asia/Hong_Kong', 'Asia/Jakarta',
      'Asia/Karachi', 'Asia/Seoul', 'Asia/Singapore', 'Europe/Amsterdam', 'Europe/Madrid',
      'Europe/Moscow', 'Europe/Rome', 'Pacific/Auckland', 'Pacific/Honolulu', 'UTC',
    ];
  }, []);
}

function Alarms() {
  const [alarms, setAlarms] = useCollection<Alarm>(DB_KEYS.alarms);
  const [editing, setEditing] = useState<Alarm | null>(null);
  const settings = useStore((s) => s.settings);
  const toast = useStore((s) => s.toast);
  const setRinging = useStore((s) => s.setAlarmRinging);
  const showDialog = useStore((s) => s.showDialog);

  const newAlarm = (): Alarm => ({ id: uid('alarm'), hour: 7, minute: 30, label: 'Alarm', days: [], enabled: true, sound: settings.alarmTone });

  return (
    <div>
      <div className="owlSection">Alarms · {alarms.filter((a) => a.enabled).length} active</div>
      {alarms.length === 0 && (
        <div className="empty"><div className="big">⏰</div><div>No alarms yet.</div></div>
      )}
      {alarms.map((a) => (
        <div key={a.id} className="rowBtn" style={{ cursor: 'default' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="mono" style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, opacity: a.enabled ? 1 : 0.45 }}>
              {String(a.hour).padStart(2, '0')}:{String(a.minute).padStart(2, '0')}
            </span>
            <span className="tiny">
              {a.label} · {a.days.length === 0 ? 'Once' : a.days.map((d) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d]).join(' ')}
            </span>
          </div>
          <button className={`chip ${a.enabled ? 'on' : ''}`} onClick={() => setAlarms((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)))}>
            {a.enabled ? 'On' : 'Off'}
          </button>
          <button className="iconBtn" onClick={() => setEditing(a)} aria-label="Edit alarm">✎</button>
          <button className="iconBtn" onClick={() => setRinging(a.label || 'Alarm')} aria-label="Test alarm">▷</button>
          <button className="iconBtn" onClick={() => showDialog({
            title: 'Delete alarm?', body: `${String(a.hour).padStart(2, '0')}:${String(a.minute).padStart(2, '0')} ${a.label}`,
            confirmLabel: 'Delete', danger: true, onConfirm: () => setAlarms((prev) => prev.filter((x) => x.id !== a.id)),
          })} aria-label="Delete alarm">✕</button>
        </div>
      ))}
      <button className="btn primary" style={{ margin: 6 }} onClick={() => setEditing(newAlarm())}>+ New alarm</button>
      {editing && (
        <div className="dialogLayer" role="dialog" aria-label="Alarm">
          <div className="dialog">
            <h3>{alarms.some((a) => a.id === editing.id) ? 'Edit alarm' : 'New alarm'}</h3>
            <div className="dBody" style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min={0} max={23} value={editing.hour}
                  onChange={(e) => setEditing({ ...editing, hour: Math.max(0, Math.min(23, Number(e.target.value))) })}
                  style={numStyle} aria-label="Hour" inputMode="numeric"
                />
                <b>:</b>
                <input
                  type="number" min={0} max={59} value={editing.minute}
                  onChange={(e) => setEditing({ ...editing, minute: Math.max(0, Math.min(59, Number(e.target.value))) })}
                  style={numStyle} aria-label="Minute" inputMode="numeric"
                />
                <div style={{ flex: 1 }} />
                <button className={`chip ${editing.enabled ? 'on' : ''}`} onClick={() => setEditing({ ...editing, enabled: !editing.enabled })}>{editing.enabled ? 'Enabled' : 'Off'}</button>
              </div>
              <div className="fieldLabel">Label</div>
              <Field value={editing.label} onChange={(v) => setEditing({ ...editing, label: v })} placeholder="Alarm" maxLength={30} />
              <div className="fieldLabel">Repeat</div>
              <div className="btnRow">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                  <button
                    key={d}
                    className={`chip ${editing.days.includes(i) ? 'on' : ''}`}
                    onClick={() => setEditing({
                      ...editing,
                      days: editing.days.includes(i) ? editing.days.filter((x) => x !== i) : [...editing.days, i].sort(),
                    })}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="tiny">No days selected = rings once tomorrow.</div>
            </div>
            <div className="dActions">
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button
                className="btn primary"
                onClick={() => {
                  const exists = alarms.some((a) => a.id === editing.id);
                  setAlarms((prev) => (exists ? prev.map((a) => (a.id === editing.id ? editing : a)) : [...prev, editing]));
                  setEditing(null);
                  toast('Alarm saved');
                }}
              >Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const numStyle: React.CSSProperties = {
  width: 46, background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)', color: 'var(--text)',
  borderRadius: 4, padding: '2px 4px', fontSize: 16, fontFamily: 'var(--font-display)', textAlign: 'center',
};

function Stopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const startRef = useRef(0);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    let raf = 0;
    const loop = () => {
      setElapsed(baseRef.current + (performance.now() - startRef.current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const fmt = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const reset = () => { setRunning(false); setElapsed(0); baseRef.current = 0; setLaps([]); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
        <div className="mono" style={{ fontSize: 40, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.02em' }}>{fmt(elapsed)}</div>
      </div>
      <div className="btnRow" style={{ justifyContent: 'center', padding: 4 }}>
        <button className={`btn ${running ? 'danger' : 'primary'}`} onClick={() => {
          if (running) { baseRef.current = elapsed; setRunning(false); }
          else setRunning(true);
        }}>{running ? 'Stop' : elapsed ? 'Resume' : 'Start'}</button>
        <button className="btn" onClick={() => setLaps((l) => [elapsed, ...l])} disabled={!elapsed}>Lap</button>
        <button className="btn" onClick={reset}>Reset</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {laps.map((l, i) => {
          const prev = laps[i + 1] ?? 0;
          return (
            <div key={i} className="kv" style={{ padding: '3px 9px' }}>
              <b>Lap {laps.length - i}</b>
              <span className="mono">{fmt(l - prev)} <span className="tiny">({fmt(l)})</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Countdown() {
  const [total, setTotal] = useState(300);
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [custom, setCustom] = useState('5');
  const store = useStore;

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(t);
          setRunning(false);
          playRingtone(useStore.getState().settings.alarmTone, 0.9, 3);
          useStore.getState().toast("Time's up!");
          if (useStore.getState().settings.vibrate) navigator.vibrate?.([300, 200, 300]);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const start = (seconds: number) => {
    stopRingtone();
    setTotal(seconds);
    setRemaining(seconds);
    setRunning(true);
  };

  return (
    <div style={{ display: 'grid', gap: 6, padding: 8, placeItems: 'center' }}>
      <div className="mono" style={{ fontSize: 42, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
        {formatDuration(remaining).padStart(5, '0')}
      </div>
      <div className="progress" style={{ width: '80%' }}><i style={{ width: `${total ? ((total - remaining) / total) * 100 : 0}%` }} /></div>
      <div className="btnRow" style={{ justifyContent: 'center' }}>
        <button className={`btn ${running ? 'danger' : 'primary'}`} onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Start'}</button>
        <button className="btn" onClick={() => { setRunning(false); setRemaining(total); }}>Reset</button>
      </div>
      <div className="btnRow" style={{ justifyContent: 'center' }}>
        {[60, 300, 600, 1800, 3600].map((s) => (
          <button key={s} className="chip" onClick={() => start(s)}>{s >= 60 ? `${s / 60}m` : `${s}s`}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Field value={custom} onChange={setCustom} kind="decimal" placeholder="Minutes" maxLength={4} />
        <button className="btn" onClick={() => { const m = Number(custom); if (m > 0) start(Math.round(m * 60)); }}>Set minutes</button>
      </div>
      <div className="tiny">Rings with the Alarm tone from Settings › Sound.</div>
    </div>
  );
}

function Bedside() {
  const now = useNow(1000);
  const settings = useStore((s) => s.settings);
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#000', position: 'relative' }}>
      <div style={{ textAlign: 'center', color: '#ffb347', opacity: 0.9, textShadow: '0 0 24px rgba(255,150,40,.35)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 58, fontWeight: 700, lineHeight: 1 }}>
          {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24 })}
        </div>
        <div className="tiny" style={{ color: '#c98a3a', marginTop: 4, letterSpacing: '0.2em' }}>
          {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
        </div>
        <div className="tiny" style={{ color: '#6b4a1c', marginTop: 10, fontSize: 8 }}>Press Back to exit bedside mode</div>
      </div>
    </div>
  );
}
