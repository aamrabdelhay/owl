import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid, formatDuration, downloadBlob } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { VoiceNote } from '../../os/types';
import { tickSound } from '../../os/audio';

/** Voice recorder: MediaRecorder → IndexedDB on this device. Never uploaded. */
export default function VoiceNotesApp() {
  const [notes, setNotes] = useCollection<VoiceNote>(DB_KEYS.voiceNotes);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const toast = useStore((s) => s.toast);
  const showDialog = useStore((s) => s.showDialog);

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  useEffect(() => {
    if (!recording) return;
    const loop = () => {
      if (analyser.current) {
        const data = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteFrequencyData(data);
        setLevel(data.reduce((a, b) => a + b, 0) / data.length / 255);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [recording]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('Recording is not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx.current = new AC();
      const src = audioCtx.current.createMediaStreamSource(stream);
      const a = audioCtx.current.createAnalyser();
      a.fftSize = 64;
      src.connect(a);
      analyser.current = a;
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunks.current, { type: mimeType || 'audio/webm' });
        const duration = elapsed;
        if (blob.size > 0) {
          setNotes((prev) => [
            { id: uid('vn'), name: `Voice ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`, blob, at: Date.now(), duration },
            ...prev,
          ]);
          toast('Voice note saved on this device');
        }
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
      setElapsed(0);
      tickSound(0.4);
    } catch {
      toast('Microphone permission denied or unavailable');
    }
  };

  const stop = () => {
    recorder.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    analyser.current = null;
    setRecording(false);
    tickSound(0.3);
  };

  const play = (note: VoiceNote) => {
    if (playingId === note.id) {
      setPlayingId(null);
      return;
    }
    const url = URL.createObjectURL(note.blob);
    const audio = new Audio(url);
    audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(url); };
    audio.onerror = () => { setPlayingId(null); toast('Could not play that note'); };
    void audio.play().then(() => setPlayingId(note.id)).catch(() => toast('Playback blocked'));
  };

  return (
    <AppFrame
      title="Voice Notes"
      icon="mic"
      actions={<span className="tiny">{notes.length} saved</span>}
      menu={[
        { id: recording ? 'stop' : 'record', label: recording ? 'Stop recording' : 'Start recording', icon: recording ? 'pause' : 'mic', run: () => { if (recording) stop(); else void start(); } },
        { id: 'rename-prompt', label: 'Rename newest note', icon: 'memo', run: () => { const first = notes[notes.length - 1]; if (first) setRenaming({ id: first.id, value: first.name }); } },
        { id: 'storage', label: 'App storage', icon: 'database', run: () => useStore.getState().openApp('files') },
      ]}
    >
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="card" style={{ display: 'grid', gap: 5, placeItems: 'center', padding: 8 }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 40% 35%, var(--panel-3), var(--panel))', position: 'relative' }}>
            <Icon name="mic" size={24} style={{ opacity: recording ? 1 : 0.75 }} />
            {recording && (
              <span
                style={{
                  position: 'absolute', inset: -4, borderRadius: '50%',
                  border: `2px solid rgba(242,88,91,${0.2 + level * 0.8})`,
                  transform: `scale(${1 + level * 0.25})`, transition: 'transform 70ms linear',
                }}
              />
            )}
          </div>
          <div className="mono" style={{ fontSize: 17, fontFamily: 'var(--font-display)' }}>{formatDuration(elapsed)}</div>
          <button className={`btn ${recording ? 'danger' : 'primary'}`} onClick={recording ? stop : start}>
            {recording ? '■ Stop recording' : '● Start recording'}
          </button>
          <div className="tiny" style={{ textAlign: 'center', maxWidth: 280 }}>
            Recordings are saved to this browser's IndexedDB. They never leave your device.
          </div>
        </div>

        {notes.length === 0 && <div className="empty"><div className="tiny">No voice notes yet.</div></div>}
        {notes.map((n) => (
          <div key={n.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {renaming?.id === n.id ? (
              <>
                <Field value={renaming.value} onChange={(v) => setRenaming({ id: n.id, value: v })} autoFocus maxLength={40} onSubmit={() => {
                  setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, name: renaming.value || x.name } : x)));
                  setRenaming(null);
                }} />
                <button className="btn primary" onClick={() => {
                  setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, name: renaming.value || x.name } : x)));
                  setRenaming(null);
                }}>OK</button>
              </>
            ) : (
              <>
                <button className="rowBtn" style={{ flex: 1 }} onClick={() => play(n)}>
                  <Icon name={playingId === n.id ? 'pause' : 'play'} size={11} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{n.name}</span>
                  <span className="meta">{formatDuration(n.duration || 0)}</span>
                </button>
                <button className="iconBtn" onClick={() => setRenaming({ id: n.id, value: n.name })} aria-label="Rename">✎</button>
                <button className="iconBtn" onClick={() => downloadBlob(n.blob, `${n.name}.webm`)} aria-label="Export">⤓</button>
                <button
                  className="iconBtn"
                  onClick={() => showDialog({
                    title: 'Delete voice note?', body: 'This cannot be undone.', confirmLabel: 'Delete', danger: true,
                    onConfirm: () => setNotes((prev) => prev.filter((x) => x.id !== n.id)),
                  })}
                  aria-label="Delete"
                >✕</button>
              </>
            )}
          </div>
        ))}
      </div>
    </AppFrame>
  );
}
