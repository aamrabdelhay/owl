/**
 * Virtual focus system.
 * The OS never relies on a real <input>: every on-screen text field registers
 * here, and characters are routed to the active one. This keeps the mobile OS
 * keyboard from ever appearing and makes the physical keyboard the source of
 * truth.
 */

export type FieldKind = 'text' | 'password' | 'number' | 'decimal' | 'phone' | 'multiline';

export interface FieldApi {
  id: string;
  kind: FieldKind;
  getValue: () => string;
  setValue: (value: string) => void;
  setCaret?: (caret: number) => void;
  onSubmit?: () => void;
  onMove?: (dir: 'up' | 'down' | 'left' | 'right') => boolean;
  onEscape?: () => void;
  maxLength?: number;
  nextFieldId?: string;
}

const registry = new Map<string, FieldApi>();

export function registerField(api: FieldApi): () => void {
  registry.set(api.id, api);
  return () => {
    if (registry.get(api.id) === api) registry.delete(api.id);
  };
}

export function getField(id: string | null): FieldApi | undefined {
  return id ? registry.get(id) : undefined;
}

export function hasField(id: string | null): boolean {
  return !!(id && registry.has(id));
}

export const CARET = '\u0001';

/** Insert a character at the caret marker inside a raw stored value. */
export function insertAtCaret(raw: string, caret: number, text: string, maxLength?: number): { value: string; caret: number } {
  const clean = raw.replace(CARET, '');
  if (maxLength && clean.length >= maxLength) return { value: raw, caret };
  const pos = clampCaret(raw, caret);
  return { value: clean.slice(0, pos) + text + clean.slice(pos), caret: pos + text.length };
}

export function clampCaret(raw: string, caret: number): number {
  const len = raw.replace(CARET, '').length;
  return Math.max(0, Math.min(caret, len));
}

export function setCaretInRaw(raw: string, caret: number): string {
  const clean = raw.replace(CARET, '');
  const pos = clampCaret(clean, caret);
  return clean.slice(0, pos) + CARET + clean.slice(pos);
}

export function caretOf(raw: string): number {
  const idx = raw.indexOf(CARET);
  return idx < 0 ? raw.replace(CARET, '').length : idx;
}

export function fieldValue(raw: string): string {
  return raw.replace(CARET, '');
}

export function typeIntoField(field: FieldApi, text: string): void {
  const raw = field.getValue();
  const caret = caretOf(raw);
  const { value, caret: next } = insertAtCaret(raw, caret, text, field.maxLength);
  field.setValue(value);
  field.setCaret?.(next);
}

export function backspaceField(field: FieldApi): void {
  const raw = field.getValue();
  const caret = caretOf(raw);
  if (caret <= 0) return;
  const clean = raw.replace(CARET, '');
  field.setValue(clean.slice(0, caret - 1) + clean.slice(caret));
  field.setCaret?.(caret - 1);
}

export function deleteField(field: FieldApi): void {
  const raw = field.getValue();
  const caret = caretOf(raw);
  const clean = raw.replace(CARET, '');
  if (caret >= clean.length) return;
  field.setValue(clean.slice(0, caret) + clean.slice(caret + 1));
  field.setCaret?.(caret);
}

export function moveCaret(field: FieldApi, delta: number): void {
  const raw = field.getValue();
  const caret = caretOf(raw);
  field.setCaret?.(caret + delta);
}
