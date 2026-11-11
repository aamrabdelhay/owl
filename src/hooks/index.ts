import { useCallback, useEffect, useRef, useState } from 'react';
import { collectionGet, collectionSet, subscribeKey, DB_KEYS } from '../os/db';

/** Reactive, persisted collection hook. Data stays in IndexedDB on this device. */
export function useCollection<T>(key: string, seed?: T[]): [T[], (next: T[] | ((prev: T[]) => T[])) => void, boolean] {
  const [items, setItems] = useState<T[]>(seed || []);
  const [ready, setReady] = useState(false);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    let alive = true;
    void collectionGet<T>(key).then(async (stored) => {
      if (!alive) return;
      if ((!stored || stored.length === 0) && seed && seed.length) {
        await collectionSet(key, seed);
        if (!alive) return;
        setItems(seed);
      } else {
        setItems(stored || []);
      }
      setReady(true);
    });
    const unsub = subscribeKey(key, () => {
      void collectionGet<T>(key).then((stored) => alive && setItems(stored || []));
    });
    return () => { alive = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback((next: T[] | ((prev: T[]) => T[])) => {
    setItems((prev) => {
      const value = typeof next === 'function' ? (next as (p: T[]) => T[])(prev) : next;
      void collectionSet(keyRef.current, value);
      return value;
    });
  }, []);

  return [items, update, ready];
}

/** Ticking clock for app UIs. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useLocalStorageState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);
  return [value, set];
}

export function useObjectUrl(blobOrFile: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blobOrFile) { setUrl(null); return; }
    const u = URL.createObjectURL(blobOrFile);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blobOrFile]);
  return url;
}

export function useLongPress(callback: () => void, ms = 600) {
  const timer = useRef<number | undefined>(undefined);
  const start = useCallback((e?: React.SyntheticEvent) => {
    if (e && 'preventDefault' in e && (e as any).type === 'contextmenu') e.preventDefault();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(callback, ms);
  }, [callback, ms]);
  const cancel = useCallback(() => window.clearTimeout(timer.current), []);
  return { start, cancel, onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onKeyDown: undefined };
}

export const uid = (prefix = 'id'): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function formatBytes(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

export { DB_KEYS };
