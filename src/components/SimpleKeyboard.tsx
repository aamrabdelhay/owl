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
  '*': '*+-/=',
};
const EMPTY = { shift: false, caps: false, ctrl: false, alt: false };

/** Nokia-style multi-tap 12-key keypad with long-press digit entry. */
export function SimpleKeyboard({ onKey }: { onKey: (event: KeyEventLike) => boolean }) {
  const settings = useStore((s) => s.settings);
  const [pending, setPending] = useState<{ digit: string; index: number } | null>(null);
  const [upperCase, setUpperCase] = useState(false);
  const lastAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const longPressTimer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(longPressTimer.current); }, []);

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
      const symbols = GROUPS['*'];
      const now = Date.now();
      const same = pending?.digit === '*' && now - lastAt.current < 950;
      const index = same ? (pending.index + 1) % symbols.length : 0;
      if (same) dispatch('Backspace', 'Backspace');
      dispatch(symbols[index], 'NumpadMultiply');
      setPending({ digit: '*', index });
      lastAt.current = now;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { setPending(null); lastAt.current = 0; }, 1000);
      return;
    }
    // The classic # key cycles lowercase / uppercase input modes.
    if (digit === '#') {
      setPending(null);
      lastAt.current = 0;
      setUpperCase((value) => !value);
      return;
    }

    const chars = GROUPS[digit];
    if (!chars) return;
    const now = Date.now();
    const sameKey = pending?.digit === digit && now - lastAt.current < 950;
    const index = sameKey ? (pending.index + 1) % chars.length : 0;
    if (sameKey) dispatch('Backspace', 'Backspace');
    const letter = upperCase ? chars[index].toUpperCase() : chars[index];
    dispatch(letter, `Key${letter.toUpperCase()}`);
    setPending({ digit, index });
    lastAt.current = now;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPending(null);
      lastAt.current = 0;
    }, 1000);
  };

  const keys = [
    { n: '1', letters: '.,?!' }, { n: '2', letters: 'ABC' }, { n: '3', letters: 'DEF' },
    { n: '4', letters: 'GHI' }, { n: '5', letters: 'JKL' }, { n: '6', letters: 'MNO' },
    { n: '7', letters: 'PQRS' }, { n: '8', letters: 'TUV' }, { n: '9', letters: 'WXYZ' },
    { n: '*', letters: '* + -' }, { n: '0', letters: 'SPACE' }, { n: '#', letters: upperCase ? 'ABC' : 'abc' },
  ];

  return (
    <div className="simpleKb" role="group" aria-label="Classic mobile phone keypad">
      {keys.map((key) => (
        <button
          type="button"
          className={`simpleKey ${pending?.digit === key.n ? 'active' : ''}`}
          key={key.n}
          onPointerDown={() => {
            longPressed.current = false;
            window.clearTimeout(longPressTimer.current);
            if (key.n !== '#') {
              longPressTimer.current = window.setTimeout(() => {
                longPressed.current = true;
                setPending(null);
                lastAt.current = 0;
                dispatch(key.n, key.n === '*' ? 'NumpadMultiply' : `Digit${key.n}`);
                if (settings.keyClick) keyClick(settings.keyClickVolume);
                if (settings.vibrateKeys) vibrate(10);
              }, 520);
            }
          }}
          onPointerUp={() => window.clearTimeout(longPressTimer.current)}
          onPointerLeave={() => window.clearTimeout(longPressTimer.current)}
          onClick={() => {
            if (longPressed.current) { longPressed.current = false; return; }
            tap(key.n);
          }}
          aria-label={`Key ${key.n} ${key.letters}; hold for number`}
        >
          <b>{key.n}</b>
          <span>{key.letters}</span>
        </button>
      ))}

    </div>
  );
}

export default SimpleKeyboard;
