import React, { useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { TaskItem, CalEvent } from '../../os/types';

const STATUSES: TaskItem['status'][] = ['not-started', 'in-progress', 'completed'];
const STATUS_LABEL: Record<TaskItem['status'], string> = {
  'not-started': 'Not started', 'in-progress': 'In progress', completed: 'Completed',
};

export default function TasksApp() {
  const [tasks, setTasks] = useCollection<TaskItem>(DB_KEYS.tasks, [
    { id: 't-welcome', title: 'Try Owl Snake', notes: 'Games › Owl Snake', priority: 'normal', status: 'not-started', category: 'Play', createdAt: Date.now() },
    { id: 't-setup', title: 'Set a lock password', notes: 'Settings › Security', priority: 'high', status: 'not-started', category: 'Setup', createdAt: Date.now() - 1000 },
  ]);
  const [events] = useCollection<CalEvent>(DB_KEYS.events, []);
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | 'open'>('all');
  const toast = useStore((s) => s.toast);
  const showDialog = useStore((s) => s.showDialog);

  const todayStr = new Date().toISOString().slice(0, 10);
  const visible = useMemo(() => {
    return tasks
      .filter((t) => (hideCompleted ? t.status !== 'completed' : true))
      .filter((t) => {
        if (filter === 'today') return t.due === todayStr;
        if (filter === 'overdue') return !!t.due && t.due < todayStr && t.status !== 'completed';
        if (filter === 'open') return t.status !== 'completed';
        return true;
      })
      .sort((a, b) => {
        const order = { high: 0, normal: 1, low: 2 } as const;
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        if (a.due && b.due) return a.due.localeCompare(b.due);
        if (a.due) return -1;
        if (b.due) return 1;
        return order[a.priority] - order[b.priority];
      });
  }, [tasks, hideCompleted, filter, todayStr]);

  const save = (task: TaskItem) => {
    const exists = tasks.some((t) => t.id === task.id);
    setTasks((prev) => (exists ? prev.map((t) => (t.id === task.id ? task : t)) : [task, ...prev]));
    setEditing(null);
    toast(exists ? 'Task updated' : 'Task added');
  };

  const cycle = (task: TaskItem) => {
    const idx = STATUSES.indexOf(task.status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
  };

  const addToCalendar = (task: TaskItem) => {
    if (!task.due) { toast('Give the task a due date first'); return; }
    const start = new Date(`${task.due}T09:00:00`).getTime();
    const exists = events.some((e) => e.taskId === task.id);
    if (exists) { toast('Already in the calendar'); return; }
    useStore.getState().openApp('calendar');
    // Persist via the collection store used by Calendar
    void import('../../os/db').then(async ({ collectionGet, collectionSet }) => {
      const list = await collectionGet<CalEvent>('events');
      await collectionSet('events', [...(list || []), {
        id: uid('ev'), title: task.title, location: '', notes: task.notes, start, end: start + 1800000,
        allDay: false, reminderMinutes: 10, repeat: 'none', color: '#4cc38a', taskId: task.id,
      }]);
      toast('Added to calendar');
    });
  };

  if (editing) {
    return <TaskEditor task={editing} onSave={save} onCancel={() => setEditing(null)} onDelete={(id) => { setTasks((prev) => prev.filter((t) => t.id !== id)); setEditing(null); }} />;
  }

  return (
    <AppFrame
      title="Tasks"
      icon="task"
      menu={[
        { id: 'new', label: 'New task', icon: 'plus', run: () => setEditing(emptyTask()) },
        { id: 'hide', label: hideCompleted ? 'Show completed' : 'Hide completed', icon: 'check', run: () => setHideCompleted((h) => !h) },
        { id: 'calendar', label: 'Jump to calendar', icon: 'calendar', run: () => useStore.getState().openApp('calendar') },
      ]}
      actions={
        <>
          <button className="hbtn" onClick={() => setEditing(emptyTask())}><Icon name="plus" size={9} /> New</button>
          <button className="hbtn" onClick={() => setHideCompleted((h) => !h)}>{hideCompleted ? 'Show done' : 'Hide done'}</button>
        </>
      }
    >
      <div className="chipRow" style={{ padding: 4 }}>
        {(['all', 'today', 'overdue', 'open'] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'today' ? 'Due today' : f === 'overdue' ? 'Overdue' : 'Open'}
          </button>
        ))}
        <span className="tiny" style={{ marginLeft: 'auto' }}>
          {tasks.filter((t) => t.status !== 'completed').length} open
        </span>
      </div>
      <div className="appBody">
        {visible.length === 0 && (
          <div className="empty"><div className="big">✓</div><div>Nothing to do here.</div></div>
        )}
        {visible.map((t) => (
          <div key={t.id} className="rowBtn" style={{ cursor: 'default', opacity: t.status === 'completed' ? 0.6 : 1 }}>
            <button
              className="iconBtn"
              onClick={() => cycle(t)}
              aria-label={`Status: ${STATUS_LABEL[t.status]}. Press to change.`}
              style={{
                borderColor: t.status === 'completed' ? 'var(--green)' : t.status === 'in-progress' ? 'var(--hl)' : 'var(--line)',
                color: t.status === 'completed' ? 'var(--green)' : 'inherit',
              }}
            >
              {t.status === 'completed' ? '✓' : t.status === 'in-progress' ? '◐' : '○'}
            </button>
            <button className="rowBtn" style={{ padding: 0, border: 0, flex: 1 }} onClick={() => setEditing(t)}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ textDecoration: t.status === 'completed' ? 'line-through' : undefined, fontWeight: 600 }}>{t.title}</span>
                <span className="tiny">
                  {t.category}
                  {t.due ? ` · due ${t.due}` : ''}
                  {t.due && t.due < todayStr && t.status !== 'completed' ? ' · overdue' : ''}
                </span>
              </div>
            </button>
            <span className={`pill ${t.priority === 'high' ? 'red' : t.priority === 'low' ? '' : 'amber'}`}>{t.priority}</span>
            <button className="iconBtn" onClick={() => addToCalendar(t)} aria-label="Add to calendar" title="Add to calendar">▦</button>
            <button className="iconBtn" onClick={() => showDialog({
              title: 'Delete task?', body: t.title, confirmLabel: 'Delete', danger: true,
              onConfirm: () => setTasks((prev) => prev.filter((x) => x.id !== t.id)),
            })} aria-label="Delete task">✕</button>
          </div>
        ))}
      </div>
    </AppFrame>
  );
}

function emptyTask(): TaskItem {
  return { id: uid('task'), title: '', notes: '', priority: 'normal', status: 'not-started', category: 'General', createdAt: Date.now() };
}

function TaskEditor({ task, onSave, onCancel, onDelete }: {
  task: TaskItem; onSave: (t: TaskItem) => void; onCancel: () => void; onDelete: (id: string) => void;
}) {
  const [t, setT] = useState(task);
  const [newCat, setNewCat] = useState('');
  const toast = useStore((s) => s.toast);
  return (
    <AppFrame title={task.title ? 'Edit task' : 'New task'} icon="task" actions={<button className="hbtn" onClick={onCancel}>Cancel</button>}>
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div className="fieldLabel">Task</div>
        <Field value={t.title} onChange={(v) => setT({ ...t, title: v })} placeholder="What needs doing?" autoFocus maxLength={100} />
        <div className="fieldLabel">Due date</div>
        <input
          type="date" value={t.due || ''} onChange={(e) => setT({ ...t, due: e.target.value })}
          style={{ background: 'rgba(0,0,0,.28)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 4, padding: '2px 5px', fontSize: 10, colorScheme: 'dark' }}
        />
        <div className="fieldLabel">Priority</div>
        <div className="btnRow">
          {(['low', 'normal', 'high'] as const).map((p) => (
            <button key={p} className={`chip ${t.priority === p ? 'on' : ''}`} onClick={() => setT({ ...t, priority: p })}>{p}</button>
          ))}
        </div>
        <div className="fieldLabel">Status</div>
        <div className="btnRow">
          {STATUSES.map((s) => (
            <button key={s} className={`chip ${t.status === s ? 'on' : ''}`} onClick={() => setT({ ...t, status: s })}>{STATUS_LABEL[s]}</button>
          ))}
        </div>
        <div className="fieldLabel">Category</div>
        <div className="chipRow" style={{ padding: 0 }}>
          {['General', 'Work', 'Home', 'Play'].map((c) => (
            <button key={c} className={`chip ${t.category === c ? 'on' : ''}`} onClick={() => setT({ ...t, category: c })}>{c}</button>
          ))}
          <input
            value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="+ new" inputMode="none"
            style={{ width: 54, fontSize: 9, background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 99, padding: '1px 6px' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && newCat.trim()) { setT({ ...t, category: newCat.trim() }); setNewCat(''); } }}
          />
        </div>
        <div className="fieldLabel">Notes</div>
        <Field value={t.notes} onChange={(v) => setT({ ...t, notes: v })} placeholder="Optional notes" multiline maxLength={800} />
        <div className="btnRow" style={{ marginTop: 'auto', justifyContent: 'flex-end' }}>
          {task.title && <button className="btn danger" onClick={() => onDelete(task.id)}>Delete</button>}
          <button className="btn primary" onClick={() => {
            if (!t.title.trim()) { toast('Add a task title'); return; }
            onSave({ ...t, title: t.title.trim() });
          }}>Save task</button>
        </div>
      </div>
    </AppFrame>
  );
}
