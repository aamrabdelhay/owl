import type { Lang } from './types';

type Dict = Record<string, { en: string; ar: string }>;

/**
 * OWL OS i18n dictionary. English + Arabic (RTL).
 * Keys are grouped by app area. Use t('key') from the store.
 */
const dict: Dict = {
  /* global */
  'menu': { en: 'Menu', ar: 'القائمة' },
  'back': { en: 'Back', ar: 'رجوع' },
  'call': { en: 'Call', ar: 'اتصال' },
  'end': { en: 'End', ar: 'إنهاء' },
  'ok': { en: 'OK', ar: 'حسناً' },
  'cancel': { en: 'Cancel', ar: 'إلغاء' },
  'save': { en: 'Save', ar: 'حفظ' },
  'delete': { en: 'Delete', ar: 'حذف' },
  'edit': { en: 'Edit', ar: 'تعديل' },
  'add': { en: 'Add', ar: 'إضافة' },
  'search': { en: 'Search', ar: 'بحث' },
  'close': { en: 'Close', ar: 'إغلاق' },
  'done': { en: 'Done', ar: 'تم' },
  'yes': { en: 'Yes', ar: 'نعم' },
  'no': { en: 'No', ar: 'لا' },
  'loading': { en: 'Loading…', ar: 'جارٍ التحميل…' },
  'open': { en: 'Open', ar: 'فتح' },
  'new': { en: 'New', ar: 'جديد' },
  'all': { en: 'All', ar: 'الكل' },
  'none': { en: 'None', ar: 'بدون' },
  'today': { en: 'Today', ar: 'اليوم' },
  'tomorrow': { en: 'Tomorrow', ar: 'غداً' },
  'yesterday': { en: 'Yesterday', ar: 'أمس' },
  'empty': { en: 'Nothing here yet', ar: 'لا يوجد شيء بعد' },
  'on': { en: 'On', ar: 'تشغيل' },
  'off': { en: 'Off', ar: 'إيقاف' },
  'enabled': { en: 'Enabled', ar: 'مفعّل' },
  'disabled': { en: 'Disabled', ar: 'معطّل' },

  /* home */
  'home.drawer': { en: 'Applications', ar: 'التطبيقات' },
  'home.searchHint': { en: 'Search apps, contacts, notes…', ar: 'ابحث في التطبيقات وجهات الاتصال والملاحظات…' },
  'home.searchWeb': { en: 'Search the web with Owl Web', ar: 'ابحث في الويب عبر Owl Web' },
  'home.noResults': { en: 'No results', ar: 'لا توجد نتائج' },
  'home.silent': { en: 'Silent profile on', ar: 'الوضع الصامت مفعّل' },
  'home.holdLetter': { en: 'Hold a letter to launch its hotkey', ar: 'اضغط مطولاً على حرف لفتح اختصاره' },

  /* tabs */
  'tab.all': { en: 'All', ar: 'الكل' },
  'tab.favorites': { en: 'Favorites', ar: 'المفضلة' },
  'tab.media': { en: 'Media', ar: 'الوسائط' },
  'tab.games': { en: 'Games', ar: 'الألعاب' },
  'tab.downloads': { en: 'Downloads', ar: 'التنزيلات' },
  'tab.frequent': { en: 'Frequent', ar: 'الأكثر استخداماً' },

  /* lock */
  'lock.unlockHint': { en: 'Press Menu then Enter to unlock', ar: 'اضغط القائمة ثم Enter للفتح' },
  'lock.enterPass': { en: 'Enter password', ar: 'أدخل كلمة المرور' },
  'lock.wrong': { en: 'Wrong password', ar: 'كلمة مرور خاطئة' },
  'lock.cooldown': { en: 'Too many attempts. Wait 10s.', ar: 'محاولات كثيرة. انتظر ١٠ ثوانٍ.' },

  /* boot/power */
  'boot.loading': { en: 'Loading', ar: 'جارٍ التحميل' },
  'power.title': { en: 'Device', ar: 'الجهاز' },
  'power.lock': { en: 'Lock keyboard', ar: 'قفل لوحة المفاتيح' },
  'power.shutdown': { en: 'Shutdown', ar: 'إيقاف التشغيل' },
  'power.restart': { en: 'Restart', ar: 'إعادة التشغيل' },
  'power.off': { en: 'Powered off — press Power to start', ar: 'الجهاز مطفأ — اضغط زر التشغيل' },

  /* settings */
  'settings.title': { en: 'Settings', ar: 'الإعدادات' },
  'settings.display': { en: 'Display', ar: 'الشاشة' },
  'settings.sound': { en: 'Sound', ar: 'الصوت' },
  'settings.wallpaper': { en: 'Wallpaper', ar: 'الخلفية' },
  'settings.themes': { en: 'Themes', ar: 'السمات' },
  'settings.home': { en: 'Home screen', ar: 'الشاشة الرئيسية' },
  'settings.security': { en: 'Security', ar: 'الأمان' },
  'settings.datetime': { en: 'Date & Time', ar: 'التاريخ والوقت' },
  'settings.language': { en: 'Language', ar: 'اللغة' },
  'settings.battery': { en: 'Battery', ar: 'البطارية' },
  'settings.storage': { en: 'Storage', ar: 'التخزين' },
  'settings.accessibility': { en: 'Accessibility', ar: 'سهولة الوصول' },
  'settings.profiles': { en: 'Sound profiles', ar: 'أنماط الصوت' },
  'settings.reset': { en: 'Reset OS', ar: 'إعادة ضبط النظام' },
  'settings.about': { en: 'About', ar: 'حول' },
  'settings.help': { en: 'Quick help', ar: 'مساعدة سريعة' },
  'settings.brightness': { en: 'Brightness', ar: 'السطوع' },
  'settings.backlight': { en: 'Backlight timeout', ar: 'مهلة الإضاءة' },
  'settings.fontSize': { en: 'Font size', ar: 'حجم الخط' },
  'settings.uiScale': { en: 'UI scale', ar: 'مقياس الواجهة' },
  'settings.volume': { en: 'Volume', ar: 'مستوى الصوت' },
  'settings.ringtone': { en: 'Ringtone', ar: 'نغمة الرنين' },
  'settings.keyClick': { en: 'Key click sound', ar: 'صوت المفاتيح' },
  'settings.vibrate': { en: 'Vibrate on key', ar: 'اهتزاز عند الكتابة' },
  'settings.clockFormat': { en: 'Clock format', ar: 'تنسيق الساعة' },
  'settings.timezone': { en: 'Time zone', ar: 'المنطقة الزمنية' },
  'settings.dockRows': { en: 'Shortcut rows', ar: 'صفوف الاختصارات' },
  'settings.hotkeys': { en: 'Hotkeys', ar: 'الاختصارات' },
  'settings.setPassword': { en: 'Set password', ar: 'تعيين كلمة مرور' },
  'settings.changePassword': { en: 'Change password', ar: 'تغيير كلمة المرور' },
  'settings.removePassword': { en: 'Remove password', ar: 'إزالة كلمة المرور' },
  'settings.autoLock': { en: 'Auto-lock after', ar: 'القفل التلقائي بعد' },
  'settings.clearData': { en: 'Clear local data', ar: 'مسح البيانات المحلية' },
  'settings.highContrast': { en: 'High contrast', ar: 'تباين عالٍ' },
  'settings.largeText': { en: 'Large text', ar: 'نص كبير' },
  'settings.powerSaver': { en: 'Power saver', ar: 'توفير الطاقة' },

  /* apps generic */
  'app.messages': { en: 'Messages', ar: 'الرسائل' },
  'app.phone': { en: 'Phone', ar: 'الهاتف' },
  'app.messenger': { en: 'Owl Messenger', ar: 'Owl ماسنجر' },
  'app.contacts': { en: 'Contacts', ar: 'جهات الاتصال' },
  'app.email': { en: 'Email', ar: 'البريد' },
  'app.web': { en: 'Owl Web', ar: 'Owl ويب' },
  'app.music': { en: 'Music', ar: 'الموسيقى' },
  'app.videos': { en: 'Videos', ar: 'الفيديو' },
  'app.pictures': { en: 'Pictures', ar: 'الصور' },
  'app.voice': { en: 'Voice Notes', ar: 'ملاحظات صوتية' },
  'app.ringtones': { en: 'Ringtones', ar: 'النغمات' },
  'app.radio': { en: 'Owl Radio', ar: 'Owl راديو' },
  'app.camera': { en: 'Camera', ar: 'الكاميرا' },
  'app.flashlight': { en: 'Flashlight', ar: 'الكشاف' },
  'app.compass': { en: 'Compass', ar: 'البوصلة' },
  'app.calendar': { en: 'Calendar', ar: 'التقويم' },
  'app.clock': { en: 'Clock', ar: 'الساعة' },
  'app.calculator': { en: 'Calculator', ar: 'الآلة الحاسبة' },
  'app.converter': { en: 'Converter', ar: 'المحول' },
  'app.memo': { en: 'Memo Pad', ar: 'المفكرة' },
  'app.tasks': { en: 'Tasks', ar: 'المهام' },
  'app.passwords': { en: 'Password Keeper', ar: 'خزانة كلمات المرور' },
  'app.files': { en: 'File Manager', ar: 'مدير الملفات' },
  'app.games': { en: 'Games', ar: 'الألعاب' },
  'app.themes': { en: 'Themes', ar: 'السمات' },
  'app.profiles': { en: 'Profiles', ar: 'أنماط الصوت' },
  'app.settings': { en: 'Settings', ar: 'الإعدادات' },
  'app.setup': { en: 'Setup Wizard', ar: 'معالج الإعداد' },
  'app.help': { en: 'Quick Help', ar: 'مساعدة سريعة' },
  'app.media': { en: 'Media', ar: 'الوسائط' },
  'app.snake': { en: 'Owl Snake', ar: 'أفعى البومة' },
  'app.breaker': { en: 'Owl Breaker', ar: 'كسّار البومة' },
  'app.skyowl': { en: 'Sky Owl', ar: 'بومة السماء' },
  'app.pairs': { en: 'Pairs', ar: 'الأزواج' },
  'app.mancala': { en: 'Mancala', ar: 'المنقلة' },
  'app.sudoku': { en: 'Sudoku', ar: 'سودوكو' },
  'app.blocks': { en: 'Block Stack', ar: 'مكعبات' },
  'app.wordowl': { en: 'Word Owl', ar: 'كلمة البومة' },
  'app.solitaire': { en: 'Solitaire', ar: 'سوليتير' },

  /* misc */
  'notices.simulatedCalls': { en: 'Calls are simulated — no real network is used.', ar: 'المكالمات محاكاة — لا يوجد اتصال حقيقي.' },
  'notices.localOnly': { en: 'Everything stays on your device.', ar: 'كل شيء يبقى على جهازك.' },
  'notices.downloadsOff': { en: 'Downloads are disabled in this simulator.', ar: 'التنزيلات معطّلة في هذا المحاكي.' },
  'battery.charging': { en: 'Charging', ar: 'جارٍ الشحن' },
  'carrier': { en: 'OWL', ar: 'OWL' },
};

export function translate(lang: Lang, key: string): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] || entry.en;
}

export function allKeys(): string[] {
  return Object.keys(dict);
}

export function isRTL(lang: Lang) {
  return lang === 'ar';
}

export function formatNumber(lang: Lang, value: number) {
  try {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US').format(value);
  } catch {
    return String(value);
  }
}

export function formatDate(
  lang: Lang,
  date: Date | number,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
) {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', opts).format(date);
  } catch {
    return String(date);
  }
}

export function formatTime(lang: Lang, date: Date | number, clock24: boolean) {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !clock24,
    }).format(date);
  } catch {
    const d = new Date(date);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
