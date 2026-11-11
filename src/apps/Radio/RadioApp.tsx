import React, { useEffect, useRef, useState } from 'react';
import { useLocalStorageState } from '../../hooks';
import { useStore } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';

/** Owl Radio: plays any CORS-friendly stream URL the user provides. */
export default function RadioApp() {
  const [url, setUrl] = useState('');
  const [stations, setStations] = useLocalStorageState<{ name: string; url: string }[]>('owl:radio-stations', []);
  const [playing, setPlaying] = useState(false);
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useLocalStorageState<number>('owl:radio-volume', 0.8);
  const toast = useStore((s) => s.toast);
  const setNowPlaying = useStore((s) => s.setNowPlaying);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const play = async (streamUrl: string, label?: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setFailed(false);
    audio.src = streamUrl;
    try {
      await audio.play();
      setPlaying(true);
      setName(label || labelFromUrl(streamUrl));
      setNowPlaying({ title: label || 'Owl Radio', playing: true });
    } catch {
      setPlaying(false);
      setFailed(true);
      toast('Stream could not be played — check the URL');
    }
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(false);
    setNowPlaying(null);
  };

  const addStation = () => {
    if (!url.trim()) return;
    const label = url.split('/')[2] || 'Custom stream';
    setStations((prev) => [...prev.filter((s) => s.url !== url), { name: label, url: url.trim() }]);
    setUrl('');
    setExpanded(false);
    toast('Station saved');
  };

  return (
    <AppFrame
      title="Owl Radio"
      icon="radio"
      actions={<button className="hbtn" onClick={() => setExpanded((v) => !v)}>{expanded ? 'Hide' : 'Add stream'}</button>}
      menu={[
        { id: 'add', label: 'Add a stream', icon: 'plus', run: () => setExpanded(true) },
        { id: 'stop', label: 'Stop playback', icon: 'pause', run: stop },
        { id: 'music', label: 'Open local music', icon: 'music', run: () => useStore.getState().openApp('music') },
      ]}
    >
      <audio ref={audioRef} preload="none" />
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'grid', placeItems: 'center', gap: 5, padding: 6 }}>
          <div
            style={{
              width: 92, height: 92, borderRadius: '50%',
              background: 'conic-gradient(from 0deg, #38b6a4, #0b2a2f, #38b6a4)',
              display: 'grid', placeItems: 'center',
              animation: playing ? 'spin 6s linear infinite' : undefined,
              border: '1px solid var(--line)',
            }}
            aria-hidden="true"
          >
            <span style={{ width: 62, height: 62, borderRadius: '50%', background: 'var(--panel)', display: 'grid', placeItems: 'center' }}>
              <Icon name="radio" size={28} />
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{name || 'No station tuned'}</div>
          <div className="tiny">{playing ? 'Live stream' : 'Stopped'}</div>
          <div className="btnRow" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={playing ? stop : () => play(stations[0]?.url || url || '', stations[0]?.name)}>
              <Icon name={playing ? 'pause' : 'play'} size={10} /> {playing ? 'Stop' : 'Play'}
            </button>
          </div>
        </div>

        {failed && (
          <div className="card tiny">
            That stream would not play. Many stations block direct browser playback (CORS or codec
            issues). Try an <b>.mp3</b> or <b>.m3u8</b> HLS-free stream.
          </div>
        )}

        {expanded && (
          <div className="card" style={{ display: 'grid', gap: 4 }}>
            <div className="fieldLabel">Stream URL</div>
            <Field value={url} onChange={setUrl} placeholder="https://example.com/stream.mp3" autoFocus maxLength={300} onSubmit={addStation} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn primary" onClick={addStation}>Save station</button>
              <button className="btn" onClick={() => void play(url)}>Play now</button>
            </div>
            <div className="tiny">Nothing is proxied: the browser fetches the stream directly from its host.</div>
          </div>
        )}

        <div className="owlSection">Saved stations</div>
        {stations.length === 0 && <div className="tiny">Add any MP3/OGG stream URL you have the right to listen to.</div>}
        {stations.map((s) => (
          <button key={s.url} className="rowBtn" onClick={() => void play(s.url, s.name)}>
            <Icon name="radio" size={12} />
            <span>{s.name}</span>
            <span className="meta">Play</span>
          </button>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="volume" size={11} />
          <input type="range" min={0} max={1} step={0.02} value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--hl)' }} inputMode="none" aria-label="Volume" />
        </div>
      </div>
    </AppFrame>
  );
}

function labelFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Custom stream';
  }
}
