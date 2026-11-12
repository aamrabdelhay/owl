import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../os/store';
import type { KeyEventLike } from '../os/kernelTypes';
import { keyClick, vibrate } from '../os/audio';

const GROUPS: Record<string, string> = {
  '1': '.,?!1',
  '2': 'abc2',
  '3': 'def3',
  '4': 'ghi4',
  '5': 'jkl5',
  '6': 'mno6',
  '7': 'pqrs7',
  '8': 'tuv8',
  '9': 'wxyz9',
};
const AR_GROUPS: Record<string, string> = {
  '1': '.,؟!١', '2': 'ابتث', '3': 'جحخد', '4': 'ذرزس', '5': 'شصضط',
  '6': 'ظعغف', '7': 'قكلم', '8': 'نهوي', '9': 'ةىءئ',
};
const EMPTY = { shift: false, caps: false, ctrl: false, alt: false };

/** Classic multi-tap twelve-key mobile keypad. */
export function SimpleKeyboard({ onKey }: { onKey: (event: KeyEventLike) => boolean }) {
  const settings = useStore((s) => s.settings);
  const [pending, setPending] = useState<{ digit: string; index: number } | null>(null);
  const [upperCase, setUpperCase] = useState(false);
  const lastAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const dispatch = (key: string, code: string) => onKey({ key, code, dispatch: 'physical', ...EMPTY });

  const tap = (digit: string) => {
    if (settings.keyClick) keyClick(settings.keyClickVolume);
    if (settings.vibrateKeys) vibrate(7);

    // In the dialler, a keypad tap means a literal DTMF digit, never a letter.
    if (useStore.getState().appId === 'phone') {
      setPending(null);
      lastAt.current = 0;
      dispatch(digit, `Digit${digit}`);
      return;
    }

    if (digit === '0') {
      setPending(null);
      lastAt.current = 0;
      dispatch(' ', 'Space');
      return;
    }
    if (digit === '*') {
      setPending(null);
      lastAt.current = 0;
      dispatch('*', 'NumpadMultiply');
      return;
    }
    // The classic # key cycles lowercase / uppercase input modes.
    if (digit === '#') {
      setPending(null);
      lastAt.current = 0;
      setUpperCase((value) => !value);
      return;
    }

    const groups = settings.keyboardLanguage === 'ar' ? AR_GROUPS : GROUPS;
    const chars = groups[digit];
    if (!chars) return;
    const now = Date.now();
    const sameKey = pending?.digit === digit && now - lastAt.current < 950;
    const index = sameKey ? (pending.index + 1) % chars.length : 0;
    if (sameKey) dispatch('Backspace', 'Backspace');
    const letter = settings.keyboardLanguage === 'ar' ? chars[index] : upperCase ? chars[index].toUpperCase() : chars[index];
    dispatch(letter, settings.keyboardLanguage === 'ar' ? `Digit${digit}` : `Key${letter.toUpperCase()}`);
    setPending({ digit, index });
    lastAt.current = now;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPending(null);
      lastAt.current = 0;
    }, 1000);
  };

  const activeGroups = settings.keyboardLanguage === 'ar' ? AR_GROUPS : GROUPS;
  const keys = [
    { n: '1', letters: activeGroups['1'] }, { n: '2', letters: activeGroups['2'] }, { n: '3', letters: activeGroups['3'] },
    { n: '4', letters: activeGroups['4'] }, { n: '5', letters: activeGroups['5'] }, { n: '6', letters: activeGroups['6'] },
    { n: '7', letters: activeGroups['7'] }, { n: '8', letters: activeGroups['8'] }, { n: '9', letters: activeGroups['9'] },
    { n: '*', letters: '✳' }, { n: '0', letters: '+' }, { n: '#', letters: settings.keyboardLanguage === 'ar' ? 'عربي' : upperCase ? 'ABC' : 'abc' },
  ];

  return (
    <div className="simpleKb" role="group" aria-label="Classic mobile phone keypad">
      {keys.map((key) => (
        <button
          type="button"
          className={`simpleKey ${pending?.digit === key.n ? 'active' : ''}`}
          key={key.n}
          onClick={() => tap(key.n)}
          aria-label={`Key ${key.n} ${key.letters}`}
        >
          <b>{key.n}</b>
          <span>{key.letters}</span>
        </button>
      ))}
      <div className="simpleKbSoftkeys">
        <button type="button" onClick={() => { setPending(null); lastAt.current = 0; dispatch('Backspace', 'Backspace'); }}>DELETE</button>
        <span>{pending ? `${pending.digit} · ${pending.index + 1}` : 'MULTI-TAP'}</span>
        <button type="button" onClick={() => { setUpperCase((value) => !value); setPending(null); lastAt.current = 0; }}>{settings.keyboardLanguage === 'ar' ? 'عربي' : 'ABC / abc'}</button>
      </div>
    </div>
  );
}

export default SimpleKeyboard;
