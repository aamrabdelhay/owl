import { useEffect, useState } from 'react';
import { useStore } from '../os/store';
import { dbGet, dbSet } from '../os/db';
import { wallpaperCss } from '../assets/wallpapers';

/**
 * Resolves a wallpaper id to a CSS background value. Uploaded images are
 * stored as data URLs in IndexedDB; built-ins are generated SVG.
 */
export function useWallpaperUrl(id: string): string {
  const version = useStore((s) => s.wallpaperVersion);
  const [custom, setCustom] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (id.startsWith('custom:')) {
      void dbGet<string | null>(`wallpaper:${id}`, null).then((v) => alive && setCustom(v));
    } else {
      setCustom(null);
    }
    return () => { alive = false; };
  }, [id, version]);

  return wallpaperCss(id, custom);
}

export async function saveCustomWallpaper(dataUrl: string): Promise<string> {
  const id = `custom:${Date.now().toString(36)}`;
  await dbSet(`wallpaper:${id}`, dataUrl);
  return id;
}

export async function getCustomWallpaper(id: string): Promise<string | null> {
  return dbGet<string | null>(`wallpaper:${id}`, null);
}

/** Center-crop an image to a target aspect ratio and return a JPEG data URL. */
export async function cropToWallpaper(source: string | Blob, targetW = 960, targetH = 720, zoom = 1, offsetX = 0, offsetY = 0): Promise<string> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const img = await loadImage(url);
  if (typeof source !== 'string') URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  const scale = Math.max(targetW / img.width, targetH / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  const dx = (targetW - w) / 2 + offsetX * (w / targetW);
  const dy = (targetH - h) / 2 + offsetY * (h / targetH);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, w, h);
  return canvas.toDataURL('image/jpeg', 0.86);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });
}
