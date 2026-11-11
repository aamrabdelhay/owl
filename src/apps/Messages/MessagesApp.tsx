import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { SmsMessage, SmsThread, Contact } from '../../os/types';
import { messageTone } from '../../os/audio';
import { askGemini } from '../../os/ai';

const SEED_THREADS: SmsThread[] = [
  { id: 'th-welcome', address: 'OWL', name: 'OWL Team', updatedAt: Date.now() - 60000 },
  { id: 'th-sam', address: '+1 555 0142', name: 'Sam Rivera', updatedAt: Date.now() - 3600000 },
];

const SEED_MESSAGES: SmsMessage[] = [
  {
    id: 'msg-w1', threadId: 'th-welcome', address: 'OWL', direction: 'in', read: false,
    body: 'Welcome to OWL! 🦉 Your phone is running locally in this browser — nothing you type leaves the device. Press Menu for apps, or hold any letter on the home screen to open its hotkey.',
    at: Date.now() - 60000, status: 'delivered',
  },
  {
    id: 'msg-s1', threadId: 'th-sam', address: '+1 555 0142', direction: 'in', read: true,
    body: 'Hey! Did the new Owl Snake update add the golden mouse?',
    at: Date.now() - 7200000, status: 'delivered',
  },
  {
    id: 'msg-s2', threadId: 'th-sam', address: '+1 555 0142', direction: 'out', read: true,
    body: 'Yes — golden mice give bonus points and a short speed boost. Baby owlets follow you now too.',
    at: Date.now() - 3600000, status: 'delivered',
  },
];

type Folder = 'inbox' | 'sent' | 'drafts';

export default function MessagesApp({ threadId }: { threadId?: string }) {
  const [threads, setThreads] = useCollection<SmsThread>(DB_KEYS.smsThreads, SEED_THREADS);
  const [messages, setMessages] = useCollection<SmsMessage>(DB_KEYS.smsMessages, SEED_MESSAGES);
  const [contacts] = useCollection<Contact>(DB_KEYS.contacts);
  const [openThread, setOpenThread] = useState<string | null>(threadId || null);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [composeTo, setComposeTo] = useState('');
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const settings = useStore((s) => s.settings);
  const showDialog = useStore((s) => s.showDialog);
  const toast = useStore((s) => s.toast);
  const refreshCounters = useStore((s) => s.refreshCounters);

  useEffect(() => {
    void refreshCounters();
  }, [messages.length, refreshCounters]);

  useEffect(() => {
    if (threadId) setOpenThread(threadId);
  }, [threadId]);

  const threadMessages = useMemo(
    () => messages.filter((m) => m.threadId === openThread).sort((a, b) => a.at - b.at),
    [messages, openThread]
  );

  const thread = threads.find((t) => t.id === openThread);

  const markRead = (tid: string) => {
    setMessages((prev) => prev.map((m) => (m.threadId === tid ? { ...m, read: true } : m)));
  };

  const open = (tid: string) => {
    setOpenThread(tid);
    markRead(tid);
    void refreshCounters();
  };

  const displayName = (t: SmsThread) => {
    const contact = contacts.find((c) => c.phone.replace(/\D/g, '') === t.address.replace(/\D/g, '') && t.address !== 'OWL');
    return t.name || (contact ? `${contact.firstName} ${contact.lastName}` : t.address);
  };

  const send = (body: string, address: string, tid?: string) => {
    if (!body.trim()) return;
    const id = tid || `th-${address.replace(/\W/g, '') || Date.now()}`;
    if (!threads.find((t) => t.id === id)) {
      setThreads((prev) => [{ id, address, updatedAt: Date.now() }, ...prev]);
    }
    setMessages((prev) => [
      ...prev,
      {
        id: uid('msg'), threadId: id, address, body: body.trim(), direction: 'out',
        status: 'sent', read: true, at: Date.now(),
      },
    ]);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, updatedAt: Date.now() } : t)));
    setReply('');
    setDraft('');
    setComposing(false);
    setOpenThread(id);
    if (settings.profile !== 'silent') messageTone(settings.messageTone, 0.4);
    // simulated delivery receipt
    window.setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.direction === 'out' && m.threadId === id && m.status === 'sent' ? { ...m, status: 'delivered' } : m)));
    }, 1400);
    if (address === 'OWL') {
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: uid('msg'), threadId: id, address, direction: 'in', read: true, at: Date.now(), status: 'delivered',
            body: '🦉 Message received. This inbox is local — replies here are simulated.',
          },
        ]);
      }, 2200);
    }
    // Optional local AI auto-reply. This is a simulated recipient, not a real SMS network.
    if (settings.aiAutoReply && settings.geminiApiKey && address !== 'OWL') {
      const context = messages.filter((m) => m.threadId === id).slice(-8);
      void askGemini(
        settings.geminiApiKey,
        [...context.map((m) => ({ role: m.direction === 'out' ? 'user' as const : 'model' as const, text: m.body })), { role: 'user' as const, text: body.trim() }],
        'You are replying as the person receiving a simulated SMS on an old mobile phone. Keep replies natural, concise, and conversational. Never claim this is a real phone number or real carrier SMS.'
      ).then((answer) => {
        setMessages((prev) => [...prev, {
          id: uid('msg'), threadId: id, address, body: answer, at: Date.now(),
          direction: 'in', status: 'delivered', read: true,
        }]);
        setThreads((prev) => prev.map((t) => t.id === id ? { ...t, updatedAt: Date.now() } : t));
        if (settings.profile !== 'silent') messageTone(settings.messageTone, 0.35);
      }).catch((error) => {
        toast(error instanceof Error ? error.message : 'AI SMS reply failed');
      });
    }
  };

  const saveDraft = () => {
    if (!draft.trim()) return;
    const id = `th-${composeTo.replace(/\W/g, '') || 'draft'}`;
    setMessages((prev) => [
      ...prev,
      { id: uid('draft'), threadId: id, address: composeTo || 'Draft', direction: 'out', body: draft, at: Date.now(), status: 'draft', read: true },
    ]);
    toast('Saved to drafts');
    setDraft('');
    setComposing(false);
  };

  /* ------------------------------- thread view ------------------------------- */
  if (openThread && thread) {
    const len = reply.length;
    const segments = Math.max(1, Math.ceil(len / 160));
    return (
      <AppFrame
        title={displayName(thread)}
        icon="message"
        actions={
          <>
            <button className="hbtn" onClick={() => showDialog({
              title: 'Delete conversation?',
              body: `All messages with ${displayName(thread)} will be removed.`,
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => {
                setMessages((prev) => prev.filter((m) => m.threadId !== thread.id));
                setThreads((prev) => prev.filter((t) => t.id !== thread.id));
                setOpenThread(null);
              },
            })} aria-label="Delete conversation">
              <Icon name="trash" size={9} />
            </button>
            <button className="hbtn" onClick={() => { setOpenThread(null); void refreshCounters(); }}>Back</button>
          </>
        }
      >
        <div className="appBody" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {threadMessages.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '78%', padding: '4px 7px', borderRadius: 8, fontSize: 10.5, lineHeight: 1.4,
                    background: m.direction === 'out' ? 'linear-gradient(180deg,var(--hl-2),var(--hl))' : 'var(--panel-2)',
                    color: m.direction === 'out' ? 'var(--hl-text)' : 'var(--text)',
                    border: '1px solid var(--line)',
                  }}
                >
                  {m.body}
                  <div style={{ fontSize: 7.5, opacity: 0.7, marginTop: 2, textAlign: 'right' }}>
                    {new Date(m.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    {m.direction === 'out' && ` · ${m.status === 'delivered' ? '✓✓' : '✓'}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Field
            value={reply}
            onChange={setReply}
            placeholder="Type a message…"
            autoFocus
            maxLength={1600}
            onSubmit={() => send(reply, thread.address, thread.id)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="tiny" style={{ flex: 1 }}>{len}/160 · {segments} segment{segments > 1 ? 's' : ''}</span>
            <button className="btn primary" onClick={() => send(reply, thread.address, thread.id)}>
              <Icon name="send" size={10} /> Send
            </button>
          </div>
        </div>
      </AppFrame>
    );
  }

  /* ------------------------------- compose view ------------------------------- */
  if (composing) {
    const len = draft.length;
    const segments = Math.max(1, Math.ceil(len / 160));
    return (
      <AppFrame
        title="New message"
        icon="message"
        actions={<button className="hbtn" onClick={() => { setComposing(false); setDraft(''); }}>Cancel</button>}
      >
        <div className="appBody" style={{ padding: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="fieldLabel">To</div>
          <Field value={composeTo} onChange={setComposeTo} placeholder="Phone number" kind="phone" autoFocus maxLength={24} />
          <div className="chipRow" style={{ padding: '3px 0' }}>
            {contacts.slice(0, 5).map((c) => (
              <button key={c.id} className="chip" onClick={() => setComposeTo(c.phone)}>
                {c.firstName}
              </button>
            ))}
            <button className="chip" onClick={() => setComposeTo('OWL')}>OWL Team</button>
          </div>
          <div className="fieldLabel">Message</div>
          <Field value={draft} onChange={setDraft} placeholder="Write your message…" multiline maxLength={1600} />
          <div className="tiny">{len}/160 characters · {segments} SMS segment{segments > 1 ? 's' : ''}</div>
          <div className="btnRow" style={{ marginTop: 'auto', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={saveDraft}>Save draft</button>
            <button className="btn primary" onClick={() => send(draft, composeTo || 'Unknown')} disabled={!composeTo.trim()}>
              <Icon name="send" size={10} /> Send
            </button>
          </div>
        </div>
      </AppFrame>
    );
  }

  /* -------------------------------- list view -------------------------------- */
  const searched = messages.filter((m) => {
    if (folder === 'drafts' && m.status !== 'draft') return false;
    if (folder === 'sent' && (m.direction !== 'out' || m.status === 'draft')) return false;
    if (search && !m.body.toLowerCase().includes(search.toLowerCase()) && !m.address.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppFrame
      title="Messages"
      icon="message"
      actions={
        <>
          <button className="hbtn" onClick={() => setComposing(true)}><Icon name="plus" size={9} /> New</button>
          <button className="hbtn" onClick={() => useStore.getState().setAppMenu({
            title: 'Messages',
            actions: [
              { id: 'new', label: 'Compose message', icon: 'plus', run: () => setComposing(true) },
              { id: 'tone', label: 'Message tone setting', icon: 'bell', run: () => useStore.getState().openApp('settings', { section: 'sound' }) },
              { id: 'clear', label: 'Delete all messages', icon: 'trash', danger: true, run: () => showDialog({ title: 'Delete all messages?', body: 'This cannot be undone.', confirmLabel: 'Delete all', danger: true, onConfirm: () => { setMessages([]); setThreads([]); } }) },
            ],
          })}>Menu</button>
        </>
      }
    >
      <div className="owlTabBar">
        {(['inbox', 'sent', 'drafts'] as Folder[]).map((f) => (
          <button key={f} className={`owlTab ${folder === f ? 'active' : ''}`} onClick={() => setFolder(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ padding: '4px 6px' }}>
        <Field value={search} onChange={setSearch} placeholder="Search messages" />
      </div>
      <div className="appBody">
        {folder === 'inbox' && threads
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .filter((t) => {
            if (!search) return true;
            return displayName(t).toLowerCase().includes(search.toLowerCase());
          })
          .map((t) => {
            const last = [...messages].filter((m) => m.threadId === t.id).sort((a, b) => b.at - a.at)[0];
            const unread = messages.filter((m) => m.threadId === t.id && m.direction === 'in' && !m.read).length;
            return (
              <button key={t.id} className="rowBtn" onClick={() => open(t.id)}>
                <Icon name="message" size={13} style={{ color: unread ? 'var(--hl)' : 'var(--muted)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <span style={{ fontWeight: unread ? 700 : 500 }}>{displayName(t)}</span>
                  <span className="tiny" style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {last ? last.body : 'No messages'}
                  </span>
                </div>
                {unread > 0 && <span className="countPill meta">{unread}</span>}
                <span className="meta">{last ? new Date(last.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
              </button>
            );
          })}

        {(folder === 'sent' || folder === 'drafts') && (
          <div>
            {searched.length === 0 && (
              <div className="empty">
                <div className="big">{folder === 'drafts' ? '📝' : '📤'}</div>
                <div>No {folder} messages.</div>
              </div>
            )}
            {searched.map((m) => (
              <button key={m.id} className="rowBtn" onClick={() => { setOpenThread(m.threadId); }}>
                <Icon name="message" size={12} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span>{m.address}</span>
                  <span className="tiny" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body}</span>
                </div>
                <span className="meta">{new Date(m.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppFrame>
  );
}
