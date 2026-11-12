/* Shared OS types for OWL OS */

export type ThemeId = 'owl-night' | 'classic-silver' | 'forest' | 'ruby' | 'ocean' | 'lcd';
export type Lang = 'en' | 'ar';
export type ProfileId = 'normal' | 'loud' | 'vibrate' | 'silent' | 'meeting' | 'custom';
export type Screen = 'boot' | 'home' | 'lock' | 'off' | 'app';
export type DockRows = 'one' | 'two' | 'hidden';
export type KeyboardMode = 'blackberry' | 'simple';

export interface Settings {
  language: Lang;
  keyboardMode: KeyboardMode;
  screenShare: number;
  keyboardScale: number;
  geminiApiKey: string;
  youtubeApiKey: string;
  aiAutoReply: boolean;
  aiAutoAnswer: boolean;
  userName: string;
  theme: ThemeId;
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  uiScale: number;
  fontScale: number;
  brightness: number;
  backlight: number; // seconds, 0 = off
  volume: number;
  ringVolume: number;
  alarmVolume: number;
  keyClick: boolean;
  keyClickVolume: number;
  vibrateKeys: boolean;
  vibrate: boolean;
  profile: ProfileId;
  ringtone: string;
  messageTone: string;
  alarmTone: string;
  clock24: boolean;
  timezone: string;
  showSeconds: boolean;
  wallpaperId: string;
  lockWallpaperId: string;
  useSeparateLockWallpaper: boolean;
  dockRows: DockRows;
  hotkeys: Record<string, string>;
  favorites: string[];
  hiddenApps: string[];
  appOrder: string[];
  folders: { id: string; name: string; apps: string[] }[];
  passwordHash: string;
  passwordSalt: string;
  passwordIsPin: boolean;
  autoLock: number; // seconds, 0 = never
  powerSaver: boolean;
  bluetooth: boolean;
  wifiOnly: boolean;
  onboarded: boolean;
  homePage: string;
  installedAt: number;
}

export interface AppMeta {
  id: string;
  name: Record<Lang, string>;
  icon: string;
  color: string;
  category: 'communication' | 'internet' | 'media' | 'camera' | 'utilities' | 'games' | 'system';
  hotkey?: string;
  dock?: boolean;
  load: () => Promise<{ default: React.ComponentType<any> }>;
}

export interface NavSnapshot {
  items: string[];
  index: number;
}

export interface DialogSpec {
  id: number;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  input?: { label: string; value: string; placeholder?: string; password?: boolean; multiline?: boolean };
  onConfirm: (value: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

export interface SoftMenuAction {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  run: () => void;
}

export interface SoftMenuSpec {
  title: string;
  actions: SoftMenuAction[];
}

export interface ToastSpec { id: number; text: string }

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  group: string;
  favorite: boolean;
  speedDial: number | null;
  photo?: string; // data URL
  createdAt: number;
}

export interface SmsMessage {
  id: string;
  threadId: string;
  address: string;
  body: string;
  at: number;
  direction: 'in' | 'out';
  status: 'sent' | 'delivered' | 'draft';
  read: boolean;
}

export interface SmsThread {
  id: string;
  address: string;
  name?: string;
  updatedAt: number;
  archived?: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  category: string;
  at: number;
  updatedAt: number;
}

export interface TaskItem {
  id: string;
  title: string;
  notes: string;
  due?: string;
  priority: 'low' | 'normal' | 'high';
  status: 'not-started' | 'in-progress' | 'completed';
  category: string;
  createdAt: number;
}

export interface CalEvent {
  id: string;
  title: string;
  location: string;
  notes: string;
  start: number; // epoch ms
  end: number;
  allDay: boolean;
  reminderMinutes: number | null;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  color: string;
  taskId?: string;
}

export interface VaultEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  website: string;
  notes: string;
  updatedAt: number;
}

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  label: string;
  days: number[]; // 0=Sun
  enabled: boolean;
  sound: string;
  snoozeUntil?: number;
}

export interface ChatMessage {
  id: string;
  from: 'me' | 'them';
  body: string;
  at: number;
  read: boolean;
}

export interface ChatThread {
  id: string;
  name: string;
  avatar: string;
  color: string;
  messages: ChatMessage[];
  typing?: boolean;
}

export interface CallLogEntry {
  id: string;
  number: string;
  name?: string;
  type: 'in' | 'out' | 'missed';
  at: number;
  duration: number;
}

export interface VoiceNote {
  id: string;
  name: string;
  blob: Blob;
  at: number;
  duration: number;
}

export interface PhotoItem {
  id: string;
  name: string;
  blob: Blob;
  at: number;
  width: number;
  height: number;
}

export interface BrowserBookmark { id: string; title: string; url: string; at: number }
export interface BrowserHistory { id: string; title: string; url: string; at: number }
export interface BrowserTab { id: string; title: string; url: string; historyIndex: number; history: string[] }

export interface GameScore { game: string; score: number; extra?: string; at: number }
