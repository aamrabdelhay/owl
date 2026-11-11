import React, { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../os/store';
import { registerField, caretOf, fieldValue, type FieldKind } from '../os/focus';

interface FieldProps {
  value: string;
  onChange: (v: string) => void;
  kind?: FieldKind;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  onSubmit?: () => void;
  onMove?: (dir: 'up' | 'down' | 'left' | 'right') => boolean;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
}

/**
 * A controlled text field that never takes real DOM focus. Characters are
 * routed from the OS keyboard (real or on-screen) using the virtual focus
 * registry, so no mobile keyboard ever pops up.
 */
export function Field({
  value, onChange, kind = 'text', placeholder, multiline, maxLength, onSubmit, onMove,
  className = '', ariaLabel, autoFocus, style,
}: FieldProps) {
  const id = useId();
  const activeFieldId = useStore((s) => s.activeFieldId);
  const focusField = useStore((s) => s.focusField);
  const setShift = useStore((s) => s.setShift);
  const shift = useStore((s) => s.shift);
  const caps = useStore((s) => s.caps);
  const [caret, setCaret] = useState(0);
  const active = activeFieldId === id;
  const caretRef = useRef(caret);
  caretRef.current = caret;

  const kindToInput: Record<FieldKind, string> = {
    text: 'text', password: 'password', number: 'numeric', decimal: 'decimal',
    phone: 'tel', multiline: 'text',
  };

  useEffect(() => {
    const off = registerField({
      id,
      kind,
      getValue: () => {
        const raw = value || '';
        if (!active) return raw;
        return raw.slice(0, caretRef.current) + '\u0001' + raw.slice(caretRef.current);
      },
      setValue: (next) => {
        const idx = next.indexOf('\u0001');
        if (idx >= 0) {
          setCaret(idx);
          onChange(next.replace('\u0001', ''));
        } else {
          setCaret(next.length);
          onChange(next);
        }
      },
      setCaret: (c) => setCaret(Math.max(0, Math.min(c, (value || '').length))),
      onSubmit,
      onMove,
      maxLength,
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, active, value, caret, maxLength]);

  useEffect(() => {
    if (autoFocus) {
      focusField(id);
      setCaret((value || '').length);
    }
    return () => {
      const s = useStore.getState();
      if (s.activeFieldId === id) s.focusField(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active) setCaret((value || '').length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const activate = (e: React.MouseEvent) => {
    e.stopPropagation();
    focusField(id);
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
  };

  if (multiline) {
    return (
      <textarea
        readOnly
        inputMode="none"
        className={`field ${active ? 'active' : ''} ${className}`}
        aria-label={ariaLabel || placeholder || 'text field'}
        value={value}
        placeholder={placeholder}
        onClick={activate}
        onFocus={(e) => { e.currentTarget.blur(); focusField(id); }}
        style={style}
        rows={3}
      />
    );
  }

  return (
    <div
      className={`field ${className}`}
      role="textbox"
      aria-label={ariaLabel || placeholder || 'text field'}
      aria-multiline={false}
      tabIndex={-1}
      onClick={activate}
      onFocus={() => focusField(id)}
      style={style}
      inputMode="none"
    >
      {active ? (
        <>
          <span className="fieldText">
            {kind === 'password' ? '•'.repeat(caret) : value.slice(0, caret)}
            <span className="caret" />
            {kind === 'password' ? '•'.repeat(Math.max(0, value.length - caret)) : value.slice(caret)}
          </span>
          {!value && <span className="placeholderText" style={{ opacity: 0.5 }}>{placeholder}</span>}
        </>
      ) : (
        <>
          {kind === 'password' && value
            ? <span>{'•'.repeat(value.length)}</span>
            : <span style={{ opacity: value ? 1 : 0.55 }}>{value || placeholder}</span>}
        </>
      )}
      <input
        type="text"
        value=""
        readOnly
        inputMode="none"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={() => {}}
        onFocus={(e) => { e.currentTarget.blur(); focusField(id); }}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, border: 0, padding: 0, pointerEvents: 'none' }}
      />
      <span
        aria-hidden="true"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        data-shift={shift ? 1 : 0}
        data-caps={caps ? 1 : 0}
      />
    </div>
  );
}

/** Non-focusable read-only display that still keeps caret helpers consistent. */
export function fieldText(raw: string) {
  return fieldValue(raw);
}

export { caretOf };
export default Field;
