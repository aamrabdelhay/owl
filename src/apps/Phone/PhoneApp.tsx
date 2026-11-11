import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { CallLogEntry, Contact } from '../../os/types';
import { formatDuration } from '../../hooks';
import { Icon as I } from '../../components/Icon';
import { errorBuzz, playRingtone, stopRingtone, vibrate } from '../../os/audio';
import { registerAppKeys } from '../../os/kernel';
import { Field } from '../../components/Field';
import { askGemini } from '../../os/ai';

type View = 'dial' | 'log' | 'contacts';

export default function PhoneApp({ tab, number: initialNumber, activeCall, aiStart }: { tab?: View; number?: string; activeCall?: boolean; aiStart?: boolean }) {
  const [view, setView] = useState<View>(tab || 'dial');
  const [number, setNumber] = useState(initialNumber || '');
  const [callState, setCallState] = useState<'idle' | 'dialing' | 'active'>(activeCall ? 'active' : 'idle');
  const [callSeconds, setCallSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [aiOpen, setAiOpen] = useState(!!aiStart);
  const [aiDraft, setAiDraft] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [log, setLog] = useCollection<CallLogEntry>(DB_KEYS.callLog);
  const [contacts] = useCollection<Contact>(DB_KEYS.contacts);
  const settings = useStore((s) => s.settings);
  const showDialog = useStore((s) => s.showDialog);
  const toast = useStore((s) => s.toast);
  const refreshCounters = useStore((s) => s.refreshCounters);
const timer = useRef<number | undefined>(undefined);

  const sendAiMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || aiBusy) return;
    if (!settings.geminiApiKey) { toast('Add a Gemini API key in Settings → AI & online services'); return; }
    const next = [...aiMessages, { role: 'user' as const, text }];
    setAiMessages(next);
    setAiDraft('');
    setAiBusy(true);
    try {
      const answer = await askGemini(
        settings.geminiApiKey,
        next,
        'You are the other person in a friendly, fictional phone conversation inside the OWL phone simulator. Reply naturally and briefly. This is a simulated conversation, not a real phone call.'
      );
      setAiMessages((prev) => [...prev, { role: 'model', text: answer }]);
      if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer)); } catch { /* voice is optional */ }
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Gemini call assistant failed');
    } finally {
      setAiBusy(false);
    }
  };

  const startAiSpeech = () => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) { toast('Voice input is not supported here — type your message instead'); return; }
    const recognition = new Speech();
    recognition.lang = settings.language === 'ar' ? 'ar-EG' : 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => setAiDraft(String(event.results?.[0]?.[0]?.transcript || ''));
    recognition.onerror = () => toast('Microphone input failed — check permission');
    try { recognition.start(); } catch { toast('Could not start microphone'); }
  };


  const known = useMemo(
    () => contacts.find((c) => c.phone.replace(/\s/g, '') === number.replace(/\s/g, '')),
    [contacts, number]
  );

  const aiIntroStarted = useRef(false);
  useEffect(() => {
    if (callState !== 'active') {
      if (callState === 'idle' || callState === 'dialing') aiIntroStarted.current = false;
      return;
    }
    const shouldStart = Boolean(aiStart || settings.aiAutoAnswer);
    if (!shouldStart || !settings.geminiApiKey || aiIntroStarted.current) return;
    aiIntroStarted.current = true;
    setAiOpen(true);
    void sendAiMessage('You have answered a simulated phone call. Greet me naturally and begin a short, friendly conversation.');
    // This is an OWL simulation; the browser does not place or answer carrier calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, aiStart, settings.aiAutoAnswer, settings.geminiApiKey]);

  useEffect(() => {
    if (callState !== 'active') return;
    timer.current = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer.current);
  }, [callState]);

  useEffect(() => {
    if (callState === 'dialing') {
      playRingtone(settings.ringtone, 0.25);
      if (settings.vibrate) vibrate([300, 400]);
      const t = window.setTimeout(() => {
        stopRingtone();
        setCallState('active');
        setCallSeconds(0);
      }, 2600);
      return () => { window.clearTimeout(t); stopRingtone(); };
    }
    if (callState === 'idle') stopRingtone();
  }, [callState, settings.ringtone, settings.vibrate]);

  useEffect(() => {
    const off = registerAppKeys((e) => {
      if (e.key.length === 1 && /[0-9*+#]/.test(e.key) && callState === 'idle') {
        setView('dial');
        setNumber((n) => (n.length < 18 ? n + e.key : n));
        return true;
      }
      if (e.key === 'Backspace' && callState === 'idle' && !useStore.getState().activeFieldId) {
        setNumber((n) => n.slice(0, -1));
        return true;
      }
      return false;
    });
    return off;
  }, [callState]);

  const placeCall = () => {
    if (!number) { errorBuzz(); toast('Enter a number first'); return; }
    setView('dial');
    setCallState('dialing');
    setLog([
      { id: uid('call'), number, name: known ? `${known.firstName} ${known.lastName}` : undefined, type: 'out', at: Date.now(), duration: 0 },
      ...log,
    ]);
  };

  const endCall = () => {
    const duration = callSeconds;
    setCallState('idle');
    setCallSeconds(0);
    stopRingtone();
    if (duration > 0) {
      setLog((prev) => {
        const copy = [...prev];
        if (copy[0]) copy[0] = { ...copy[0], duration };
        return copy;
      });
      toast(`Call ended · ${formatDuration(duration)}`);
    }
    setMuted(false);
    setSpeaker(false);
    void refreshCounters();
  };

  const telLink = () => {
    if (!number) return;
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) { toast('Real calls need a phone — this is a simulator'); return; }
    showDialog({
      title: 'Open the dialer?',
      body: `This will leave the simulator and hand <strong>${number}</strong> to your device's dialer.`,
      confirmLabel: 'Open dialer',
      onConfirm: () => { window.location.href = `tel:${number.replace(/[^0-9+*#]/g, '')}`; },
    });
  };

  const press = (d: string) => {
    setNumber((n) => (n.length < 18 ? n + d : n));
  };

  const speedDial = (digit: string) => {
    const contact = contacts.find((c) => c.speedDial === Number(digit));
    if (contact) {
      setNumber(contact.phone);
      setTimeout(() => setCallState('dialing'), 120);
    } else {
      toast(`Speed dial ${digit} is empty — assign it in Contacts`);
    }
  };

  /* -------------------------------- call UI -------------------------------- */
  if (callState !== 'idle') {
    return (
      <div className="appFrame" style={{ background: 'linear-gradient(180deg,#0b1a2c,#050a12)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, color: '#fff' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(160deg,#2b4460,#101a28)', display: 'grid', placeItems: 'center', border: '1px solid #2f4a6b' }}>
            <Icon name="contacts" size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{known ? `${known.firstName} ${known.lastName}` : number || 'Unknown'}</div>
          <div className="tiny" style={{ color: '#9fb4d0' }}>
            {callState === 'dialing' ? 'Calling…' : formatDuration(callSeconds)}
          </div>
          <div className="tiny" style={{ color: '#6f86a3', fontSize: 8 }}>Simulated call — no network is used</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className={`btn ${muted ? 'primary' : ''}`} onClick={() => setMuted((m) => !m)} style={{ fontSize: 9 }}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button className={`btn ${speaker ? 'primary' : ''}`} onClick={() => setSpeaker((s) => !s)} style={{ fontSize: 9 }}>
              Speaker
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button className={`btn ${aiOpen ? 'primary' : ''}`} onClick={() => setAiOpen((v) => !v)} disabled={!settings.geminiApiKey}>
              AI assistant
            </button>
          </div>
          {aiOpen && (
            <div className="card" style={{ width: 'min(94%, 340px)', padding: 6, display: 'grid', gap: 4 }}>
              <div className="tiny">Gemini conversation · simulated call only</div>
              <div style={{ maxHeight: 92, overflow: 'auto', display: 'grid', gap: 3 }}>
                {aiMessages.map((m, i) => (
                  <div key={i} style={{ padding: '3px 5px', borderRadius: 5, fontSize: 9, background: m.role === 'user' ? 'var(--panel-2)' : 'var(--panel-3)', textAlign: m.role === 'user' ? 'right' : 'left' }}>
                    {m.text}
                  </div>
                ))}
                {aiBusy && <div className="tiny">Gemini is replying…</div>}
              </div>
              <Field value={aiDraft} onChange={setAiDraft} placeholder="Talk to the AI..." onSubmit={() => void sendAiMessage(aiDraft)} />
              <div className="btnRow">
                <button className="btn" onClick={startAiSpeech}>Speak</button>
                <button className="btn primary" disabled={!aiDraft.trim() || aiBusy} onClick={() => void sendAiMessage(aiDraft)}>Send</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: 8, display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn danger"
            style={{ padding: '6px 22px', borderRadius: 99, fontSize: 11 }}
            onClick={callState === 'dialing' ? () => { setCallState('idle'); stopRingtone(); toast('Call cancelled'); } : endCall}
          >
            <Icon name="phoneOff" size={12} /> End call
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppFrame
      title="Phone"
      icon="phone"
      actions={
        <>
          <button className="hbtn" onClick={telLink} title="Use this device's dialer"><Icon name="phone" size={9} /> tel:</button>
          <button className="hbtn" onClick={() => useStore.getState().setAppMenu({
            title: 'Phone',
            actions: [
              { id: 'dial', label: 'Dial pad', icon: 'phone', run: () => setView('dial') },
              { id: 'log', label: 'Call log', icon: 'list', run: () => setView('log') },
              { id: 'contacts', label: 'Contacts', icon: 'contacts', run: () => setView('contacts') },
              { id: 'clear', label: 'Clear call log', icon: 'trash', danger: true, run: () => showDialog({ title: 'Clear call log?', body: 'All call history will be removed from this device.', confirmLabel: 'Clear', danger: true, onConfirm: () => setLog([]) }) },
            ],
          })}>Menu</button>
        </>
      }
    >
      <div className="owlTabBar">
        <button className={`owlTab ${view === 'dial' ? 'active' : ''}`} onClick={() => setView('dial')}>Dial pad</button>
        <button className={`owlTab ${view === 'log' ? 'active' : ''}`} onClick={() => setView('log')}>Call log</button>
        <button className={`owlTab ${view === 'contacts' ? 'active' : ''}`} onClick={() => setView('contacts')}>Contacts</button>
      </div>
      <div className="appBody">
        {view === 'dial' && (
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ flex: 1, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="field" style={{ fontSize: 15, letterSpacing: '0.06em', justifyContent: 'center', minHeight: 28 }} aria-label="Number">
                {number || <span style={{ opacity: 0.4, fontSize: 11 }}>Type a number<br />numbers row or keypad</span>}
                <span className="caret" />
              </div>
              {known && <div className="tiny" style={{ textAlign: 'center' }}>{known.firstName} {known.lastName}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginTop: 2 }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                  <button
                    key={d}
                    className="btn"
                    style={{ height: 25, fontSize: 14, fontFamily: 'var(--font-display)' }}
                    onClick={() => press(d)}
                    onContextMenu={(e) => { e.preventDefault(); speedDial(d); }}
                    onDoubleClick={() => speedDial(d)}
                    title={`Press for ${d} · double-press speed dial${d !== '*' && d !== '#' && d !== '0' && d !== '1' ? ' (hold 2–9)' : ''}`}
                    aria-label={`Digit ${d}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setNumber('')}>Clear</button>
                <button
                  className="btn primary"
                  style={{ flex: 2, background: 'linear-gradient(180deg,#6ff0b0,#2fbf71)', color: '#03200f' }}
                  onClick={placeCall}
                  aria-label="Call"
                >
                  <I name="phone" size={11} /> Call
                </button>
                <button className="btn" style={{ width: 32 }} onClick={() => setNumber((n) => n.slice(0, -1))} aria-label="Backspace">⌫</button>
              </div>
              <div className="tiny" style={{ textAlign: 'center', fontSize: 8 }}>
                Calls are simulated. Double-press 2–9 for speed dial.
              </div>
            </div>
          </div>
        )}

        {view === 'log' && (
          <div>
            <div className="owlSection">Recent calls · {log.length}</div>
            {log.length === 0 && (
              <div className="empty"><div className="big">☎</div><div>No calls yet.<br />Dial someone from the dial pad.</div></div>
            )}
            {log.map((entry) => (
              <button
                key={entry.id}
                className="rowBtn"
                onClick={() => { setNumber(entry.number); setView('dial'); }}
              >
                <Icon
                  name={entry.type === 'missed' ? 'phoneOff' : 'phone'}
                  size={12}
                  style={{ color: entry.type === 'missed' ? 'var(--red)' : entry.type === 'in' ? 'var(--green)' : 'var(--muted)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600 }}>{entry.name || entry.number}</span>
                  <span className="tiny">
                    {entry.type === 'missed' ? 'Missed' : entry.type === 'in' ? 'Received' : 'Dialed'} ·{' '}
                    {new Date(entry.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="meta">{entry.duration ? formatDuration(entry.duration) : ''}</span>
              </button>
            ))}
            {log.length > 0 && (
              <div style={{ padding: 6 }}>
                <button className="btn" onClick={() => showDialog({ title: 'Clear call log?', body: 'Removes all call history.', confirmLabel: 'Clear', danger: true, onConfirm: () => setLog([]) })}>
                  Clear log
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'contacts' && (
          <div>
            {contacts.length === 0 && <div className="empty"><div className="big">👤</div><div>No contacts yet.</div></div>}
            {contacts.map((c) => (
              <button key={c.id} className="rowBtn" onClick={() => { setNumber(c.phone); setView('dial'); }}>
                <Icon name="contacts" size={12} />
                <span>{c.firstName} {c.lastName}</span>
                <span className="meta">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppFrame>
  );
}
