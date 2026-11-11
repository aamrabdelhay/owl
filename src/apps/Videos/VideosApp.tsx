import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useLocalStorageState, formatDuration, uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { pickFiles, isVideo } from '../../os/media';
import { registerAppKeys } from '../../os/kernel';

interface VideoItem {
  id: string;
  name: string;
  url: string;
  file: File;
  size: number;
}

/** Video player: files stream from the user's device only. */
export default function VideosApp() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [active, setActive] = useState<VideoItem | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [positions, setPositions] = useLocalStorageState<Record<string, number>>('owl:video-positions', {});
  const [volume, setVolume] = useLocalStorageState<number>('owl:video-volume', 0.9);
  const toast = useStore((s) => s.toast);

  const add = async () => {
    const picked = await pickFiles('video/*', true, false);
    const items = picked.filter(isVideo).map((p) => ({
      id: uid('vid'), name: p.name, url: URL.createObjectURL(p.file), file: p.file, size: p.size,
    }));
    if (!items.length) { if (picked.length) toast('No video files selected'); return; }
    setVideos((prev) => [...prev, ...items]);
    toast(`Added ${items.length} video${items.length > 1 ? 's' : ''}`);
  };

  const openVideo = (v: VideoItem) => {
    setActive(v);
    setPlaying(false);
    window.setTimeout(() => {
      const el = videoRef.current;
      if (!el) return;
      el.currentTime = positions[v.id] || 0;
      el.playbackRate = speed;
      void el.play().then(() => setPlaying(true)).catch(() => {});
    }, 120);
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = volume;
    el.playbackRate = speed;
  }, [volume, speed, active]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !active) return;
    const save = () => setPositions((prev) => ({ ...prev, [active.id]: el.currentTime }));
    el.addEventListener('timeupdate', () => setPosition(el.currentTime));
    el.addEventListener('loadedmetadata', () => setDuration(el.duration));
    el.addEventListener('pause', save);
    const int = window.setInterval(save, 5000);
    return () => { save(); window.clearInterval(int); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const off = registerAppKeys((e) => {
      if (!active) return false;
      const el = videoRef.current;
      if (!el) return false;
      if (e.key === ' ') { if (el.paused) { void el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); } return true; }
      if (e.key === 'ArrowRight') { el.currentTime = Math.min(el.duration || 0, el.currentTime + 5); return true; }
      if (e.key === 'ArrowLeft') { el.currentTime = Math.max(0, el.currentTime - 5); return true; }
      return false;
    });
    return off;
  }, [active]);

  const pickSubtitle = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vtt,.srt,text/vtt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      let text = await file.text();
      if (/\.srt$/i.test(file.name)) text = srtToVtt(text);
      const url = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
      setSubtitleUrl(url);
      setSubName(file.name);
      toast(`Subtitles loaded: ${file.name}`);
    };
    input.click();
  };

  if (active) {
    return (
      <AppFrame
        title={active.name}
        icon="video"
        actions={<button className="hbtn" onClick={() => { setActive(null); setPlaying(false); setSubtitleUrl(null); }}>Library</button>}
        menu={[
          { id: 'library', label: 'Back to library', icon: 'list', run: () => { setActive(null); setPlaying(false); setSubtitleUrl(null); } },
          { id: 'subs', label: 'Load subtitles', icon: 'memo', run: () => pickSubtitle() },
          { id: 'speed', label: 'Next speed', icon: 'play', run: () => setSpeed((s) => (s >= 2 ? 0.5 : +(s + 0.25).toFixed(2))) },
          { id: 'brightness', label: 'Reset brightness', icon: 'sun', run: () => setBrightness(1) },
        ]}
      >
        <div style={{ flex: 1, background: '#000', position: 'relative', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            src={active.url}
            controls={false}
            playsInline
            crossOrigin="anonymous"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) { void el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
            }}
            style={{ maxWidth: '100%', maxHeight: '100%', filter: `brightness(${brightness})`, background: '#000' }}
          >
            {subtitleUrl && <track kind="subtitles" src={subtitleUrl} default label="Subtitles" />}
          </video>
          {!playing && (
            <button
              onClick={() => { const el = videoRef.current; if (el) { void el.play(); setPlaying(true); } }}
              aria-label="Play video"
              style={{ position: 'absolute', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,.5)', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              <Icon name="play" size={18} />
            </button>
          )}
        </div>
        <div style={{ padding: '3px 6px', borderTop: '1px solid var(--line)' }}>
          <div className="progress" style={{ height: 3 }}><i style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }} className="tiny">
            <span>{formatDuration(position)}</span><span>{formatDuration(duration)}</span>
          </div>
          <input
            type="range" min={0} max={duration || 0} value={position} step={0.5}
            onChange={(e) => { const v = Number(e.target.value); setPosition(v); if (videoRef.current) videoRef.current.currentTime = v; }}
            style={{ width: '100%', accentColor: 'var(--hl)' }} aria-label="Seek" inputMode="none"
          />
          <div className="btnRow" style={{ alignItems: 'center' }}>
            <button className="btn" onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) { void el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
            }}>{playing ? 'Pause' : 'Play'}</button>
            <button className="btn" onClick={() => { setSpeed(speed === 2 ? 0.5 : speed === 0.5 ? 1 : speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1); }}>{speed}×</button>
            <button className="btn" onClick={pickSubtitle}>{subName ? 'Subs ✓' : 'Subtitles'}</button>
            <button className="btn" onClick={() => setBrightness((b) => (b >= 1.4 ? 0.7 : +(b + 0.15).toFixed(2)))}>☀ {Math.round(brightness * 100)}%</button>
            <button
              className="btn"
              onClick={() => {
                const el = videoRef.current as any;
                if (!el) return;
                if (el.requestFullscreen) void el.requestFullscreen();
                else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
                else toast('Fullscreen is not supported here');
              }}
            >Full</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
              <Icon name="volume" size={10} />
              <input type="range" min={0} max={1} step={0.02} value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--hl)' }} aria-label="Volume" inputMode="none" />
            </div>
          </div>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame
      title="Videos"
      icon="video"
      actions={<button className="hbtn" onClick={() => void add()}><Icon name="plus" size={9} /> Add</button>}
      menu={[
        { id: 'add', label: 'Add videos', icon: 'plus', run: () => { void add(); } },
        { id: 'pictures', label: 'Open Pictures', icon: 'image', run: () => useStore.getState().openApp('pictures') },
        { id: 'flip', label: 'Open Owl Web', icon: 'globe', run: () => useStore.getState().openApp('web') },
      ]}
    >
      <div className="appBody">
        {videos.length === 0 ? (
          <div className="empty">
            <div className="big">🎬</div>
            <div><b>Play videos from this device</b></div>
            <div className="tiny" style={{ maxWidth: 300 }}>
              Everything plays locally through object URLs. Nothing is uploaded, and playback
              positions are remembered per file.
            </div>
            <button className="btn primary" onClick={() => void add()}>Pick video files</button>
          </div>
        ) : (
          <>
            <div className="owlSection">{videos.length} video{videos.length > 1 ? 's' : ''} · local only</div>
            {videos.map((v) => (
              <button key={v.id} className="rowBtn" onClick={() => openVideo(v)}>
                <Icon name="video" size={13} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 230 }}>{v.name}</span>
                  <span className="tiny">{positions[v.id] ? `Resume at ${formatDuration(positions[v.id])}` : 'Not started'}</span>
                </div>
                <span className="meta">{(v.size / 1024 / 1024).toFixed(1)} MB</span>
              </button>
            ))}
          </>
        )}
      </div>
    </AppFrame>
  );
}

function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, '')
    .replace(/^\d+\n/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body}`;
}
