import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid, downloadBlob } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { PhotoItem } from '../../os/types';
import { pickFiles, isImage } from '../../os/media';
import { cropToWallpaper, saveCustomWallpaper } from '../../hooks/useWallpaper';
import { registerAppKeys } from '../../os/kernel';

/**
 * Gallery: user images from the device plus photos captured in the Camera app
 * (which are stored in IndexedDB on this device only).
 */
export default function PicturesApp() {
  const [photos, setPhotos] = useCollection<PhotoItem>(DB_KEYS.photos);
  const [session, setSession] = useState<{ id: string; name: string; url: string; blob: Blob }[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [slideshow, setSlideshow] = useState(false);
  const [cropMode, setCropMode] = useState<'home' | 'lock' | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const cropSrc = useRef<string>('');
  const toast = useStore((s) => s.toast);
  const updateSettings = useStore((s) => s.updateSettings);
  const bumpWallpaper = useStore((s) => s.bumpWallpaper);
  const showDialog = useStore((s) => s.showDialog);

  const all = [
    ...photos.map((p) => ({ id: p.id, name: p.name, url: '', blob: p.blob, at: p.at })),
    ...session.map((s) => ({ ...s, at: Date.now() })),
  ];

  const urls = useUrls(all.map((p) => p.blob));

  const add = async () => {
    const picked = await pickFiles('image/*', true, false);
    const images = picked.filter(isImage);
    if (!images.length) { if (picked.length) toast('No images selected'); return; }
    setSession((prev) => [
      ...prev,
      ...images.map((p) => ({ id: uid('pic'), name: p.name, url: URL.createObjectURL(p.file), blob: p.file })),
    ]);
    toast(`Loaded ${images.length} image${images.length > 1 ? 's' : ''} from this device`);
  };

  const saveToGallery = async (blob: Blob, name: string) => {
    const bitmap = await createImageBitmap(blob).catch(() => null);
    setPhotos((prev) => [...prev, {
      id: uid('photo'), name, blob, at: Date.now(),
      width: bitmap?.width || 0, height: bitmap?.height || 0,
    }]);
    return bitmap;
  };

  useEffect(() => {
    if (!slideshow || viewing === null) return;
    const t = window.setInterval(() => setViewing((v) => (v === null ? null : (v + 1) % all.length)), 2800);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideshow, viewing, all.length]);

  useEffect(() => {
    const off = registerAppKeys((e) => {
      if (viewing === null) return false;
      if (e.key === 'ArrowRight') { setViewing((v) => (v === null ? null : (v + 1) % all.length)); return true; }
      if (e.key === 'ArrowLeft') { setViewing((v) => (v === null ? null : (v - 1 + all.length) % all.length)); return true; }
      if (e.key === 'Escape') { setViewing(null); return true; }
      return false;
    });
    return off;
  });

  const applyCrop = async () => {
    if (!cropMode || !cropSrc.current) return;
    const data = await cropToWallpaper(cropSrc.current, 960, 720, cropZoom, cropOffset.x, cropOffset.y);
    const id = await saveCustomWallpaper(data);
    if (cropMode === 'lock') updateSettings({ lockWallpaperId: id, useSeparateLockWallpaper: true });
    else updateSettings({ wallpaperId: id });
    bumpWallpaper();
    setCropMode(null);
    toast('Wallpaper saved to this device');
  };

  const startCrop = (blobUrl: string, mode: 'home' | 'lock') => {
    cropSrc.current = blobUrl;
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setCropMode(mode);
  };

  if (cropMode) {
    return (
      <AppFrame
        title={`Set ${cropMode} wallpaper`}
        icon="image"
        actions={<button className="hbtn" onClick={() => setCropMode(null)}>Cancel</button>}
        menu={[
          { id: 'cancel', label: 'Cancel crop', icon: 'close', run: () => setCropMode(null) },
          { id: 'apply', label: 'Apply wallpaper', icon: 'check', run: () => { void applyCrop(); } },
          { id: 'reset', label: 'Reset crop', icon: 'repeat', run: () => { setCropZoom(1); setCropOffset({ x: 0, y: 0 }); } },
        ]}
      >
        <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div
            style={{
              width: '100%', aspectRatio: '4 / 3', border: '1px solid var(--hl)', borderRadius: 6,
              overflow: 'hidden', position: 'relative', background: '#000',
            }}
          >
            <img
              src={cropSrc.current}
              alt="Crop preview"
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: `scale(${cropZoom}) translate(${cropOffset.x}%, ${cropOffset.y}%)`,
                transition: 'transform 90ms linear',
              }}
            />
            <div
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)', pointerEvents: 'none' }}
            />
          </div>
          <div className="tiny">Drag-free crop: adjust zoom and position until it fits the 4:3 screen.</div>
          <div className="fieldLabel">Zoom</div>
          <input type="range" min={1} max={3} step={0.02} value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} style={{ accentColor: 'var(--hl)' }} inputMode="none" />
          <div className="fieldLabel">Horizontal position</div>
          <input type="range" min={-50} max={50} value={cropOffset.x} onChange={(e) => setCropOffset((o) => ({ ...o, x: Number(e.target.value) }))} style={{ accentColor: 'var(--hl)' }} inputMode="none" />
          <div className="fieldLabel">Vertical position</div>
          <input type="range" min={-50} max={50} value={cropOffset.y} onChange={(e) => setCropOffset((o) => ({ ...o, y: Number(e.target.value) }))} style={{ accentColor: 'var(--hl)' }} inputMode="none" />
          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => { setCropZoom(1); setCropOffset({ x: 0, y: 0 }); }}>Reset</button>
            <button className="btn primary" onClick={() => void applyCrop()}>
              Set wallpaper
            </button>
          </div>
        </div>
      </AppFrame>
    );
  }

  if (viewing !== null && all[viewing]) {
    const photo = all[viewing];
    const url = urls[viewing];
    return (
      <AppFrame
        title={photo.name}
        icon="image"
        actions={
          <>
            <button className="hbtn" onClick={() => setSlideshow((s) => !s)}>{slideshow ? 'Stop' : 'Slideshow'}</button>
            <button className="hbtn" onClick={() => { setViewing(null); setZoom(1); setRotation(0); }}>Grid</button>
          </>
        }
        menu={[
          { id: 'slideshow', label: slideshow ? 'Stop slideshow' : 'Slideshow', icon: 'play', run: () => setSlideshow((v) => !v) },
          { id: 'wallpaper', label: 'Set as wallpaper', icon: 'image', run: () => { if (viewing !== null && urls[viewing]) startCrop(urls[viewing], 'home'); } },
          { id: 'grid', label: 'Back to grid', icon: 'grid', run: () => { setViewing(null); setZoom(1); setRotation(0); } },
        ]}
      >
        <div style={{ flex: 1, background: '#04070c', display: 'grid', placeItems: 'center', overflow: 'hidden', position: 'relative' }}>
          <img
            src={url || undefined}
            alt={photo.name}
            onClick={() => setZoom((z) => (z >= 2 ? 1 : z + 0.5))}
            style={{ maxWidth: '100%', maxHeight: '100%', transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 140ms ease', cursor: 'zoom-in' }}
          />
          <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 8, background: 'rgba(0,0,0,.55)', padding: '1px 5px', borderRadius: 99 }}>
            {viewing + 1}/{all.length} · {zoom}×
          </span>
        </div>
        <div style={{ padding: 4, borderTop: '1px solid var(--line)' }}>
          <div className="btnRow">
            <button className="btn" onClick={() => { setRotation((r) => r + 90); }}>Rotate</button>
            <button className="btn" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>Zoom −</button>
            <button className="btn" onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>Zoom +</button>
            <button className="btn" onClick={() => startCrop(url, 'home')}>Wallpaper</button>
            <button className="btn" onClick={() => startCrop(url, 'lock')}>Lock wp</button>
            <button
              className="btn"
              onClick={async () => {
                const rotated = await rotateBlob(photo.blob, rotation);
                if (photos.some((p) => p.id === photo.id)) {
                  setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, blob: rotated } : p)));
                  toast('Photo rotated and saved');
                } else {
                  await saveToGallery(rotated, photo.name);
                  toast('Added to gallery');
                }
              }}
            >Save</button>
            <button className="btn" onClick={() => downloadBlob(photo.blob, photo.name || 'owl-photo.jpg')}>Download</button>
            <button
              className="btn danger"
              onClick={() => showDialog({
                title: 'Delete photo?',
                body: 'This removes the photo from this device.',
                confirmLabel: 'Delete', danger: true,
                onConfirm: () => {
                  setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                  setSession((prev) => prev.filter((p) => p.id !== photo.id));
                  setViewing(null);
                },
              })}
            >Delete</button>
          </div>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame
      title="Pictures"
      icon="image"
      actions={<button className="hbtn" onClick={() => void add()}><Icon name="plus" size={9} /> Add</button>}
    >
      <div className="appBody">
        {all.length === 0 && (
          <div className="empty">
            <div className="big">🖼</div>
            <div><b>Your gallery is empty</b></div>
            <div className="tiny" style={{ maxWidth: 300 }}>
              Add images from this device, or capture photos in the Camera app. Everything stays
              in your browser's storage — nothing is uploaded.
            </div>
            <button className="btn primary" onClick={() => void add()}>Pick images</button>
          </div>
        )}
        {all.length > 0 && (
          <>
            <div className="owlSection">{photos.length ? `${photos.length} saved` : ''} {session.length ? `· ${session.length} loaded` : ''}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, padding: 4 }}>
              {all.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { setViewing(i); setZoom(1); setRotation(0); }}
                  aria-label={p.name}
                  style={{ padding: 0, border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden', aspectRatio: '1', background: 'var(--panel-2)', cursor: 'pointer' }}
                >
                  {urls[i] ? <img src={urls[i]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : null}
                </button>
              ))}
            </div>
            <div style={{ padding: 5, display: 'flex', gap: 5 }}>
              <button className="btn" onClick={() => setSlideshow(true)}>Slideshow</button>
              <button className="btn" onClick={() => void add()}>Add more</button>
              {session.length > 0 && (
                <button
                  className="btn"
                  onClick={async () => {
                    for (const s of session) await saveToGallery(s.blob, s.name);
                    setSession([]);
                    toast('Saved loaded images to the gallery');
                  }}
                >
                  Save {session.length} to gallery
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </AppFrame>
  );
}

function useUrls(blobs: Blob[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  const key = blobs.map((b) => (b as any).size + ':' + (b as any).type + ':' + (b as any).name).join('|');
  useEffect(() => {
    const created = blobs.map((b) => URL.createObjectURL(b));
    setUrls(created);
    return () => created.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

async function rotateBlob(blob: Blob, degrees: number): Promise<Blob> {
  if (!degrees) return blob;
  const bitmap = await createImageBitmap(blob);
  const radians = (degrees * Math.PI) / 180;
  const swap = degrees % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || blob), blob.type || 'image/jpeg', 0.9));
}
