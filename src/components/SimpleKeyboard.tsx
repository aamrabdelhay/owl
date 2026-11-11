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
      <div className="simpleActions">
        <button type="button" onClick={() => tap('0')} aria-label="Zero">0</button>
        <button type="button" onClick={() => { setPending(null); lastAt.current = 0; dispatch(' ', 'Space'); }}>SPACE</button>
        <button type="button" onClick={() => { setPending(null); lastAt.current = 0; dispatch('Backspace', 'Backspace'); }}>⌫</button>
        <button type="button" onClick={() => { setUpperCase((value) => !value); setPending(null); lastAt.current = 0; }}> {upperCase ? 'ABC' : 'abc'} </button>
      </div>
    </div>
  );
}

export default SimpleKeyboard;
