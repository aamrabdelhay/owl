import React, { useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid, downloadBlob } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { Note } from '../../os/types';

export default function MemoApp() {
  const [notes, setNotes] = useCollection<Note>(DB_KEYS.notes, [
    {
      id: 'n-welcome', title: 'Welcome to Memo Pad', category: 'General',
      body: 'Type notes here. Everything is saved to this browser as you go.\n\nTry the search field, and press Menu for export options.\n\nYour notes never leave this device.',
      at: Date.now(), updatedAt: Date.now(),
    },
  ]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [editing, setEditing] = useState<Note | null>(null);
  const showDialog = useStore((s) => s.showDialog);
  const toast = useStore((s) => s.toast);
  const setAppMenu = useStore((s) => s.setAppMenu);

  const categories = useMemo(() => ['All', ...Array.from(new Set(notes.map((n) => n.category || 'General')))], [notes]);
  const filtered = notes
    .filter((n) => (category === 'All' || (n.category || 'General') === category))
    .filter((n) => !query || `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const save = (note: Note) => {
    const exists = notes.some((n) => n.id === note.id);
    setNotes((prev) => (exists ? prev.map((n) => (n.id === note.id ? note : n)) : [{ ...note, at: Date.now() }, ...prev]));
    setEditing(null);
    toast('Note saved');
  };

  React.useEffect(() => {
    setAppMenu({
      title: 'Memo Pad',
      actions: [
        { id: 'new', label: 'New note', icon: 'plus', run: () => setEditing({ id: uid('note'), title: '', body: '', category: 'General', at: Date.now(), updatedAt: Date.now() }) },
        {
          id: 'export', label: 'Export all notes (.txt)', icon: 'download',
          run: () => {
            const text = notes.map((n) => `## ${n.title || 'Untitled'}\n${n.category}\n${new Date(n.updatedAt).toLocaleString()}\n\n${n.body}`).join('\n\n---\n\n');
            downloadBlob(new Blob([text], { type: 'text/plain' }), 'owl-notes.txt');
            toast('Notes exported');
          },
        },
        {
          id: 'exportJson', label: 'Export notes (.json)', icon: 'download',
          run: () => { downloadBlob(new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' }), 'owl-notes.json'); },
        },
        {
          id: 'clear', label: 'Delete all notes', icon: 'trash', danger: true,
          run: () => showDialog({ title: 'Delete all notes?', body: 'Stored only on this device.', confirmLabel: 'Delete all', danger: true, onConfirm: () => setNotes([]) }),
        },
      ],
    });
    return () => setAppMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  if (editing) {
    return (
      <MemoEditor
        note={editing}
        onSave={save}
        onCancel={() => setEditing(null)}
        onDelete={(id) => { setNotes((prev) => prev.filter((n) => n.id !== id)); setEditing(null); toast('Note deleted'); }}
        categories={categories.filter((c) => c !== 'All')}
      />
    );
  }

  return (
    <AppFrame
      title="Memo Pad"
      icon="memo"
      actions={<button className="hbtn" onClick={() => setEditing({ id: uid('note'), title: '', body: '', category: category === 'All' ? 'General' : category, at: Date.now(), updatedAt: Date.now() })}><Icon name="plus" size={9} /> New</button>}
    >
      <div style={{ padding: 5 }}>
        <Field value={query} onChange={setQuery} placeholder="Search notes" autoFocus />
      </div>
      <div className="chipRow" style={{ paddingTop: 0 }}>
        {categories.map((c) => <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}
      </div>
      <div className="appBody">
        {filtered.length === 0 && (
          <div className="empty"><div className="big">📝</div><div>No notes{query ? ' match that search' : ' yet'}.</div></div>
        )}
        {filtered.map((n) => (
          <button key={n.id} className="rowBtn" style={{ alignItems: 'flex-start' }} onClick={() => setEditing(n)}>
            <Icon name="memo" size={12} style={{ marginTop: 2 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, gap: 1 }}>
              <span style={{ fontWeight: 600 }}>{n.title || 'Untitled note'}</span>
              <span className="tiny" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.body.split('\n')[0].slice(0, 60) || '—'}
              </span>
            </div>
            <span className="meta">{new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </button>
        ))}
      </div>
    </AppFrame>
  );
}

function MemoEditor({ note, onSave, onCancel, onDelete, categories }: {
  note: Note; onSave: (n: Note) => void; onCancel: () => void; onDelete: (id: string) => void; categories: string[];
}) {
  const [n, setN] = useState(note);
  const [newCat, setNewCat] = useState('');
  const toast = useStore((s) => s.toast);
  return (
    <AppFrame
      title={note.title ? 'Edit note' : 'New note'}
      icon="memo"
      actions={
        <>
          <button className="hbtn" onClick={onCancel}>Cancel</button>
          <button className="hbtn" onClick={() => onSave({ ...n, updatedAt: Date.now() })}>Save</button>
        </>
      }
    >
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div className="fieldLabel">Title</div>
        <Field value={n.title} onChange={(v) => setN({ ...n, title: v })} placeholder="Note title" autoFocus maxLength={80} />
        <div className="fieldLabel">Category</div>
        <div className="chipRow" style={{ padding: 0 }}>
          {(categories.length ? categories : ['General']).map((c) => (
            <button key={c} className={`chip ${n.category === c ? 'on' : ''}`} onClick={() => setN({ ...n, category: c })}>{c}</button>
          ))}
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="+ new"
            inputMode="none"
            style={{ width: 54, fontSize: 9, background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 99, padding: '1px 6px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCat.trim()) { setN({ ...n, category: newCat.trim() }); setNewCat(''); }
            }}
          />
        </div>
        <div className="fieldLabel">Note · {n.body.length} chars</div>
        <Field value={n.body} onChange={(v) => setN({ ...n, body: v })} placeholder="Write something…" multiline maxLength={20000} style={{ flex: 1, minHeight: 130 }} />
        <div className="btnRow" style={{ justifyContent: 'flex-end' }}>
          {note.title && <button className="btn danger" onClick={() => onDelete(note.id)}>Delete</button>}
          <button
            className="btn primary"
            onClick={() => {
              if (!n.title.trim() && !n.body.trim()) { toast('Write something first'); return; }
              onSave({ ...n, title: n.title.trim() || n.body.trim().slice(0, 24), updatedAt: Date.now() });
            }}
          >Save note</button>
        </div>
      </div>
    </AppFrame>
  );
}
