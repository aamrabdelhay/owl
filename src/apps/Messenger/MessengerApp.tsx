import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { ChatMessage, ChatThread } from '../../os/types';
import { messageTone } from '../../os/audio';
import { evaluate } from '../../os/expr';

const BOTS: ChatThread[] = [
  {
    id: 'chat-owl', name: 'Owl Assistant', avatar: '🦉', color: '#c9922f',
    messages: [
      { id: 'm1', from: 'them', body: 'Hoot! I am the Owl Assistant. Ask me for a tip, a joke, or type "help".', at: Date.now() - 900000, read: true },
    ],
  },
  {
    id: 'chat-talia', name: 'Talia (bot)', avatar: '🎧', color: '#7c5cff',
    messages: [
      { id: 'm2', from: 'them', body: 'Hey! I make playlists. Ask me about music 🎵', at: Date.now() - 7200000, read: true },
      { id: 'm3', from: 'me', body: 'Favourite retro track?', at: Date.now() - 7100000, read: true },
      { id: 'm4', from: 'them', body: 'Anything synthwave. Try the Ringtones app — all the tones are synthesised live.', at: Date.now() - 7000000, read: true },
    ],
  },
  {
    id: 'chat-milo', name: 'Milo (bot)', avatar: '🎮', color: '#3fa36b',
    messages: [
      { id: 'm5', from: 'them', body: 'High score hunter here. Ask me about games!', at: Date.now() - 86400000 * 2, read: true },
    ],
  },
];

function botReply(name: string, text: string): string {
  const t = text.toLowerCase();
  if (/help|what can/.test(t)) {
    return 'I can share tips, tell a joke, do quick math ("12*8"), check the time, or tell you about any OWL app. Try "tip", "joke", "time", or "snake".';
  }
  if (/time|clock/.test(t)) {
    return `It's ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} on this device. The Clock app has alarms too.`;
  }
  if (/joke|funny|laugh/.test(t)) {
    const jokes = [
      'What do you call an owl with a keyboard? A hoot-and-typer. 🦉',
      'Why did the owl use a trackpad? Its mouse was out of office.',
      'My phone has 42 keys and zero excuses for typos. Still typos.',
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }
  if (/tip|hint/.test(t)) {
    return 'Tip: hold a letter on the home screen to launch its hotkey. Hold Menu for recent apps. Press PageUp/PageDown to change volume.';
  }
  if (/snake|owl snake/.test(t)) {
    return 'Owl Snake: each mouse adds an owlet behind you. Golden mice score 5× and speed you up. Watch that chain!';
  }
  if (/music|song|playlist/.test(t) && name.startsWith('Talia')) {
    return 'Load your own tracks in Music → Add files. The equalizer is a live AnalyserNode, not a gif. 😎';
  }
  if (/game|score|high/.test(t)) {
    return 'Open Games and tap High scores. Nine games, all original, all saved in IndexedDB.';
  }
  const math = text.match(/^([\d\s+\-*/.()%]+)$/);
  if (math) {
    try {
      // safe evaluation via Function is avoided: use the calculator's parser
      const value = evaluate(text);
      return `${text.trim()} = ${value}`;
    } catch {
      return 'I could not parse that equation. Try "12 * 8".';
    }
  }
  if (/hi|hello|hey|hoot/.test(t)) return `Hoot hoot! ${name} here. Ask me anything.`;
  const replies = [
    'Noted! I am a rule-based bot, so my vocabulary is small but my enthusiasm is enormous.',
    'Interesting. Try asking for a "tip" or a "joke".',
    'I only run on this device — no servers, no data leaving your phone.',
    'You can also hold Menu here to open the app menu, or press Back to leave.',
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

export default function MessengerApp() {
  const [threads, setThreads] = useCollection<ChatThread>(DB_KEYS.chats, BOTS);
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState('');
  const settings = useStore((s) => s.settings);
  const showDialog = useStore((s) => s.showDialog);
  const toast = useStore((s) => s.toast);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thread = threads.find((t) => t.id === active);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999 });
  }, [thread?.messages.length, thread?.typing]);

  const send = () => {
    if (!text.trim() || !thread) return;
    const body = text.trim();
    const msg: ChatMessage = { id: uid('cm'), from: 'me', body, at: Date.now(), read: false };
    setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, messages: [...t.messages, msg], typing: true } : t)));
    setText('');
    if (settings.profile !== 'silent') messageTone('soft-chime', 0.35);

    window.setTimeout(() => {
      setThreads((prev) => prev.map((t) => (t.id === thread.id
        ? { ...t, messages: t.messages.map((m) => (m.id === msg.id ? { ...m, read: true } : m)) }
        : t)));
    }, 900);

    window.setTimeout(() => {
      const reply = botReply(thread.name, body);
      setThreads((prev) => prev.map((t) => (t.id === thread.id
        ? {
          ...t,
          typing: false,
          messages: [...t.messages, { id: uid('cm'), from: 'them', body: reply, at: Date.now(), read: true }],
        }
        : t)));
      if (settings.profile !== 'silent') messageTone(settings.messageTone, 0.3);
    }, 1700);
  };

  if (thread) {
    return (
      <AppFrame
        title={thread.name}
        icon="chat"
        actions={
          <button className="hbtn" onClick={() => setActive(null)}>Back</button>
        }
        menu={[
          { id: 'bots', label: 'All bots', icon: 'back', run: () => setActive(null) },
          { id: 'clear', label: 'Clear this chat', icon: 'trash', danger: true, run: () => setThreads((prev) => prev.map((t) => (t.id === thread?.id ? { ...t, messages: [] } : t))) },
        ]}
      >
        <div ref={scrollRef} className="appBody" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="tiny" style={{ textAlign: 'center' }}>Local demo chat · rule-based bot</div>
          {thread.messages.map((m) => (
            <div key={m.id} style={{ display: 'flex', gap: 4, justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
              {m.from === 'them' && (
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: thread.color, display: 'grid', placeItems: 'center', fontSize: 10, flex: 'none' }}>
                  {thread.avatar}
                </span>
              )}
              <div
                style={{
                  maxWidth: '74%', padding: '4px 7px', borderRadius: 8, fontSize: 10.5, lineHeight: 1.4,
                  background: m.from === 'me' ? 'linear-gradient(180deg,#7c5cff,#5b3fe0)' : 'var(--panel-2)',
                  color: m.from === 'me' ? '#fff' : 'var(--text)',
                  border: '1px solid var(--line)',
                }}
              >
                {m.body}
                <div style={{ fontSize: 7.5, opacity: 0.7, marginTop: 2, textAlign: 'right' }}>
                  {new Date(m.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  {m.from === 'me' && (m.read ? ' ✓✓' : ' ✓')}
                </div>
              </div>
            </div>
          ))}
          {thread.typing && (
            <div className="tiny" style={{ paddingLeft: 22 }}>typing<span className="dots">…</span></div>
          )}
        </div>
        <div style={{ padding: 5, borderTop: '1px solid var(--line)', display: 'flex', gap: 4, alignItems: 'center' }}>
          <Field value={text} onChange={setText} placeholder="Message…" autoFocus maxLength={500} onSubmit={send} />
          <button className="btn primary" onClick={send} aria-label="Send"><Icon name="send" size={11} /></button>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame
      title="Owl Messenger"
      icon="chat"
      actions={
        <button className="hbtn" onClick={() => showDialog({
          title: 'Clear all chats?',
          body: 'Your conversation history with the bots will be reset.',
          confirmLabel: 'Reset',
          danger: true,
          onConfirm: () => { setThreads(BOTS); toast('Chats reset'); },
        })}>Menu</button>
      }
    >
      <div className="appBody">
        <div className="owlSection">Chats · fully offline</div>
        {threads.map((t) => {
          const last = t.messages[t.messages.length - 1];
          return (
            <button key={t.id} className="rowBtn" onClick={() => setActive(t.id)}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: t.color, display: 'grid', placeItems: 'center', fontSize: 13, flex: 'none' }}>
                {t.avatar}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span className="tiny" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.typing ? 'typing…' : last?.body}
                </span>
              </div>
              <span className="meta">{last ? new Date(last.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </button>
          );
        })}
        <div className="tiny" style={{ padding: 8, textAlign: 'center' }}>
          Bots reply with simple rules — no network, no accounts.
        </div>
      </div>
    </AppFrame>
  );
}
