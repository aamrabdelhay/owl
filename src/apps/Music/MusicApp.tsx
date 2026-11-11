import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useLocalStorageState, formatDuration, uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { pickFiles, readTags, isAudio, type TrackTags } from '../../os/media';
import { registerAppKeys } from '../../os/kernel';
import { keyClick } from '../../os/audio';

interface Track {
  id: string;
  name: string;
  url: string;
  file: File;
  duration?: number;
  tags?: TrackTags;
}

type RepeatMode = 'off' | 'one' | 'all';

/**
 * Music player. Files only ever come from the user's device via the file
 * picker and are played through object URLs — never uploaded, never stored.
 */
export default function MusicApp() {
  const [library, setLibrary] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [loadingTags, setLoadingTags] = useState(false);
  const [view, setView] = useState<'library' | 'player'>('library');
  const [search, setSearch] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const [volume, setVolume] = useLocalStorageState<number>('owl:music-volume', 0.8);
  const settings = useStore((s) => s.settings);
  const setNowPlaying = useStore((s) => s.setNowPlaying);
  const toast = useStore((s) => s.toast);
  const showDialog = useStore((s) => s.showDialog);
  const track = index >= 0 ? library[index] : null;
  // assigned below (after `play` is defined) so the Menu key can shuffle
  const shuffleAllRef = useRef<() => void>(() => {});
  const shuffleAll = () => shuffleAllRef.current();

  const addFiles = async (directory = false) => {
    const picked = await pickFiles('audio/*', true, directory);
    const audioFiles = picked.filter(isAudio);
    if (!audioFiles.length) {
      if (picked.length) toast('No audio files in that selection');
      return;
    }
    setLoadingTags(true);
    const next: Track[] = [];
    for (const f of audioFiles) {
      const tags = await readTags(f.file);
      next.push({
        id: uid('tr'),
        name: f.path || f.name,
        url: URL.createObjectURL(f.file),
        file: f.file,
        tags,
      });
    }
    setLibrary((prev) => [...prev, ...next]);
    setLoadingTags(false);
    toast(`Added ${next.length} track${next.length > 1 ? 's' : ''} — nothing was uploaded`);
    if (index < 0 && next.length) {
      setIndex(0);
      window.setTimeout(() => void play(0), 200);
    }
  };

  const setupAnalyser = () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (!ctxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        ctxRef.current = new AC();
      }
      const ctx = ctxRef.current!;
      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        sourceRef.current.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
      }
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // Some browsers disallow MediaElementSource with blob URLs; playback still works.
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const bars = 16;
    const w = canvas.width / bars;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let data: Uint8Array | null = null;
    if (analyser) {
      data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data as unknown as Uint8Array<ArrayBuffer>);
    }
    for (let i = 0; i < bars; i++) {
      const value = data ? (data as any)[i] / 255 : (Math.sin(Date.now() / 260 + i * 0.5) + 1) / 2 * 0.5;
      const h = Math.max(2, value * canvas.height);
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - h);
      gradient.addColorStop(0, '#e4572e');
      gradient.addColorStop(1, '#ffd27a');
      ctx.fillStyle = gradient;
      ctx.fillRect(i * w + 1, canvas.height - h, w - 2, h);
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (playing) draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, draw]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume, index]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => {
      setDuration(audio.duration || 0);
      if (track) {
        setLibrary((prev) => prev.map((t) => (t.id === track.id ? { ...t, duration: audio.duration } : t)));
      }
    };
    const onEnd = () => {
      if (repeat === 'one') {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      nextTrack();
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat, index, library.length, shuffle]);

  const play = async (i: number) => {
    if (i < 0 || i >= library.length) return;
    setIndex(i);
    const audio = audioRef.current;
    if (!audio) return;
    setupAnalyser();
    audio.src = library[i].url;
    try {
      await audio.play();
      setPlaying(true);
      const t = library[i];
      setNowPlaying({ title: t.tags?.title || t.name.split('/').pop() || 'Track', playing: true });
    } catch {
      setPlaying(false);
      toast('Could not play that file');
    }
  };

  shuffleAllRef.current = () => {
    if (!library.length) { toast('Add some music first'); return; }
    const start = Math.floor(Math.random() * library.length);
    setView('player');
    setShuffle(true);
    void play(start);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track) { void addFiles(false); return; }
    if (playing) {
      audio.pause();
      setPlaying(false);
      setNowPlaying(null);
    } else {
      if (!audio.src) { void play(index < 0 ? 0 : index); return; }
      setupAnalyser();
      void audio.play().then(() => {
        setPlaying(true);
        setNowPlaying({ title: track.tags?.title || track.name.split('/').pop() || 'Track', playing: true });
      }).catch(() => toast('Playback blocked — tap play again'));
    }
  };

  const nextTrack = useCallback(() => {
    if (!library.length) return;
    let next: number;
    if (shuffle) {
      next = Math.floor(Math.random() * library.length);
      if (library.length > 1 && next === index) next = (next + 1) % library.length;
    } else {
      next = index + 1;
      if (next >= library.length) {
        if (repeat === 'all') next = 0;
        else { setPlaying(false); setNowPlaying(null); return; }
      }
    }
    void play(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, index, shuffle, repeat]);

  const prevTrack = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (!library.length) return;
    const prev = index - 1 < 0 ? library.length - 1 : index - 1;
    void play(prev);
  };

  useEffect(() => {
    const off = registerAppKeys((e) => {
      if (e.key === ' ' && !useStore.getState().activeFieldId) { toggle(); return true; }
      if (e.key === 'ArrowRight' && e.ctrl) { nextTrack(); return true; }
      if (e.key === 'ArrowLeft' && e.ctrl) { prevTrack(); return true; }
      return false;
    });
    return off;
  });

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); }
    setNowPlaying(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titleOf = (t: Track) => t.tags?.title || t.name.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Unknown track';
  const filtered = library.filter((t) => !search || titleOf(t).toLowerCase().includes(search.toLowerCase()) || (t.tags?.artist || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <AppFrame
      title={view === 'player' ? 'Now playing' : 'Music'}
      icon="music"
      actions={
        <>
          <button className="hbtn" onClick={() => void addFiles(false)}><Icon name="plus" size={9} /> Files</button>
          <button className="hbtn" onClick={() => setView(view === 'player' ? 'library' : 'player')}>{view === 'player' ? 'Library' : 'Player'}</button>
        </>
      }
      menu={[
        { id: 'files', label: 'Add music files', icon: 'plus', run: () => { void addFiles(false); } },
        { id: 'folder', label: 'Add a folder', icon: 'folder', run: () => { void addFiles(true); } },
        { id: 'player', label: 'Now playing', icon: 'play', run: () => setView('player') },
        { id: 'library', label: 'Library', icon: 'list', run: () => setView('library') },
        { id: 'shuffle', label: 'Shuffle all', icon: 'shuffle', run: shuffleAll },
      ]}
    >
      <audio ref={audioRef} preload="metadata" />
      {view === 'library' && (
        <>
          <div style={{ padding: 5, display: 'flex', gap: 4 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tracks"
              inputMode="none"
              style={{ flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
            />
            <button className="btn" onClick={() => void addFiles(true)} title="Add a whole folder">Folder</button>
          </div>
          <div className="appBody">
            {loadingTags && <div className="empty"><div className="spinner" /><div>Reading tags locally…</div></div>}
            {!loadingTags && library.length === 0 && (
              <div className="empty">
                <div className="big">🎵</div>
                <div><b>Pick music from this device</b></div>
                <div className="tiny" style={{ maxWidth: 300 }}>
                  Files are played straight from your disk with object URLs. Nothing is uploaded or
                  copied to any server.
                </div>
                <div className="btnRow" style={{ justifyContent: 'center' }}>
                  <button className="btn primary" onClick={() => void addFiles(false)}>Add audio files</button>
                  <button className="btn" onClick={() => void addFiles(true)}>Add a folder</button>
                </div>
              </div>
            )}
            {filtered.map((t) => {
              const realIndex = library.indexOf(t);
              return (
                <button
                  key={t.id}
                  className="rowBtn"
                  onClick={() => { void play(realIndex); setView('player'); }}
                  style={{ background: realIndex === index ? 'rgba(255,255,255,.06)' : undefined }}
                >
                  {t.tags?.picture
                    ? <img src={t.tags.picture} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} />
                    : <Icon name="music" size={12} />}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{titleOf(t)}</span>
                    <span className="tiny">{t.tags?.artist || t.name.split('/').slice(-2, -1)[0] || 'Unknown artist'}</span>
                  </div>
                  <span className="meta">{t.duration ? formatDuration(t.duration) : ''}</span>
                </button>
              );
            })}
            {library.length > 0 && (
              <div style={{ padding: 6, display: 'flex', gap: 4 }}>
                <button className="btn" onClick={() => showDialog({
                  title: 'Clear playlist?',
                  body: 'The files stay on your device — only the playlist is cleared.',
                  confirmLabel: 'Clear', danger: true,
                  onConfirm: () => {
                    library.forEach((t) => URL.revokeObjectURL(t.url));
                    setLibrary([]); setIndex(-1); setPlaying(false); setNowPlaying(null);
                  },
                })}>Clear playlist</button>
                <button className="btn" onClick={() => setShuffle((s) => !s)}>{shuffle ? 'Shuffle on' : 'Shuffle off'}</button>
              </div>
            )}
          </div>
          <MiniBar playing={playing} track={track ? titleOf(track) : null} onToggle={toggle} />
        </>
      )}

      {view === 'player' && (
        <div className="appBody" style={{ padding: 7, display: 'flex', flexDirection: 'column', gap: 5, background: 'linear-gradient(180deg,rgba(228,87,46,.14),transparent 60%)' }}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 4 }}>
            <div style={{ width: 86, height: 86, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)', background: 'linear-gradient(150deg,var(--panel-3),var(--panel))', display: 'grid', placeItems: 'center' }}>
              {track?.tags?.picture ? <img src={track.tags.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="music" size={36} />}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {track ? titleOf(track) : 'No track loaded'}
            </div>
            <div className="tiny">{track?.tags?.artist || '—'}{track?.tags?.album ? ` · ${track.tags.album}` : ''}</div>
          </div>
          <canvas ref={canvasRef} width={300} height={34} style={{ width: '100%', height: 34, display: 'block' }} aria-label="Equalizer visualizer" />
          <div>
            <div className="progress" style={{ height: 4 }}><i style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="tiny">
              <span>{formatDuration(position)}</span><span>{formatDuration(duration)}</span>
            </div>
            <input
              type="range" min={0} max={duration || 0} value={position} step={0.5}
              onChange={(e) => { const v = Number(e.target.value); setPosition(v); if (audioRef.current) audioRef.current.currentTime = v; }}
              style={{ width: '100%', accentColor: 'var(--hl)' }}
              aria-label="Seek"
              inputMode="none"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <button className="iconBtn" onClick={() => setShuffle((s) => !s)} aria-label="Shuffle" style={{ opacity: shuffle ? 1 : 0.5 }}><Icon name="shuffle" size={12} /></button>
            <button className="iconBtn" onClick={prevTrack} aria-label="Previous"><Icon name="prev" size={13} /></button>
            <button
              className="btn primary"
              style={{ width: 42, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center' }}
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              <Icon name={playing ? 'pause' : 'play'} size={15} />
            </button>
            <button className="iconBtn" onClick={nextTrack} aria-label="Next"><Icon name="next" size={13} /></button>
            <button
              className="iconBtn"
              onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
              aria-label={`Repeat ${repeat}`}
              style={{ opacity: repeat === 'off' ? 0.5 : 1 }}
            >
              <Icon name="repeat" size={12} />
              {repeat === 'one' && <span style={{ fontSize: 7 }}>1</span>}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="volume" size={11} />
            <input
              type="range" min={0} max={1} step={0.02} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--hl)' }}
              aria-label="Volume"
              inputMode="none"
            />
            <span className="tiny mono">{Math.round(volume * 100)}</span>
          </div>
          <div className="tiny" style={{ textAlign: 'center' }}>
            Playback continues in the status bar when you leave this app.
          </div>
        </div>
      )}
    </AppFrame>
  );
}

function MiniBar({ playing, track, onToggle }: { playing: boolean; track: string | null; onToggle: () => void }) {
  if (!track) return null;
  return (
    <div style={{ display: 'flex', gap: 5, padding: '3px 6px', borderTop: '1px solid var(--line)', alignItems: 'center', background: 'rgba(0,0,0,.25)' }}>
      <Icon name="music" size={11} />
      <span className="tiny" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track}</span>
      <button className="iconBtn" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 18, height: 18 }}>
        <Icon name={playing ? 'pause' : 'play'} size={9} />
      </button>
    </div>
  );
}
