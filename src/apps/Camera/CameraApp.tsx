import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid, downloadBlob } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { PhotoItem } from '../../os/types';
import { shutterSound, tickSound } from '../../os/audio';

export default function CameraApp() {
  const [photos, setPhotos] = useCollection<PhotoItem>(DB_KEYS.photos);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [timer, setTimer] = useState<0 | 3 | 10>(0);
  const [grid, setGrid] = useState(false);
  const [flash, setFlash] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number }>({ min: 1, max: 1 });
  const [lastShot, setLastShot] = useState<{ blob: Blob; url: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const toast = useStore((s) => s.toast);

  const start = async (f: 'environment' | 'user') => {
    setError(null);
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera capture needs a browser with getUserMedia (Chrome, Edge, Safari, Firefox) and a secure (https) page.');
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: f, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: mode === 'video',
      });
      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play().catch(() => {});
      }
      const track = media.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() || {}) as any;
      if (caps.zoom) setZoomRange({ min: caps.zoom.min || 1, max: caps.zoom.max || 1 });
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError') setError('Camera permission was denied. Allow camera access in your browser settings, then reopen this app.');
      else if (name === 'NotFoundError') setError('No camera was found on this device.');
      else setError('The camera could not start. Another app may be using it.');
    }
  };

  const stopStream = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  useEffect(() => {
    void start(facing);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, mode]);

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth) { toast('Camera not ready yet'); return; }
    shutterSound();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 130);
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
    if (!blob) { toast('Could not capture the frame'); return; }
    const url = URL.createObjectURL(blob);
    setLastShot({ blob, url });
    toast('Captured — press Save to keep it');
  };

  const shoot = () => {
    if (timer === 0) { void capture(); return; }
    let n = timer;
    setCountdown(n);
    const t = window.setInterval(() => {
      n -= 1;
      tickSound(0.5);
      if (n <= 0) {
        window.clearInterval(t);
        setCountdown(null);
        void capture();
      } else {
        setCountdown(n);
      }
    }, 1000);
  };

  const save = async () => {
    if (!lastShot) return;
    const bitmap = await createImageBitmap(lastShot.blob).catch(() => null);
    setPhotos((prev) => [{
      id: uid('photo'), name: `IMG_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.jpg`,
      blob: lastShot.blob, at: Date.now(), width: bitmap?.width || 0, height: bitmap?.height || 0,
    }, ...prev]);
    setLastShot(null);
    toast('Saved to Pictures');
  };

  const toggleRecording = async () => {
    if (!stream) { toast('Start the camera first'); return; }
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const mime = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: mime || 'video/webm' });
        downloadBlob(blob, `OWL_VIDEO_${Date.now()}.webm`);
        setRecording(false);
        setRecSeconds(0);
        toast('Recording finished — saved to your downloads');
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
      setRecSeconds(0);
    } catch {
      toast('Video recording is not supported in this browser');
    }
  };

  const applyZoom = (value: number) => {
    setZoom(value);
    const track = stream?.getVideoTracks()[0];
    if (track && zoomRange.max > zoomRange.min) {
      track.applyConstraints({ advanced: [{ zoom: value } as any] }).catch(() => {});
    }
  };

  if (error) {
    return (
      <AppFrame title="Camera" icon="camera">
        <div className="empty">
          <div className="big">📷</div>
          <div><b>Camera unavailable</b></div>
          <div className="tiny" style={{ maxWidth: 310 }}>{error}</div>
          <div className="btnRow" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => void start(facing)}>Try again</button>
            <button className="btn" onClick={() => useStore.getState().openApp('pictures')}>Open Pictures</button>
          </div>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame
      title="Camera"
      icon="camera"
      actions={
        <>
          <button className="hbtn" onClick={() => setMode(mode === 'photo' ? 'video' : 'photo')}>{mode === 'photo' ? 'Photo' : 'Video'}</button>
          <button className="hbtn" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} aria-label="Switch camera">
            <Icon name="cameraFlip" size={9} />
          </button>
        </>
      }
      menu={[
        { id: 'capture', label: 'Capture', icon: 'camera', run: () => { void save(); } },
        { id: 'flip', label: 'Switch camera', icon: 'cameraFlip', run: () => setFacing((f) => (f === 'environment' ? 'user' : 'environment')) },
        { id: 'mode', label: mode === 'photo' ? 'Video mode' : 'Photo mode', icon: 'video', run: () => setMode(mode === 'photo' ? 'video' : 'photo') },
        { id: 'grid', label: 'Toggle grid', icon: 'grid', run: () => setGrid((g) => !g) },
        { id: 'gallery', label: 'Open Pictures', icon: 'image', run: () => useStore.getState().openApp('pictures') },
      ]}
    >
      <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
        {grid && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.28)' }} />
            <div style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.28)' }} />
            <div style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.28)' }} />
            <div style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.28)' }} />
          </div>
        )}
        {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff' }} aria-hidden="true" />}
        {countdown !== null && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 54, color: '#fff', textShadow: '0 2px 12px #000', fontFamily: 'var(--font-display)' }}>
            {countdown}
          </div>
        )}
        {recording && (
          <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(200,20,30,.85)', color: '#fff', fontSize: 9, padding: '1px 6px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} /> REC {recSeconds}s
          </div>
        )}
        {!stream && <div className="tiny" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8aa' }}>Starting camera…</div>}
      </div>

      <div style={{ padding: '3px 6px', borderTop: '1px solid var(--line)', display: 'grid', gap: 3 }}>
        {lastShot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <img src={lastShot.url} alt="Last capture" style={{ width: 34, height: 26, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--hl)' }} />
            <span className="tiny" style={{ flex: 1 }}>New capture</span>
            <button className="btn primary" onClick={() => void save()}>Save to Pictures</button>
            <button className="btn" onClick={() => downloadBlob(lastShot.blob, 'owl-photo.jpg')}>Download</button>
            <button className="btn" onClick={() => setLastShot(null)}>Discard</button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className={`chip ${grid ? 'on' : ''}`} onClick={() => setGrid((g) => !g)}>Grid</button>
          <button className={`chip ${timer === 3 ? 'on' : ''}`} onClick={() => setTimer(timer === 3 ? 0 : 3)}>3s</button>
          <button className={`chip ${timer === 10 ? 'on' : ''}`} onClick={() => setTimer(timer === 10 ? 0 : 10)}>10s</button>
          <button className="chip" onClick={() => setFlash(true) /* simulated */} title="Simulated flash">Flash</button>
          {zoomRange.max > zoomRange.min && (
            <>
              <span className="tiny">Zoom</span>
              <input type="range" min={zoomRange.min} max={zoomRange.max} step={0.1} value={zoom} onChange={(e) => applyZoom(Number(e.target.value))} style={{ width: 70, accentColor: 'var(--hl)' }} inputMode="none" aria-label="Zoom" />
            </>
          )}
          <div style={{ flex: 1 }} />
          <button
            className={`btn ${recording ? 'danger' : ''}`}
            style={{ width: 40, height: 26, borderRadius: 99 }}
            onClick={mode === 'video' ? () => void toggleRecording() : shoot}
            aria-label={mode === 'video' ? (recording ? 'Stop recording' : 'Start recording') : 'Take photo'}
          >
            {mode === 'video' ? (recording ? '■' : '●') : <Icon name="camera" size={14} />}
          </button>
        </div>
        <div className="tiny">
          {mode === 'photo' ? 'Photos are saved to Pictures (IndexedDB) or downloaded directly.' : 'Video recordings download to your device.'}
          {' '}Nothing leaves the browser.
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </AppFrame>
  );
}
