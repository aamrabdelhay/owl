import { create } from 'zustand';
import type {
  DialogSpec, Lang, ProfileId, Screen, Settings, SoftMenuSpec, ToastSpec, ThemeId, DockRows,
} from './types';
import { APP_MAP, DOCK_IDS } from './appRegistry';
import { verifyPassword } from './security';
import { DB_KEYS, collectionGet, loadKey, saveKey, subscribeKey } from './db';
import { audioContext, messageTone, playRingtone, stopRingtone, vibrate } from './audio';

const SETTINGS_KEY = 'owl:settings:v1';

export function defaultSettings(now = Date.now()): Settings {
  return {
    language: 'en',
    userName: '',
    theme: 'owl-night',
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    uiScale: 1,
    fontScale: 1,
    brightness: 1,
    backlight: 30,
    volume: 0.7,
    ringVolume: 0.75,
    alarmVolume: 0.85,
    keyClick: true,
    keyClickVolume: 0.5,
    vibrateKeys: false,
    vibrate: true,
    profile: 'normal',
    ringtone: 'owl-call',
    messageTone: 'soft-chime',
    alarmTone: 'alert-seven',
    clock24: false,
    timezone: 'local',
    showSeconds: false,
    wallpaperId: 'owl-night-glow',
    lockWallpaperId: 'owl-night-glow',
    useSeparateLockWallpaper: false,
    dockRows: 'one',
    hotkeys: {
      m: 'messages', o: 'messenger', a: 'contacts', b: 'web', c: 'calendar', p: 'phone',
      k: 'calculator', n: 'memo', t: 'flashlight', g: 'tasks', s: 'settings', f: 'files',
      x: 'games', w: 'music', i: 'pictures', h: 'camera', d: 'clock', l: 'passwords',
      e: 'email', v: 'videos', r: 'voice', u: 'themes', z: 'compass',
    },
    favorites: ['messages', 'web', 'music', 'snake', 'camera', 'memo'],
    hiddenApps: [],
    appOrder: [],
    folders: [],
    passwordHash: '',
    passwordSalt: '',
    passwordIsPin: false,
    autoLock: 60,
    powerSaver: false,
    bluetooth: true,
    wifiOnly: false,
    onboarded: false,
    homePage: 'owl://home',
    installedAt: now,
  };
}

function deepMergeSettings(base: Settings, patch: Partial<Settings>): Settings {
  return { ...base, ...patch, hotkeys: { ...base.hotkeys, ...(patch.hotkeys || {}) } };
}

export function loadSettingsSync(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return deepMergeSettings(defaultSettings(), parsed);
  } catch {
    return defaultSettings();
  }
}

let saveTimer: number | undefined;
function persistSettings(settings: Settings) {
  if (typeof window === 'undefined') return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* quota */ }
  }, 180);
}

export interface AppStackEntry { appId: string; params?: Record<string, unknown> }

export interface BatteryState { level: number; charging: boolean }

interface OwlStore {
  /* boot / power */
  booting: boolean;
  bootProgress: number;
  powered: boolean;
  screen: Screen;
  locked: boolean;
  bootStart: () => void;
  finishBoot: () => void;
  powerOff: () => void;
  powerOn: () => void;
  lock: () => void;
  unlock: (password?: string) => Promise<boolean>;
  failedAttempts: number;
  cooldownUntil: number;

  /* settings */
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  toggleThemePreview: (t: ThemeId | null) => void;
  themePreview: ThemeId | null;

  /* navigation */
  appId: string | null;
  appParams: Record<string, unknown>;
  appStack: AppStackEntry[];
  openApp: (id: string, params?: Record<string, unknown>) => void;
  closeApp: () => void;
  back: () => void;
  recentApps: string[];
  clearRecent: () => void;

  /* ui layer */
  drawerOpen: boolean;
  drawerTab: string;
  drawerFolder: string | null;
  openDrawer: (tab?: string) => void;
  closeDrawer: () => void;
  setDrawerTab: (tab: string) => void;
  setDrawerFolder: (id: string | null) => void;

  powerMenuOpen: boolean;
  setPowerMenuOpen: (v: boolean) => void;
  recentOpen: boolean;
  setRecentOpen: (v: boolean) => void;
  searchOpen: boolean;
  searchQuery: string;
  openSearch: (initial?: string) => void;
  closeSearch: () => void;
  setSearchQuery: (q: string) => void;

  /* focus / input */
  activeFieldId: string | null;
  focusField: (id: string | null) => void;

  /* modifiers */
  shift: boolean;
  caps: boolean;
  ctrl: boolean;
  alt: boolean;
  setShift: (v: boolean) => void;
  toggleShift: () => void;
  toggleCaps: () => void;
  setCtrl: (v: boolean) => void;
  setAlt: (v: boolean) => void;
  shiftOnce: boolean;
  consumeShiftOnce: () => void;

  pressedCodes: string[];
  setKeyPressed: (code: string, down: boolean) => void;
  clearPressed: () => void;

  /* dialogs / toasts / menus */
  dialog: DialogSpec | null;
  showDialog: (d: Omit<DialogSpec, 'id'>) => void;
  closeDialog: () => void;
  toasts: ToastSpec[];
  toast: (text: string) => void;
  dismissToast: (id: number) => void;
  softMenu: SoftMenuSpec | null;
  setSoftMenu: (s: SoftMenuSpec | null) => void;
  appMenu: SoftMenuSpec | null;
  setAppMenu: (s: SoftMenuSpec | null) => void;

  /* runtime info */
  battery: BatteryState;
  setBattery: (b: BatteryState) => void;
  online: boolean;
  setOnline: (v: boolean) => void;
  counters: { messages: number; missedCalls: number; reminders: number };
  setCounters: (c: Partial<{ messages: number; missedCalls: number; reminders: number }>) => void;
  refreshCounters: () => Promise<void>;
  volumeHud: { value: number; label: string } | null;
  bumpVolume: (delta: number, which?: 'media' | 'ring' | 'alarm') => void;
  showVolume: (label: string) => void;
  frequency: Record<string, number>;
  recordAppOpen: (id: string) => void;
  nowPlaying: { title: string; playing: boolean } | null;
  setNowPlaying: (v: { title: string; playing: boolean } | null) => void;
  wallpaperVersion: number;
  bumpWallpaper: () => void;
  clockTick: number;
  tickClock: () => void;
  alarmRinging: string | null;
  setAlarmRinging: (v: string | null) => void;
  incomingCall: { number: string; name?: string } | null;
  setIncomingCall: (v: { number: string; name?: string } | null) => void;
  notify: (title: string, kind?: 'message' | 'call' | 'calendar') => void;
}

const initialSettings = typeof window !== 'undefined' ? loadSettingsSync() : defaultSettings();

export const useStore = create<OwlStore>((set, get) => ({
  booting: true,
  bootProgress: 0,
  powered: true,
  screen: 'boot',
  locked: false,
  failedAttempts: 0,
  cooldownUntil: 0,
  bootStart: () => set({ booting: true, bootProgress: 0, screen: 'boot', powered: true }),
  finishBoot: () =>
    set((s) => ({
      booting: false,
      bootProgress: 100,
      // Never clobber an app that was opened while the logo was still animating
      // (the first-run wizard can do exactly that).
      screen: s.appId ? 'app' : s.locked ? 'lock' : 'home',
    })),
  powerOff: () => {
    stopRingtone();
    set({ powered: false, screen: 'off', drawerOpen: false, appId: null, appStack: [], softMenu: null, dialog: null });
  },
  powerOn: () => {
    set({ powered: true, booting: true, bootProgress: 0, screen: 'boot', locked: true, appId: null, appStack: [] });
  },
  lock: () => {
    set({
      locked: true,
      screen: 'lock',
      drawerOpen: false,
      softMenu: null,
      dialog: null,
      recentOpen: false,
      activeFieldId: null,
    });
  },
  unlock: async (password) => {
    const { settings, failedAttempts, cooldownUntil } = get();
    if (Date.now() < cooldownUntil) return false;
    if (!settings.passwordHash) {
      set({ locked: false, screen: get().appId ? 'app' : 'home', failedAttempts: 0 });
      return true;
    }
    if (!password) return false;
    const ok = await verifyPassword(password, settings.passwordSalt, settings.passwordHash);
    if (ok) {
      set({ locked: false, screen: 'home', failedAttempts: 0 });
      return true;
    }
    const attempts = failedAttempts + 1;
    if (attempts >= 5) {
      set({ failedAttempts: 0, cooldownUntil: Date.now() + 10000 });
    } else {
      set({ failedAttempts: attempts });
    }
    return false;
  },

  settings: initialSettings,
  updateSettings: (patch) =>
    set((s) => {
      const settings = deepMergeSettings(s.settings, patch);
      persistSettings(settings);
      return { settings };
    }),
  setSetting: (key, value) =>
    set((s) => {
      const settings = { ...s.settings, [key]: value };
      persistSettings(settings);
      return { settings };
    }),
  themePreview: null,
  toggleThemePreview: (t) => set({ themePreview: t }),

  appId: null,
  appParams: {},
  appStack: [],
  openApp: (id, params) => {
    const state = get();
    if (!APP_MAP[id]) return;
    if (state.locked) return;
    const normalizedId = id;
    const stack = state.appId ? [...state.appStack, { appId: state.appId, params: state.appParams }] : state.appStack;
    const recent = [normalizedId, ...state.recentApps.filter((r) => r !== normalizedId)].slice(0, 8);
    set({
      appId: normalizedId,
      appParams: params || {},
      appStack: stack,
      screen: 'app',
      drawerOpen: false,
      drawerFolder: null,
      searchOpen: false,
      searchQuery: '',
      softMenu: null,
      appMenu: null,
      activeFieldId: null,
      recentApps: recent,
    });
    get().recordAppOpen(normalizedId);
  },
  closeApp: () =>
    set({ appId: null, appParams: {}, appStack: [], screen: 'home', softMenu: null, appMenu: null, activeFieldId: null }),
  back: () => {
    const s = get();
    if (s.softMenu) { set({ softMenu: null }); return; }
    if (s.dialog) { get().closeDialog(); return; }
    if (s.recentOpen) { set({ recentOpen: false }); return; }
    if (s.drawerFolder) { set({ drawerFolder: null }); return; }
    if (s.drawerOpen) { set({ drawerOpen: false }); return; }
    if (s.searchOpen) { set({ searchOpen: false, searchQuery: '' }); return; }
    if (s.powerMenuOpen) { set({ powerMenuOpen: false }); return; }
    if (s.appId) {
      if (s.appStack.length > 0) {
        const prev = s.appStack[s.appStack.length - 1];
        set({
          appId: prev.appId,
          appParams: prev.params || {},
          appStack: s.appStack.slice(0, -1),
          screen: 'app',
          softMenu: null,
          appMenu: null,
          activeFieldId: null,
        });
      } else {
        get().closeApp();
      }
      return;
    }
  },
  recentApps: [],
  clearRecent: () => set({ recentApps: [] }),

  drawerOpen: false,
  drawerTab: 'all',
  drawerFolder: null,
  openDrawer: (tab) => set({ drawerOpen: true, drawerTab: tab || 'all', activeFieldId: null, searchOpen: false }),
  closeDrawer: () => set({ drawerOpen: false, drawerFolder: null }),
  setDrawerTab: (tab) => set({ drawerTab: tab, drawerFolder: null }),
  setDrawerFolder: (id) => set({ drawerFolder: id }),

  powerMenuOpen: false,
  setPowerMenuOpen: (v) => set({ powerMenuOpen: v, activeFieldId: null }),
  recentOpen: false,
  setRecentOpen: (v) => set({ recentOpen: v }),
  searchOpen: false,
  searchQuery: '',
  openSearch: (initial) => set({ searchOpen: true, searchQuery: initial || '', activeFieldId: null }),
  closeSearch: () => set({ searchOpen: false, searchQuery: '' }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  activeFieldId: null,
  focusField: (id) => set({ activeFieldId: id }),

  shift: false,
  caps: false,
  ctrl: false,
  alt: false,
  shiftOnce: false,
  setShift: (v) => set({ shift: v }),
  toggleShift: () => set((s) => ({ shift: !s.shift || s.shiftOnce ? !s.shift : !s.shift, shiftOnce: false })),
  toggleCaps: () => set((s) => ({ caps: !s.caps })),
  setCtrl: (v) => set({ ctrl: v }),
  setAlt: (v) => set({ alt: v }),
  consumeShiftOnce: () => set({ shiftOnce: false, shift: false }),

  pressedCodes: [],
  setKeyPressed: (code, down) =>
    set((s) => {
      if (down) return s.pressedCodes.includes(code) ? s : { pressedCodes: [...s.pressedCodes, code] };
      return { pressedCodes: s.pressedCodes.filter((c) => c !== code) };
    }),
  clearPressed: () => set({ pressedCodes: [] }),

  dialog: null,
  showDialog: (d) =>
    set((s) => ({
      dialog: { ...d, id: Date.now() + Math.random(), showCancel: d.showCancel ?? true } as DialogSpec,
      activeFieldId: null,
    })),
  closeDialog: () => set({ dialog: null }),
  toasts: [],
  toast: (text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text }] }));
    window.setTimeout(() => get().dismissToast(id), 2400);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  softMenu: null,
  setSoftMenu: (s) => set({ softMenu: s, activeFieldId: null }),
  appMenu: null,
  setAppMenu: (s) => set({ appMenu: s }),

  battery: { level: 0.82, charging: false },
  setBattery: (b) => set({ battery: b }),
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (v) => set({ online: v }),
  counters: { messages: 0, missedCalls: 0, reminders: 0 },
  setCounters: (c) => set((s) => ({ counters: { ...s.counters, ...c } })),
  refreshCounters: async () => {
    const [threads, messages, calls, events] = await Promise.all([
      loadKey<{ id: string; address: string; name?: string; updatedAt: number }[]>(DB_KEYS.smsThreads, []),
      loadKey<{ threadId: string; read: boolean; direction: 'in' | 'out' }[]>(DB_KEYS.smsMessages, []),
      loadKey<{ type: 'in' | 'out' | 'missed'; at: number }[]>(DB_KEYS.callLog, []),
      loadKey<{ start: number }[]>(DB_KEYS.events, []),
    ]);
    void threads;
    const unread = messages.filter((m) => m.direction === 'in' && !m.read).length;
    const missed = calls.filter((c) => c.type === 'missed' && Date.now() - c.at < 86400000).length;
    const today = new Date();
    const reminders = events.filter((e) => {
      const d = new Date(e.start);
      return d.toDateString() === today.toDateString();
    }).length;
    set({ counters: { messages: unread, missedCalls: missed, reminders } });
  },
  volumeHud: null,
  bumpVolume: (delta, which = 'media') => {
    const s = get();
    if (s.settings.profile === 'silent' && which === 'media') {
      s.showVolume('Silent profile');
      return;
    }
    const key = which === 'ring' ? 'ringVolume' : which === 'alarm' ? 'alarmVolume' : 'volume';
    const current = s.settings[key] as number;
    const next = Math.min(1, Math.max(0, Math.round((current + delta) * 20) / 20));
    if (next === current) {
      set({ volumeHud: { value: next, label: which } });
    } else {
      get().setSetting(key as any, next as any);
      set({ volumeHud: { value: next, label: which } });
      if (which === 'media' && next > 0) {
        audioContext();
        vibrate(6);
      }
    }
    window.setTimeout(() => set({ volumeHud: null }), 1400);
  },
  showVolume: (label) => {
    set({ volumeHud: { value: get().settings.volume, label } });
    window.setTimeout(() => set({ volumeHud: null }), 1200);
  },
  frequency: {},
  recordAppOpen: (id) => {
    const freq = { ...get().frequency, [id]: (get().frequency[id] || 0) + 1 };
    set({ frequency: freq });
    void saveKey(DB_KEYS.frequency, freq);
  },
  nowPlaying: null,
  setNowPlaying: (v) => set({ nowPlaying: v }),
  wallpaperVersion: 0,
  bumpWallpaper: () => set((s) => ({ wallpaperVersion: s.wallpaperVersion + 1 })),
  clockTick: 0,
  tickClock: () => set((s) => ({ clockTick: s.clockTick + 1 })),
  alarmRinging: null,
  setAlarmRinging: (v) => {
    if (v) {
      const s = get();
      if (s.settings.profile !== 'silent') playRingtone(s.settings.alarmTone, s.settings.alarmVolume);
      if (s.settings.vibrate) vibrate([400, 200, 400, 200, 400]);
      set({ alarmRinging: v });
    } else {
      stopRingtone();
      set({ alarmRinging: null });
    }
  },
  incomingCall: null,
  setIncomingCall: (v) => {
    const s = get();
    if (v) {
      if (s.settings.profile !== 'silent') playRingtone(s.settings.ringtone, s.settings.ringVolume);
      if (s.settings.vibrate) vibrate([500, 300, 500, 300, 500]);
      set({ incomingCall: v });
    } else {
      stopRingtone();
      set({ incomingCall: null });
    }
  },
  notify: (title, kind = 'message') => {
    const s = get();
    if (s.settings.profile !== 'silent') messageTone(s.settings.messageTone, s.settings.volume);
    if (s.settings.vibrate) vibrate([120, 60, 120]);
    void s.refreshCounters();
    if (kind === 'message') {
      const c = get().counters;
      set({ counters: { ...c, messages: c.messages + 1 } });
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      try { new Notification('OWL', { body: title, icon: '/pwa-192.png' }); } catch { /* ignore */ }
    }
    if (!s.appId) s.toast(title);
  },
}));

/* subscribe helpers exported for data hooks */
export { subscribeKey };

/* Restore persisted frequency + battery/wifi listeners once, on first import. */
if (typeof window !== 'undefined') {
  void loadKey<Record<string, number>>(DB_KEYS.frequency, {}).then((freq) => {
    if (freq && Object.keys(freq).length) useStore.setState({ frequency: freq });
  });
  void useStore.getState().refreshCounters();

  window.addEventListener('online', () => useStore.getState().setOnline(true));
  window.addEventListener('offline', () => useStore.getState().setOnline(false));

  const nav = navigator as any;
  if (nav.getBattery) {
    nav.getBattery().then((b: any) => {
      const update = () => useStore.getState().setBattery({ level: b.level, charging: b.charging });
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    }).catch(() => {});
  } else {
    // simulated drain: 1% every 90s
    let level = 0.82;
    window.setInterval(() => {
      level = Math.max(0.03, level - 0.01 / 9);
      useStore.getState().setBattery({ level, charging: level > 0.95 });
    }, 10000);
  }
}

export const useSetting = <K extends keyof Settings>(key: K): Settings[K] =>
  useStore((s) => s.settings[key]);

export const useT = () => {
  const lang = useStore((s) => s.settings.language);
  return (en: string, ar: string) => (lang === 'ar' ? ar : en);
};

export const dockIds = (s: Settings): string[] => {
  const ids = s.appOrder.length ? s.appOrder.filter((id) => DOCK_IDS.includes(id)).slice(0, 6) : [];
  return ids.length ? ids : DOCK_IDS;
};

export function profileVolume(s: Settings): number {
  switch (s.profile) {
    case 'loud': return 1;
    case 'vibrate': return 0;
    case 'silent': return 0;
    case 'meeting': return 0.25;
    default: return s.volume;
  }
}

export function profileLabel(p: ProfileId, lang: Lang): string {
  const map: Record<ProfileId, [string, string]> = {
    normal: ['Normal', 'عادي'],
    loud: ['Loud', 'عالي'],
    vibrate: ['Vibrate', 'اهتزاز'],
    silent: ['Silent', 'صامت'],
    meeting: ['Meeting', 'اجتماع'],
    custom: ['Custom', 'مخصص'],
  };
  return map[p][lang === 'ar' ? 1 : 0];
}

export type { OwlStore, DockRows };
