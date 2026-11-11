import { createStore, get, set, del, keys, clear } from 'idb-keyval';

/**
 * OWL local storage.
 * Everything the user creates (photos, notes, voice notes, wallpapers, high
 * scores, ...) lives here, in the browser's IndexedDB. Nothing is uploaded.
 */
const store = createStore('owl-db', 'kv');

export async function dbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await get<T>(key, store);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export async function dbSet<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value, store);
  } catch (err) {
    console.warn('[OWL] could not persist', key, err);
  }
}

export async function dbDel(key: string): Promise<void> {
  try {
    await del(key, store);
  } catch { /* ignore */ }
}

export async function dbKeys(prefix?: string): Promise<string[]> {
  try {
    const all = (await keys(store)) as string[];
    return prefix ? all.filter((k) => typeof k === 'string' && k.startsWith(prefix)) : all;
  } catch {
    return [];
  }
}

export async function dbClear(): Promise<void> {
  try {
    await clear(store);
  } catch { /* ignore */ }
}

export async function dbEstimate(): Promise<{ usage: number; quota: number }> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage || 0, quota: e.quota || 0 };
    }
  } catch { /* ignore */ }
  return { usage: 0, quota: 0 };
}

/* ------------------------------------------------------------------ */
/* Tiny JSON-backed collections with an in-memory cache + subscribers  */
/* ------------------------------------------------------------------ */

type Listener = () => void;
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();

export function subscribeKey(key: string, fn: Listener): () => void {
  let set_ = listeners.get(key);
  if (!set_) { set_ = new Set(); listeners.set(key, set_); }
  set_.add(fn);
  return () => set_!.delete(fn);
}

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export async function loadKey<T>(key: string, fallback: T): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  const value = await dbGet<T>(key, fallback);
  cache.set(key, value);
  return value;
}

export function peekKey<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export async function saveKey<T>(key: string, value: T): Promise<void> {
  cache.set(key, value);
  emit(key);
  await dbSet(key, value);
}

export function invalidateKey(key: string) {
  cache.delete(key);
  emit(key);
}

/* React hook friendly collection helpers */
export async function collectionGet<T>(name: string): Promise<T[]> {
  return loadKey<T[]>(`col:${name}`, []);
}
export async function collectionSet<T>(name: string, items: T[]): Promise<void> {
  return saveKey<T[]>(`col:${name}`, items);
}

export const DB_KEYS = {
  settings: 'owl:settings',
  contacts: 'col:contacts',
  smsThreads: 'col:smsThreads',
  smsMessages: 'col:smsMessages',
  notes: 'col:notes',
  tasks: 'col:tasks',
  events: 'col:events',
  vault: 'col:vault',
  alarms: 'col:alarms',
  chats: 'col:chats',
  callLog: 'col:callLog',
  voiceNotes: 'col:voiceNotes',
  photos: 'col:photos',
  bookmarks: 'col:bookmarks',
  history: 'col:history',
  scores: 'col:scores',
  wallpapers: 'col:wallpapers',
  frequency: 'owl:frequency',
  bootCount: 'owl:boots',
  vaultMeta: 'owl:vaultMeta',
};
