import React, { useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { CalEvent, TaskItem } from '../../os/types';

const COLORS: Record<string, string> = {
  '#ff6b5b': 'Coral', '#4aa3ff': 'Blue', '#4cc38a': 'Green', '#f0a13c': 'Amber', '#b06cf0': 'Violet',
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function repeatMatches(event: CalEvent, day: Date): boolean {
  const start = new Date(event.start);
  if (sameDay(start, day)) return true;
  if (day < startOfDay(start)) return false;
  switch (event.repeat) {
    case 'daily': return true;
    case 'weekly': return start.getDay() === day.getDay();
    case 'monthly': return start.getDate() === day.getDate();
    case 'yearly': return start.getDate() === day.getDate() && start.getMonth() === day.getMonth();
    default: return false;
  }
}

export default function CalendarApp() {
  const [events, setEvents] = useCollection<CalEvent>(DB_KEYS.events, [
    {
      id: 'ev-welcome', title: 'Welcome to OWL', location: '', notes: 'Press Menu for options.',
      start: startOfDay(new Date()).getTime() + 3600000 * 10, end: startOfDay(new Date()).getTime() + 3600000 * 11,
      allDay: false, reminderMinutes: 10, repeat: 'none', color: '#f0a13c',
    },
  ]);
  const [tasks] = useCollection<TaskItem>(DB_KEYS.tasks, []);
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [jump, setJump] = useState('');
  const showDialog = useStore((s) => s.showDialog);
  const toast = useStore((s) => s.toast);
  const setAppMenu = useStore((s) => s.setAppMenu);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = first.getDay();
    const start = addDays(first, -startOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const eventsOn = (day: Date) => events.filter((e) => repeatMatches(e, day)).sort((a, b) => a.start - b.start);
  const tasksOn = (day: Date) => tasks.filter((t) => t.due && repeatMatches({ ...emptyEvent(), start: new Date(t.due).getTime(), repeat: 'none' } as CalEvent, day));

  const newEvent = (date?: Date) => {
    const base = date || cursor;
    const start = new Date(base);
    start.setHours(9, 0, 0, 0);
    if (start < new Date()) start.setHours(new Date().getHours() + 1, 0, 0, 0);
    setEditing({
      ...emptyEvent(),
      start: start.getTime(),
      end: start.getTime() + 3600000,
    });
  };

  React.useEffect(() => {
    setAppMenu({
      title: 'Calendar',
      actions: [
        { id: 'new', label: 'New event', icon: 'plus', run: () => newEvent() },
        { id: 'month', label: 'Month view', icon: 'calendar', run: () => setView('month') },
        { id: 'week', label: 'Week view', icon: 'calendar', run: () => setView('week') },
        { id: 'agenda', label: 'Agenda view', icon: 'list', run: () => setView('agenda') },
        { id: 'jump', label: 'Jump to date…', icon: 'arrowRight', run: () => setJump('') },
        { id: 'perm', label: 'Enable notifications', icon: 'bell', run: () => void requestNotifications() },
        { id: 'clear', label: 'Delete all events', icon: 'trash', danger: true, run: () => showDialog({ title: 'Delete all events?', body: 'Local calendar data only.', confirmLabel: 'Delete', danger: true, onConfirm: () => setEvents([]) }) },
      ],
    });
    return () => setAppMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  if (editing) {
    return <EventEditor event={editing} onSave={(e) => {
      const exists = events.some((x) => x.id === e.id);
      setEvents((prev) => (exists ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e]));
      setEditing(null);
      toast(exists ? 'Event updated' : 'Event added');
    }} onCancel={() => setEditing(null)} onDelete={(id) => {
      setEvents((prev) => prev.filter((x) => x.id !== id));
      setEditing(null);
      toast('Event deleted');
    }} />;
  }

  return (
    <AppFrame
      title="Calendar"
      icon="calendar"
      actions={
        <>
          <button className="hbtn" onClick={() => newEvent(cursor)}><Icon name="plus" size={9} /> New</button>
          <button className="hbtn" onClick={() => setCursor(new Date())}>Today</button>
        </>
      }
    >
      <div className="owlTabBar">
        {(['month', 'week', 'day', 'agenda'] as const).map((v) => (
          <button key={v} className={`owlTab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
        <button className="owlTab" onClick={() => setView('agenda')}>Tasks</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderBottom: '1px solid var(--line)' }}>
        <button className="iconBtn" onClick={() => setCursor((c) => (view === 'month' ? new Date(c.getFullYear(), c.getMonth() - 1, 1) : addDays(c, view === 'week' ? -7 : -1)))} aria-label="Previous">‹</button>
        <strong style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
          {view === 'month'
            ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
            : view === 'week'
              ? `Week of ${addDays(startOfDay(cursor), -cursor.getDay()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </strong>
        {jump !== '' && (
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const d = new Date(jump);
                if (!isNaN(d.getTime())) { setCursor(d); setJump(''); toast('Jumped to date'); }
              }
            }}
            placeholder="YYYY-MM-DD"
            style={{ width: 70, fontSize: 9, background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 3, padding: '1px 3px' }}
            inputMode="none"
          />
        )}
        <button className="iconBtn" onClick={() => setCursor((c) => (view === 'month' ? new Date(c.getFullYear(), c.getMonth() + 1, 1) : addDays(c, view === 'week' ? 7 : 1)))} aria-label="Next">›</button>
      </div>

      <div className="appBody">
        {view === 'month' && (
          <div style={{ padding: 3 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="tiny" style={{ textAlign: 'center', fontSize: 8, paddingBottom: 2 }}>{d}</div>
              ))}
              {monthDays.map((day) => {
                const isCurrentMonth = day.getMonth() === cursor.getMonth();
                const isToday = sameDay(day, new Date());
                const dayEvents = eventsOn(day);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => { setCursor(day); setView('day'); }}
                    onDoubleClick={() => newEvent(day)}
                    className={`dayCell ${isCurrentMonth ? '' : 'dim'}`}
                    style={{
                      minHeight: 32, border: '1px solid var(--line)', borderRadius: 3, padding: 1,
                      background: isToday ? 'rgba(246,185,63,.16)' : 'rgba(255,255,255,.02)',
                      color: isCurrentMonth ? 'var(--text)' : 'var(--muted)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch',
                    }}
                    aria-label={day.toDateString()}
                  >
                    <span style={{ fontSize: 8.5, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--hl)' : undefined, textAlign: 'center' }}>{day.getDate()}</span>
                    {dayEvents.slice(0, 2).map((e) => (
                      <span key={e.id} style={{ height: 3, borderRadius: 2, background: e.color, opacity: 0.9 }} />
                    ))}
                    {dayEvents.length > 2 && <span style={{ fontSize: 6, textAlign: 'center' }}>+{dayEvents.length - 2}</span>}
                  </button>
                );
              })}
            </div>
            <div className="tiny" style={{ padding: 4 }}>Double-press a day to add an event.</div>
          </div>
        )}

        {view === 'week' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, padding: 3 }}>
            {Array.from({ length: 7 }, (_, i) => addDays(startOfDay(cursor), i - cursor.getDay())).map((day) => (
              <div key={day.toISOString()} style={{ border: '1px solid var(--line)', borderRadius: 3, minHeight: 120, padding: 2 }}>
                <div className="tiny" style={{ textAlign: 'center', color: sameDay(day, new Date()) ? 'var(--hl)' : undefined }}>
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}<br />
                  <b style={{ fontSize: 10 }}>{day.getDate()}</b>
                </div>
                {eventsOn(day).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEditing(e)}
                    style={{ width: '100%', fontSize: 7, background: e.color, color: '#08101c', border: 0, borderRadius: 2, marginTop: 1, padding: '1px 2px', cursor: 'pointer', textAlign: 'left', overflow: 'hidden' }}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {(view === 'day' || view === 'agenda') && (
          <div>
            <div className="owlSection">{view === 'day' ? cursor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Next 30 days'}</div>
            {view === 'day' && tasksOn(cursor).length > 0 && (
              <>
                <div className="owlSection" style={{ paddingTop: 0 }}>Tasks due</div>
                {tasksOn(cursor).map((t) => (
                  <button key={t.id} className="rowBtn" onClick={() => useStore.getState().openApp('tasks')}>
                    <Icon name="task" size={11} />
                    <span style={{ textDecoration: t.status === 'completed' ? 'line-through' : undefined }}>{t.title}</span>
                    <span className="meta">{t.priority}</span>
                  </button>
                ))}
              </>
            )}
            {(view === 'day' ? eventsOn(cursor) : events.filter((e) => e.start >= Date.now() - 86400000).sort((a, b) => a.start - b.start))
              .length === 0 && (
                <div className="empty">
                  <div className="big">▦</div>
                  <div>No events.</div>
                  <button className="btn primary" onClick={() => newEvent(view === 'day' ? cursor : undefined)}>Add event</button>
                </div>
              )}
            {(view === 'day' ? eventsOn(cursor) : events.filter((e) => e.start >= Date.now() - 86400000).sort((a, b) => a.start - b.start))
              .map((e) => (
                <button key={e.id} className="rowBtn" onClick={() => setEditing(e)}>
                  <span style={{ width: 4, height: 22, background: e.color, borderRadius: 2, flex: 'none' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600 }}>{e.title}</span>
                    <span className="tiny">
                      {new Date(e.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                      {e.allDay ? 'All day' : new Date(e.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {e.location ? ` · ${e.location}` : ''}
                      {e.repeat !== 'none' ? ` · ${e.repeat}` : ''}
                    </span>
                  </div>
                  {e.reminderMinutes !== null && <Icon name="bell" size={9} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
                </button>
              ))}
          </div>
        )}
      </div>
    </AppFrame>
  );
}

function emptyEvent(): CalEvent {
  return {
    id: uid('ev'), title: '', location: '', notes: '', start: Date.now(), end: Date.now() + 3600000,
    allDay: false, reminderMinutes: 10, repeat: 'none', color: '#4aa3ff',
  };
}

function EventEditor({ event, onSave, onCancel, onDelete }: {
  event: CalEvent; onSave: (e: CalEvent) => void; onCancel: () => void; onDelete: (id: string) => void;
}) {
  const [e, setE] = useState(event);
  const set = <K extends keyof CalEvent>(k: K, v: CalEvent[K]) => setE((prev) => ({ ...prev, [k]: v }));
  const dateStr = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const timeStr = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const toast = useStore((s) => s.toast);

  const updateDate = (field: 'start' | 'end', value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return;
    const old = new Date(e[field]);
    d.setHours(old.getHours(), old.getMinutes(), 0, 0);
    if (field === 'start') {
      const duration = e.end - e.start;
      setE((prev) => ({ ...prev, start: d.getTime(), end: d.getTime() + duration }));
    } else {
      setE((prev) => ({ ...prev, end: d.getTime() }));
    }
  };

  const updateTime = (field: 'start' | 'end', value: string) => {
    const [h, m] = value.split(':').map(Number);
    const d = new Date(e[field]);
    d.setHours(h || 0, m || 0, 0, 0);
    setE((prev) => ({ ...prev, [field]: d.getTime() }));
  };

  return (
    <AppFrame
      title={event.title ? 'Edit event' : 'New event'}
      icon="calendar"
      actions={<button className="hbtn" onClick={onCancel}>Cancel</button>}
    >
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="fieldLabel">Title</div>
        <Field value={e.title} onChange={(v) => set('title', v)} placeholder="Event title" autoFocus maxLength={80} />
        <div className="fieldLabel">Location</div>
        <Field value={e.location} onChange={(v) => set('location', v)} placeholder="Where?" maxLength={80} />
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ flex: 1 }}>
            <div className="fieldLabel">Date</div>
            <input type="date" value={dateStr(e.start)} onChange={(ev) => updateDate('start', ev.target.value)} style={dateInputStyle} />
          </div>
          <div style={{ width: 78 }}>
            <div className="fieldLabel">Start</div>
            <input type="time" value={timeStr(e.start)} onChange={(ev) => updateTime('start', ev.target.value)} disabled={e.allDay} style={dateInputStyle} />
          </div>
          <div style={{ width: 78 }}>
            <div className="fieldLabel">End</div>
            <input type="time" value={timeStr(e.end)} onChange={(ev) => updateTime('end', ev.target.value)} disabled={e.allDay} style={dateInputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
          <button className={`chip ${e.allDay ? 'on' : ''}`} onClick={() => set('allDay', !e.allDay)}>All day</button>
          <button className={`chip ${e.repeat !== 'none' ? 'on' : ''}`} onClick={() => {
            const opts: CalEvent['repeat'][] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
            set('repeat', opts[(opts.indexOf(e.repeat) + 1) % opts.length]);
          }}>Repeat: {e.repeat}</button>
          <button className={`chip ${e.reminderMinutes !== null ? 'on' : ''}`} onClick={() => set('reminderMinutes', e.reminderMinutes === null ? 10 : null)}>
            {e.reminderMinutes === null ? 'No reminder' : `Remind ${e.reminderMinutes}m`}
          </button>
        </div>
        <div className="fieldLabel">Notes</div>
        <Field value={e.notes} onChange={(v) => set('notes', v)} placeholder="Notes" multiline maxLength={600} />
        <div className="fieldLabel">Colour</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Object.entries(COLORS).map(([hex, label]) => (
            <button
              key={hex}
              aria-label={label}
              onClick={() => set('color', hex)}
              style={{ width: 20, height: 20, borderRadius: '50%', background: hex, border: e.color === hex ? '2px solid var(--text)' : '1px solid var(--line)', cursor: 'pointer' }}
            />
          ))}
        </div>
        <div className="btnRow" style={{ marginTop: 'auto', justifyContent: 'flex-end' }}>
          {event.title && <button className="btn danger" onClick={() => onDelete(event.id)}>Delete</button>}
          <button
            className="btn primary"
            onClick={() => {
              if (!e.title.trim()) { toast('Give the event a title'); return; }
              if (e.end <= e.start) e.end = e.start + 3600000;
              onSave({ ...e, title: e.title.trim() });
            }}
          >
            Save event
          </button>
        </div>
      </div>
    </AppFrame>
  );
}

const dateInputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,.28)', border: '1px solid var(--line)',
  color: 'var(--text)', borderRadius: 4, padding: '2px 4px', fontSize: 10, colorScheme: 'dark',
};

async function requestNotifications() {
  const toast = useStore.getState().toast;
  if (typeof Notification === 'undefined') { toast('Notifications are not supported here'); return; }
  if (Notification.permission === 'granted') { toast('Notifications already enabled'); return; }
  const result = await Notification.requestPermission();
  toast(result === 'granted' ? 'Reminders will appear as notifications' : 'Notification permission denied — reminders still show in-app');
}
