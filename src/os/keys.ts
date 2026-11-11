/**
 * Physical + on-screen keyboard model.
 * The device has a full laptop-style QWERTY layout; event.code is the source
 * of truth so layout/IME doesn't break the mapping.
 */

export type KeyKind = 'char' | 'action' | 'modifier' | 'nav';

export interface KeyDef {
  code: string;
  label?: string;
  legend?: string; // secondary symbol
  width: number;
  kind: KeyKind;
  aria: string;
  icon?: string;
}

export interface KeyDescriptor {
  code: string;
  key: string;          // logical key value: 'a', 'A', 'Enter', 'Backspace', 'ArrowLeft', ...
  kind: KeyKind;
  shift: boolean;
  caps: boolean;
  ctrl: boolean;
  alt: boolean;
  highlightCode?: string;
  repeat?: boolean;
}

const K = (code: string, label: string, width: number, kind: KeyKind, legend?: string, aria?: string, icon?: string): KeyDef => ({
  code, label, width, kind, legend, aria: aria || label, icon,
});

export const KEY_ROWS: KeyDef[][] = [
  [
    K('Escape', 'Esc', 1.25, 'action', undefined, 'Escape / Back'),
    K('Digit1', '1', 1, 'char', '!'),
    K('Digit2', '2', 1, 'char', '@'),
    K('Digit3', '3', 1, 'char', '#'),
    K('Digit4', '4', 1, 'char', '$'),
    K('Digit5', '5', 1, 'char', '%'),
    K('Digit6', '6', 1, 'char', '^'),
    K('Digit7', '7', 1, 'char', '&'),
    K('Digit8', '8', 1, 'char', '*'),
    K('Digit9', '9', 1, 'char', '('),
    K('Digit0', '0', 1, 'char', ')'),
    K('Minus', '-', 1, 'char', '_'),
    K('Equal', '=', 1, 'char', '+'),
    K('Backspace', '⌫', 2, 'action', undefined, 'Backspace'),
  ],
  [
    K('Tab', 'Tab', 1.6, 'action'),
    K('KeyQ', 'Q', 1, 'char'),
    K('KeyW', 'W', 1, 'char'),
    K('KeyE', 'E', 1, 'char'),
    K('KeyR', 'R', 1, 'char'),
    K('KeyT', 'T', 1, 'char'),
    K('KeyY', 'Y', 1, 'char'),
    K('KeyU', 'U', 1, 'char'),
    K('KeyI', 'I', 1, 'char'),
    K('KeyO', 'O', 1, 'char'),
    K('KeyP', 'P', 1, 'char'),
    K('BracketLeft', '[', 1, 'char', '{'),
    K('BracketRight', ']', 1, 'char', '}'),
    K('Backslash', '\\', 1.4, 'char', '|'),
  ],
  [
    K('CapsLock', 'Caps', 1.9, 'modifier', undefined, 'Caps Lock'),
    K('KeyA', 'A', 1, 'char'),
    K('KeyS', 'S', 1, 'char'),
    K('KeyD', 'D', 1, 'char'),
    K('KeyF', 'F', 1, 'char'),
    K('KeyG', 'G', 1, 'char'),
    K('KeyH', 'H', 1, 'char'),
    K('KeyJ', 'J', 1, 'char'),
    K('KeyK', 'K', 1, 'char'),
    K('KeyL', 'L', 1, 'char'),
    K('Semicolon', ';', 1, 'char', ':'),
    K('Quote', "'", 1, 'char', '"'),
    K('Enter', 'Enter', 2.2, 'action', undefined, 'Enter / OK'),
  ],
  [
    K('ShiftLeft', '⇧ Shift', 2.4, 'modifier', undefined, 'Shift'),
    K('KeyZ', 'Z', 1, 'char'),
    K('KeyX', 'X', 1, 'char'),
    K('KeyC', 'C', 1, 'char'),
    K('KeyV', 'V', 1, 'char'),
    K('KeyB', 'B', 1, 'char'),
    K('KeyN', 'N', 1, 'char'),
    K('KeyM', 'M', 1, 'char'),
    K('Comma', ',', 1, 'char', '<'),
    K('Period', '.', 1, 'char', '>'),
    K('Slash', '/', 1, 'char', '?'),
    K('ShiftRight', '⇧ Shift', 2.4, 'modifier', undefined, 'Shift'),
  ],
  [
    K('ControlLeft', 'Ctrl', 1.5, 'modifier'),
    K('AltLeft', 'Alt', 1.4, 'modifier'),
    K('Space', 'space', 6, 'char', undefined, 'Space'),
    K('AltRight', 'Alt', 1.4, 'modifier'),
    K('ControlRight', 'Ctrl', 1.5, 'modifier'),
    K('ArrowLeft', '←', 1, 'nav', undefined, 'Left arrow'),
    K('ArrowUp', '↑', 1, 'nav', undefined, 'Up arrow'),
    K('ArrowDown', '↓', 1, 'nav', undefined, 'Down arrow'),
    K('ArrowRight', '→', 1, 'nav', undefined, 'Right arrow'),
  ],
];

const SHIFT_DIGITS: Record<string, string> = {
  Digit1: '!', Digit2: '@', Digit3: '#', Digit4: '$', Digit5: '%',
  Digit6: '^', Digit7: '&', Digit8: '*', Digit9: '(', Digit0: ')',
  Minus: '_', Equal: '+', BracketLeft: '{', BracketRight: '}', Backslash: '|',
  Semicolon: ':', Quote: '"', Comma: '<', Period: '>', Slash: '?', Backquote: '~',
};

const PLAIN: Record<string, string> = {
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
};

const NUMPAD_CHARS: Record<string, string> = {
  Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4',
  Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9',
  NumpadMultiply: '*', NumpadAdd: '+', NumpadSubtract: '-', NumpadDecimal: '.', NumpadDivide: '/',
};

/** Map a DOM KeyboardEvent to an OWL key descriptor, or null when not consumed. */
export function describeKey(e: KeyboardEvent, caps: boolean): KeyDescriptor | null {
  const code = e.code;
  const shift = e.shiftKey;
  const ctrl = e.ctrlKey;
  const alt = e.altKey;

  const base = { code, shift, caps, ctrl, alt, repeat: e.repeat } as KeyDescriptor;

  if (/^Key[A-Z]$/.test(code)) {
    const letter = code.slice(3);
    const upper = shift !== caps; // XOR
    return { ...base, key: upper ? letter : letter.toLowerCase(), kind: 'char' };
  }
  if (/^Digit[0-9]$/.test(code)) {
    const digit = code.slice(5);
    return { ...base, key: shift ? SHIFT_DIGITS[code] || digit : digit, kind: 'char', highlightCode: code };
  }
  if (NUMPAD_CHARS[code]) {
    return { ...base, key: NUMPAD_CHARS[code], kind: 'char', highlightCode: null as any };
  }
  if (SHIFT_DIGITS[code]) {
    return { ...base, key: shift ? SHIFT_DIGITS[code] : PLAIN[code], kind: 'char' };
  }
  if (PLAIN[code]) {
    return { ...base, key: shift ? SHIFT_DIGITS[code] : PLAIN[code], kind: 'char' };
  }
  if (code === 'Space') return { ...base, key: ' ', kind: 'char' };
  if (code === 'NumpadSpace') return { ...base, key: ' ', kind: 'char' };
  if (code === 'Enter' || code === 'NumpadEnter') return { ...base, key: 'Enter', kind: 'action' };
  if (code === 'Backspace') return { ...base, key: 'Backspace', kind: 'action' };
  if (code === 'Delete') return { ...base, key: 'Delete', kind: 'action' };
  if (code === 'Tab') return { ...base, key: 'Tab', kind: 'action' };
  if (code === 'Escape') return { ...base, key: 'Escape', kind: 'action' };
  if (code === 'ShiftLeft' || code === 'ShiftRight') return { ...base, key: 'Shift', kind: 'modifier' };
  if (code === 'CapsLock') return { ...base, key: 'CapsLock', kind: 'modifier' };
  if (code === 'ControlLeft' || code === 'ControlRight') return { ...base, key: 'Control', kind: 'modifier' };
  if (code === 'AltLeft' || code === 'AltRight') return { ...base, key: 'Alt', kind: 'modifier' };
  if (code === 'MetaLeft' || code === 'MetaRight') return { ...base, key: 'Meta', kind: 'modifier' };
  if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
    return { ...base, key: code, kind: 'nav' };
  }
  if (code === 'F1') return { ...base, key: 'F1', kind: 'action' };
  if (code === 'F2') return { ...base, key: 'F2', kind: 'action' };
  if (code === 'F3') return { ...base, key: 'F3', kind: 'action' };
  if (code === 'PageUp') return { ...base, key: 'PageUp', kind: 'action' };
  if (code === 'PageDown') return { ...base, key: 'PageDown', kind: 'action' };
  if (code === 'Home') return { ...base, key: 'Home', kind: 'action' };
  if (code === 'End') return { ...base, key: 'End', kind: 'action' };
  return null;
}

export function keyLabel(key: string): string {
  switch (key) {
    case 'Backspace': return '⌫';
    case 'Enter': return 'OK';
    case 'Escape': return 'Esc';
    case 'ArrowUp': return '↑';
    case 'ArrowDown': return '↓';
    case 'ArrowLeft': return '←';
    case 'ArrowRight': return '→';
    case 'Tab': return '⇥';
    case ' ': return '␣';
    default: return key;
  }
}

export const SHORTCUT_LEGEND: [string, string][] = [
  ['Esc', 'Back key'],
  ['Enter', 'Trackpad click / OK'],
  ['Arrows', 'Trackpad movement'],
  ['F1 / Alt', 'Menu key'],
  ['F2', 'Call / Answer'],
  ['F3', 'End / Power'],
  ['PgUp / PgDn', 'Volume up / down'],
  ['Letter (home)', 'Universal search'],
  ['Hold letter', 'Launch hotkey app'],
  ['Hold Menu', 'Switch application'],
];
