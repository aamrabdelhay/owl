import { useStore } from './store';
import { APP_MAP, appName } from './appRegistry';
import { backspaceField, deleteField, getField, moveCaret, typeIntoField } from './focus';
import type { KeyEventLike, NavDir } from './kernelTypes';
import { keyClick, vibrate } from './audio';

/**
 * OWL OS kernel: single entry point for every key event (real keyboard, touch
 * keyboard or virtual). Turns hardware keys into OS actions and routes text to
 * the active virtual field.
 */

type Handler = (e: KeyEventLike) => boolean;
const appHandlers = new Set<Handler>();

/** Apps register a handler to consume keys they care about (arrow navigation, etc.). */
export function registerAppKeys(handler: Handler): () => void {
  appHandlers.add(handler);
  return () => appHandlers.delete(handler);
}

function runAppHandlers(e: KeyEventLike): boolean {
  for (const h of Array.from(appHandlers)) {
    try {
      if (h(e)) return true;
    } catch { /* keep other handlers alive */ }
  }
  return false;
}

export function typeText(text: string): boolean {
  const state = useStore.getState();
  const field = getField(state.activeFieldId);
  if (!field) return false;
  if (state.settings.keyClick) keyClick(state.settings.keyClickVolume);
  typeIntoField(field, text);
  if (state.settings.vibrateKeys) vibrate(6);
  if (field.id === 'home-search' || field.id === 'lock-pass' || field.id === 'dialog-input') {
    // keep the virtual focus on modal fields even if a re-render drops it
    state.focusField(field.id);
  }
  return true;
}

export function handleBackspace(): boolean {
  const state = useStore.getState();
  const field = getField(state.activeFieldId);
  if (field) {
    backspaceField(field);
    return true;
  }
  return false;
}

export function handleDelete(): boolean {
  const field = getField(useStore.getState().activeFieldId);
  if (field) {
    deleteField(field);
    return true;
  }
  return false;
}

function isRTL(): boolean {
  return !!document.querySelector('.screenRoot[dir="rtl"]');
}

function moveFocusInDOM(dir: NavDir): boolean {
  const root = document.querySelector('.screenRoot');
  if (!root) return false;
  const current = document.activeElement && root.contains(document.activeElement)
    ? (document.activeElement as HTMLElement)
    : null;
  const selector = '[data-nav], button, [role="option"], [role="menuitem"], .rowBtn, .dockItem, .drawerCell, [tabindex]:not([tabindex="-1"])';
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    if (!(el as any).dataset || el.closest('[aria-hidden="true"]')) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
    if (el.offsetParent === null && el.tagName !== 'BODY' && style.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

  if (!nodes.length) return false;

  if (!current) {
    // focus the first sensible element
    focusEl(nodes[0]);
    return true;
  }

  const currentRect = current.getBoundingClientRect();
  const cx = currentRect.left + currentRect.width / 2;
  const cy = currentRect.top + currentRect.height / 2;
  const rtl = isRTL();
  const dirX = rtl && (dir === 'left' || dir === 'right') ? (dir === 'left' ? 'right' : 'left') : dir;

  const scored = nodes
    .filter((el) => el !== current)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = ex - cx;
      const dy = ey - cy;
      return { el, dx, dy, r };
    });

  let best: { el: HTMLElement; score: number } | null = null;
  for (const { el, dx, dy } of scored) {
    let primary = 0;
    let secondary = 0;
    if (dirX === 'up' && dy < -2) { primary = -dy; secondary = Math.abs(dx); }
    else if (dirX === 'down' && dy > 2) { primary = dy; secondary = Math.abs(dx); }
    else if (dirX === 'left' && dx < -2) { primary = -dx; secondary = Math.abs(dy); }
    else if (dirX === 'right' && dx > 2) { primary = dx; secondary = Math.abs(dy); }
    else continue;
    // favor alignment: perpendicular offset costs a lot
    const score = primary + secondary * 1.8;
    if (!best || score < best.score) best = { el, score };
  }

  if (best) {
    focusEl(best.el);
    return true;
  }
  return false;
}

function focusEl(el: HTMLElement) {
  try {
    el.focus({ preventScroll: false });
  } catch {
    el.focus();
  }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function moveFocus(dir: NavDir): boolean {
  const state = useStore.getState();
  const activeField = getField(state.activeFieldId);
  if (activeField?.onMove) {
    if (activeField.onMove(dir)) return true;
  }
  if (isTextFieldNav(dir)) {
    if (activeField) moveCaret(activeField, dir === 'left' ? -1 : 1);
    return true;
  }
  return moveFocusInDOM(dir);
}

function isTextFieldNav(dir: NavDir): boolean {
  const field = getField(useStore.getState().activeFieldId);
  return !!field && (dir === 'left' || dir === 'right');
}

/* --------------------------------- Actions -------------------------------- */

function homeAction() {
  const s = useStore.getState();
  s.closeApp();
}

function menuAction() {
  const s = useStore.getState();
  if (s.screen === 'lock') {
    s.openSearch();
    return;
  }
  if (s.appId) {
    if (s.appMenu) { s.setSoftMenu(s.appMenu); }
    else s.openDrawer();
    return;
  }
  if (s.drawerOpen) { s.closeDrawer(); return; }
  if (s.searchOpen) { s.closeSearch(); return; }
  s.openDrawer();
}

function callAction() {
  const s = useStore.getState();
  if (s.screen === 'lock') {
    void s.unlock();
    return;
  }
  s.openApp('phone');
}

function endAction() {
  const s = useStore.getState();
  if (s.screen === 'off') { s.powerOn(); return; }
  if (s.incomingCall) { s.setIncomingCall(null); return; }
  if (s.alarmRinging) { s.setAlarmRinging(null); return; }
  s.lock();
}

function escapeAction() {
  const s = useStore.getState();
  if (s.softMenu) { s.setSoftMenu(null); return; }
  if (s.powerMenuOpen) { s.setPowerMenuOpen(false); return; }
  if (s.recentOpen) { s.setRecentOpen(false); return; }
  if (s.dialog) { s.closeDialog(); return; }
  const field = getField(s.activeFieldId);
  field?.onEscape?.();
  if (s.screen === 'lock') return;
  s.back();
}

function enterAction() {
  const s = useStore.getState();
  if (s.screen === 'lock') {
    if (s.settings.passwordHash) {
      const field = getField('lock-pass');
      field?.onSubmit?.();
    } else {
      void s.unlock();
    }
    return;
  }
  const field = getField(s.activeFieldId);
  if (field) {
    field.onSubmit?.();
    return;
  }
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== document.body && document.querySelector('.screenRoot')?.contains(active)) {
    active.click();
    return;
  }
  moveFocusInDOM('down');
}

/* --------------------------------- Router -------------------------------- */

const HOTKEY_HOLD_MS = 380;
let holdTimer: number | undefined;
let holdLetter: string | null = null;

export function onKeyUp(e: { key: string; code: string }) {
  if (holdTimer) window.clearTimeout(holdTimer);
  const letter = holdLetter;
  holdLetter = null;
  if (!letter) return;
  const s = useStore.getState();
  // A quick tap already opened the search and put the letter in it; only a
  // hold that has not fired yet should launch the hotkey here.
  if (s.searchOpen || s.appId) return;
  const target = s.settings.hotkeys[letter];
  if (target && APP_MAP[target] && s.screen === 'home' && s.settings.onboarded) {
    s.toast(`Hotkey ${letter.toUpperCase()} → ${appName(target, s.settings.language)}`);
    s.openApp(target);
  }
}

/** Main key router. Returns true when the event was consumed. */
export function dispatchKey(e: KeyEventLike): boolean {
  const s = useStore.getState();
  if (!s.powered) {
    if (e.key === 'F3' || e.code === 'Power') { s.powerOn(); return true; }
    return false;
  }

  // real hardware shortcuts that must always pass through untouched
  if (e.ctrl && e.dispatch === 'physical') {
    const k = e.key.toLowerCase();
    if (['r', 'c', 'v', 'x', 'a', 'z', 't', 'w', 'n', 'f', 'p', 's', 'd', 'l'].includes(k)) {
      // only browser-level combos that the OS does not use
      if (!['c', 'v', 'x', 'a', 'z'].includes(k)) return false;
      if (!useStore.getState().activeFieldId) return false;
    }
  }

  if (runAppHandlers(e)) return true;

  if (e.code === 'F1') { menuAction(); return true; }
  if (e.code === 'F2') { callAction(); return true; }
  if (e.code === 'F3') {
    if (s.screen === 'off') s.powerOn();
    else endAction();
    return true;
  }
  if (e.code === 'PageUp') { s.bumpVolume(0.05, 'media'); return true; }
  if (e.code === 'PageDown') { s.bumpVolume(-0.05, 'media'); return true; }
  if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') {
    // Alt alone acts as Menu on release; handled in App via keyup, so just mark
    return true;
  }

  if (e.key === 'Escape') { escapeAction(); return true; }

  const field = getField(s.activeFieldId);

  if (e.key === 'Backspace') {
    if (!handleBackspace()) {
      if (s.drawerFolder) { s.setDrawerFolder(null); return true; }
      if (s.searchOpen) { s.closeSearch(); return true; }
    }
    return true;
  }
  if (e.key === 'Delete') {
    if (!handleDelete()) return true;
    return true;
  }

  if (e.key === 'Enter') {
    if (field) { field.onSubmit?.(); return true; }
    enterAction();
    return true;
  }
  if (e.key === 'Tab') {
    moveFocus(e.shift ? 'up' : 'down');
    return true;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const dir = e.key.replace('Arrow', '').toLowerCase() as NavDir;
    if (field) {
      const moved = field.onMove?.(dir);
      if (moved) return true;
      if (dir === 'left' || dir === 'right') { moveCaret(field, dir === 'left' ? -1 : 1); return true; }
      if (dir === 'up' || dir === 'down') {
        moveFocusInDOM(dir);
        return true;
      }
    }
    const moved = moveFocusInDOM(dir);
    if (!moved && dir === 'down') moveFocusInDOM('up');
    return true;
  }

  if (e.key === ' ') {
    if (field) { typeText(' '); return true; }
    // Space activates the focused control
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body) { active.click(); return true; }
    return true;
  }

  // printable character
  if (e.key.length > 0) {
    // Typing another character means the user is searching, not holding a
    // letter to launch its hotkey. Key repeats of the held letter keep it alive.
    if (holdLetter !== null && !e.repeat) {
      window.clearTimeout(holdTimer);
      holdLetter = null;
    }
    // On the lock screen the only sink is the password field; never fall
    // through to search or app shortcuts.
    if (s.screen === 'lock' && !field) return true;
    if (field) {
      if (e.key >= '0' && e.key <= '9' && field.kind === 'number') { typeText(e.key); return true; }
      if (field.kind === 'number' && !/[0-9]/.test(e.key)) return true;
      if (field.kind === 'decimal' && !/[0-9.]/.test(e.key)) return true;
      if (field.kind === 'phone' && !/[0-9+\-*#() ]/.test(e.key)) return true;
      if (field.maxLength && field.getValue().replace('\u0001', '').length >= field.maxLength) return true;
      typeText(e.key);
      return true;
    }
    if (s.appId || s.screen === 'lock') {
      // app-level unhandled char: apps with their own keyboard handling get it
      return false;
    }
    if (s.drawerOpen) {
      s.closeDrawer();
      s.openSearch(e.key);
      window.setTimeout(() => s.focusField('home-search'), 30);
      return true;
    }
    if (s.searchOpen) {
      s.setSearchQuery(s.searchQuery + e.key);
      window.setTimeout(() => s.focusField('home-search'), 10);
      return true;
    }
    // Hold-to-launch hotkeys on the home screen. A quick tap opens the
    // universal search with the letter already typed; holding the letter for
    // HOTKEY_HOLD_MS launches that app instead.
    if (!s.searchOpen) {
      holdLetter = e.key.toLowerCase();
      if (!e.repeat) {
        window.clearTimeout(holdTimer);
        holdTimer = window.setTimeout(() => {
          const st = useStore.getState();
          const letter = holdLetter;
          if (!letter || !st.searchOpen) return;
          const target = st.settings.hotkeys[letter];
          if (target && APP_MAP[target]) {
            st.closeSearch();
            st.toast(`Hotkey ${letter.toUpperCase()} → ${appName(target, st.settings.language)}`);
            st.openApp(target);
          }
          holdLetter = null;
        }, HOTKEY_HOLD_MS);
      }
    }
    s.openSearch(e.key);
    window.setTimeout(() => s.focusField('home-search'), 30);
    return true;
  }

  return false;
}

export function registerPowerLongPress() {
  /* handled inside PhoneShell */
}

export { homeAction, menuAction, callAction, endAction, escapeAction, enterAction };
