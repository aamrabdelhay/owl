import type { AppMeta, Lang } from './types';

const n = (en: string, ar: string): Record<Lang, string> => ({ en, ar });

/**
 * OWL OS app registry. Every entry is code-split with React.lazy so the home
 * screen boots fast; only the opened app's chunk is fetched.
 */
export const APPS: AppMeta[] = [
  /* ---------------------------- Communication ---------------------------- */
  {
    id: 'phone', name: n('Phone', 'الهاتف'), icon: 'phone', color: '#2fbf71',
    category: 'communication', hotkey: 'p', dock: false,
    load: () => import('../apps/Phone/PhoneApp'),
  },
  {
    id: 'messages', name: n('Messages', 'الرسائل'), icon: 'message', color: '#3f8cff',
    category: 'communication', hotkey: 'm', dock: true,
    load: () => import('../apps/Messages/MessagesApp'),
  },
  {
    id: 'messenger', name: n('Owl Messenger', 'Owl ماسنجر'), icon: 'chat', color: '#7c5cff',
    category: 'communication', hotkey: 'o', dock: true,
    load: () => import('../apps/Messenger/MessengerApp'),
  },
  {
    id: 'contacts', name: n('Contacts', 'جهات الاتصال'), icon: 'contacts', color: '#f0a13c',
    category: 'communication', hotkey: 'a', dock: true,
    load: () => import('../apps/Contacts/ContactsApp'),
  },
  {
    id: 'email', name: n('Email', 'البريد'), icon: 'mail', color: '#42b8d8',
    category: 'communication', hotkey: 'e', dock: false,
    load: () => import('../apps/Email/EmailApp'),
  },

  /* ------------------------------- Internet ------------------------------- */
  {
    id: 'web', name: n('Owl Web', 'Owl ويب'), icon: 'globe', color: '#1f9cf0',
    category: 'internet', hotkey: 'b', dock: true,
    load: () => import('../apps/Web/WebApp'),
  },

  /* -------------------------------- Media -------------------------------- */
  {
    id: 'music', name: n('Music', 'الموسيقى'), icon: 'music', color: '#e4572e',
    category: 'media', hotkey: 'w', dock: false,
    load: () => import('../apps/Music/MusicApp'),
  },
  {
    id: 'videos', name: n('Videos', 'الفيديو'), icon: 'video', color: '#8e5cf7',
    category: 'media', hotkey: 'v', dock: false,
    load: () => import('../apps/Videos/VideosApp'),
  },
  {
    id: 'pictures', name: n('Pictures', 'الصور'), icon: 'image', color: '#f2668b',
    category: 'media', hotkey: 'i', dock: false,
    load: () => import('../apps/Pictures/PicturesApp'),
  },
  {
    id: 'voice', name: n('Voice Notes', 'ملاحظات صوتية'), icon: 'mic', color: '#e0475b',
    category: 'media', hotkey: 'r', dock: false,
    load: () => import('../apps/VoiceNotes/VoiceNotesApp'),
  },
  {
    id: 'ringtones', name: n('Ringtones', 'النغمات'), icon: 'bell', color: '#d9a419',
    category: 'media', hotkey: 'j', dock: false,
    load: () => import('../apps/Ringtones/RingtonesApp'),
  },
  {
    id: 'radio', name: n('Owl Radio', 'Owl راديو'), icon: 'radio', color: '#38b6a4',
    category: 'media', hotkey: 'y', dock: false,
    load: () => import('../apps/Radio/RadioApp'),
  },

  /* -------------------------------- Camera -------------------------------- */
  {
    id: 'camera', name: n('Camera', 'الكاميرا'), icon: 'camera', color: '#5c6f8f',
    category: 'camera', hotkey: 'h', dock: false,
    load: () => import('../apps/Camera/CameraApp'),
  },
  {
    id: 'flashlight', name: n('Flashlight', 'الكشاف'), icon: 'flash', color: '#f2c14e',
    category: 'camera', hotkey: 't', dock: false,
    load: () => import('../apps/Flashlight/FlashlightApp'),
  },
  {
    id: 'compass', name: n('Compass', 'البوصلة'), icon: 'compass', color: '#4aa3ff',
    category: 'camera', hotkey: 'z', dock: false,
    load: () => import('../apps/Compass/CompassApp'),
  },

  /* ------------------------------ Utilities ------------------------------- */
  {
    id: 'calendar', name: n('Calendar', 'التقويم'), icon: 'calendar', color: '#ff6b5b',
    category: 'utilities', hotkey: 'c', dock: true,
    load: () => import('../apps/Calendar/CalendarApp'),
  },
  {
    id: 'clock', name: n('Clock', 'الساعة'), icon: 'clock', color: '#5b7cfa',
    category: 'utilities', hotkey: 'd', dock: false,
    load: () => import('../apps/Clock/ClockApp'),
  },
  {
    id: 'calculator', name: n('Calculator', 'الآلة الحاسبة'), icon: 'calc', color: '#7d8ba1',
    category: 'utilities', hotkey: 'k', dock: false,
    load: () => import('../apps/Calculator/CalculatorApp'),
  },
  {
    id: 'converter', name: n('Converter', 'المحول'), icon: 'swap', color: '#32b0a0',
    category: 'utilities', hotkey: 'q', dock: false,
    load: () => import('../apps/Converter/ConverterApp'),
  },
  {
    id: 'memo', name: n('Memo Pad', 'المفكرة'), icon: 'memo', color: '#e8b74a',
    category: 'utilities', hotkey: 'n', dock: false,
    load: () => import('../apps/Memo/MemoApp'),
  },
  {
    id: 'tasks', name: n('Tasks', 'المهام'), icon: 'task', color: '#4cc38a',
    category: 'utilities', hotkey: 'g', dock: false,
    load: () => import('../apps/Tasks/TasksApp'),
  },
  {
    id: 'passwords', name: n('Password Keeper', 'خزانة كلمات المرور'), icon: 'lock', color: '#c0a15a',
    category: 'utilities', hotkey: 'l', dock: false,
    load: () => import('../apps/Passwords/PasswordsApp'),
  },
  {
    id: 'files', name: n('File Manager', 'مدير الملفات'), icon: 'folder', color: '#d9a441',
    category: 'utilities', hotkey: 'f', dock: false,
    load: () => import('../apps/Files/FilesApp'),
  },

  /* --------------------------------- Games -------------------------------- */
  {
    id: 'games', name: n('Games', 'الألعاب'), icon: 'game', color: '#43b581',
    category: 'games', hotkey: 'x', dock: false,
    load: () => import('../apps/Games/GamesHub'),
  },
  {
    id: 'snake', name: n('Owl Snake', 'أفعى البومة'), icon: 'snake', color: '#4caf50',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/SnakeGame'),
  },
  {
    id: 'breaker', name: n('Owl Breaker', 'كسّار البومة'), icon: 'block', color: '#ef7d3f',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/BreakerGame'),
  },
  {
    id: 'skyowl', name: n('Sky Owl', 'بومة السماء'), icon: 'skyowl', color: '#4f9dff',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/SkyOwlGame'),
  },
  {
    id: 'pairs', name: n('Pairs', 'الأزواج'), icon: 'cards', color: '#b06cf0',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/PairsGame'),
  },
  {
    id: 'mancala', name: n('Mancala', 'المنقلة'), icon: 'mancala', color: '#c9922f',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/MancalaGame'),
  },
  {
    id: 'sudoku', name: n('Sudoku', 'سودوكو'), icon: 'sudoku', color: '#4f8dd4',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/SudokuGame'),
  },
  {
    id: 'blocks', name: n('Block Stack', 'مكعبات'), icon: 'tetris', color: '#e0575b',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/BlocksGame'),
  },
  {
    id: 'wordowl', name: n('Word Owl', 'كلمة البومة'), icon: 'word', color: '#e0b34b',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/WordOwlGame'),
  },
  {
    id: 'solitaire', name: n('Solitaire', 'سوليتير'), icon: 'solitaire', color: '#3fa36b',
    category: 'games', hotkey: '', dock: false,
    load: () => import('../apps/Games/SolitaireGame'),
  },

  /* -------------------------------- System -------------------------------- */
  {
    id: 'themes', name: n('Themes', 'السمات'), icon: 'palette', color: '#a86cf0',
    category: 'system', hotkey: 'u', dock: false,
    load: () => import('../apps/Themes/ThemesApp'),
  },
  {
    id: 'profiles', name: n('Profiles', 'أنماط الصوت'), icon: 'volume', color: '#5aa9e6',
    category: 'system', hotkey: '', dock: false,
    load: () => import('../apps/Profiles/ProfilesApp'),
  },
  {
    id: 'settings', name: n('Settings', 'الإعدادات'), icon: 'settings', color: '#748399',
    category: 'system', hotkey: 's', dock: false,
    load: () => import('../apps/Settings/SettingsApp'),
  },
  {
    id: 'setup', name: n('Setup Wizard', 'معالج الإعداد'), icon: 'wand', color: '#e8a33d',
    category: 'system', hotkey: '', dock: false,
    load: () => import('../apps/Setup/SetupApp'),
  },
  {
    id: 'help', name: n('Quick Help', 'مساعدة سريعة'), icon: 'help', color: '#4ba3c7',
    category: 'system', hotkey: '', dock: false,
    load: () => import('../apps/Help/HelpApp'),
  },
];

export const APP_MAP: Record<string, AppMeta> = Object.fromEntries(APPS.map((a) => [a.id, a]));

export const GAME_IDS = APPS.filter((a) => a.category === 'games' && a.dock === false && a.id !== 'games').map((a) => a.id);

export const DOCK_IDS = ['messages', 'messenger', 'contacts', 'web', 'music', 'calendar'];

export const MEDIA_IDS = ['music', 'videos', 'pictures', 'voice', 'ringtones', 'radio', 'camera'];

export function appName(id: string, lang: Lang): string {
  const app = APP_MAP[id];
  if (!app) return id;
  return app.name[lang] || app.name.en;
}

export function appIcon(id: string): string {
  return APP_MAP[id]?.icon || 'info';
}

export function appColor(id: string): string {
  return APP_MAP[id]?.color || '#4a5568';
}

export function searchApps(query: string, lang: Lang): AppMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return APPS;
  return APPS.filter(
    (a) => a.name.en.toLowerCase().includes(q) || a.name.ar.includes(query) || a.id.includes(q)
  );
}

export default APPS;
