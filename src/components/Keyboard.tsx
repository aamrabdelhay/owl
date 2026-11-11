import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../os/store';
import { KEY_ROWS, type KeyDef } from '../os/keys';
import { keyClick, vibrate } from '../os/audio';

interface KbProps {
  /** called for every logical key press; return true when consumed */
  onKey: (desc: { key: string; code: string; shift: boolean; caps: boolean; ctrl: boolean; alt: boolean }) => boolean;
}

/**
 * The physical keyboard of the phone. Presses come from either the real
 * keyboard (visual sync only — routing happens in the kernel) or from touch,
 * where each key is dispatched through the same handler.
 */
export function Keyboard({ onKey }: KbProps) {
  const pressed = useStore((s) => s.pressedCodes);
  const shift = useStore((s) => s.shift);
  const caps = useStore((s) => s.caps);
  const settings = useStore((s) => s.settings);
  const [bubble, setBubble] = useState<{ label: string; x: number; y: number } | null>(null);
  const touchLetter = useRef<string | null>(null);

  const activeShiftVisual = shift;

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, def: KeyDef, kind: 'down' | 'up') => {
      if (kind === 'down') {
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
        if (def.kind === 'char' || def.kind === 'nav' || def.kind === 'action') {
          const rect = e.currentTarget.getBoundingClientRect();
          const label = def.kind === 'char'
            ? legendFor(def, useStore.getState().shift, useStore.getState().caps)
            : def.label || '';
          setBubble({ label, x: rect.left + rect.width / 2, y: rect.top });
        }
        if (settings.keyClick) keyClick(settings.keyClickVolume);
        if (settings.vibrateKeys) vibrate(8);
        // dispatch logical key
        const s = useStore.getState();
        let keyValue = '';
        if (def.kind === 'char') {
          keyValue = legendFor(def, s.shift, s.caps);
          if (s.shift) s.setShift(false);
        } else if (def.kind === 'nav') {
          keyValue = def.code;
        } else {
          keyValue = def.code === 'Space' ? ' ' : def.code;
        }
        onKey({
          key: keyValue,
          code: def.code,
          shift: def.kind === 'char' ? s.shift : false,
          caps: s.caps,
          ctrl: s.ctrl,
          alt: s.alt,
        });
        useStore.getState().setKeyPressed(def.code, true);
        window.setTimeout(() => useStore.getState().setKeyPressed(def.code, false), 110);
      } else {
        setBubble(null);
      }
    },
    [onKey, settings.keyClick, settings.keyClickVolume, settings.vibrateKeys]
  );

  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), 900);
    return () => window.clearTimeout(t);
  }, [bubble]);

  return (
    <div className="kb" role="group" aria-label="QWERTY keyboard">
      {KEY_ROWS.map((row, ri) => (
        <div className="kbRow" key={ri}>
          {row.map((def) => {
            const isModActive =
              (def.code.startsWith('Shift') && activeShiftVisual) ||
              (def.code === 'CapsLock' && caps) ||
              (def.code === 'ControlLeft' && useStore.getState().ctrl) ||
              (def.code === 'AltLeft' && useStore.getState().alt);
            const down = pressed.includes(def.code) || (isModActive && def.kind === 'modifier');
            const tiny = def.label && def.label.length > 3;
            return (
              <button
                key={def.code}
                type="button"
                className={`key ${def.kind === 'modifier' || def.kind === 'action' ? 'mod' : ''} ${tiny ? 'small' : ''} ${def.code === 'Space' ? 'space' : ''} ${down ? 'lit down' : ''} ${isModActive ? 'on' : ''}`}
                style={{ flexGrow: def.width, flexBasis: `${def.width * 10}px` }}
                aria-label={def.aria}
                aria-pressed={down}
                tabIndex={-1}
                onPointerDown={(e) => handlePointer(e, def, 'down')}
                onPointerUp={(e) => handlePointer(e, def, 'up')}
                onPointerCancel={(e) => handlePointer(e, def, 'up')}
                onPointerLeave={(e) => { if (e.buttons === 0) handlePointer(e, def, 'up'); }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span className="legend">
                  {def.kind === 'char' && def.label ? (
                    <>
                      <b>{displayLegend(def, shift, caps)}</b>
                      {def.legend && <s>{shift ? def.label : def.legend}</s>}
                    </>
                  ) : (
                    <b className="arr">{def.label}</b>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="leds">
        <span className={`led ${caps ? 'on' : ''}`}><i />CAPS</span>
        <span className={`led ${shift ? 'on' : ''}`}><i />SHIFT</span>
        <span className="led"><i />PWR</span>
      </div>
      {bubble && (
        <div className="keyPreview" style={{ left: bubble.x, top: bubble.y }}>
          {bubble.label}
        </div>
      )}
    </div>
  );
}

function displayLegend(def: KeyDef, shift: boolean, caps: boolean): string {
  if (def.label && def.label.length === 1 && /[a-z]/i.test(def.label)) {
    const letter = def.label.toUpperCase();
    return shift !== caps ? letter : letter.toLowerCase();
  }
  if (shift && def.legend) {
    // show the shifted symbol in the main slot for digits/symbols
    if (def.code.startsWith('Digit')) return def.legend;
    return def.legend;
  }
  return def.label || '';
}

function legendFor(def: KeyDef, shift: boolean, caps: boolean): string {
  if (def.kind !== 'char') return def.code;
  if (def.code === 'Space') return ' ';
  if (def.label && def.label.length === 1 && /[a-z]/i.test(def.label)) {
    return shift !== caps ? def.label.toUpperCase() : def.label.toLowerCase();
  }
  if (shift && def.legend) return def.legend;
  return def.label || '';
}

export default Keyboard;
