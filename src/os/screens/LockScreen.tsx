import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { wallpaperName } from '../../assets/wallpapers';
import { useWallpaperUrl } from '../../hooks/useWallpaper';
import { OwlLogo } from '../../components/OwlLogo';
import { formatDate, formatTime } from '../i18n';
import { errorBuzz, successChime } from '../audio';

export function LockScreen() {
  const settings = useStore((s) => s.settings);
  const unlock = useStore((s) => s.unlock);
  const failedAttempts = useStore((s) => s.failedAttempts);
  const cooldownUntil = useStore((s) => s.cooldownUntil);
  // The password lives in ONE place: the virtual field registered by
  // `useLockField` (mounted from App). The lock screen only displays it.
  const [now, setNow] = useState(() => new Date());
  const [cooldown, setCooldown] = useState(0);
  const pass = useLockFieldValue();
  const hasPassword = !!settings.passwordHash;
  const wpId = settings.useSeparateLockWallpaper ? settings.lockWallpaperId : settings.wallpaperId;
  const wp = useWallpaperUrl(wpId);
  const lang = settings.language;

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const t = window.setInterval(() => {
      setCooldown(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(t);
  }, [cooldownUntil]);

  // Menu opens the password prompt; as soon as the field is visible we type in it.
  useEffect(() => {
    if (!hasPassword) return;
    useStore.getState().focusField('lock-pass');
  }, [hasPassword]);

  const tryUnlock = async () => {
    if (Date.now() < cooldownUntil) return;
    await unlock(pass);
  };

  return (
    <div className="lockScreen" aria-label="Locked">
      <div className="bg" style={{ backgroundImage: wp || undefined, backgroundColor: wp ? undefined : '#08111f' }} />
      <div className="lockContent">
        <div className="lt">{formatTime(lang, now, settings.clock24)}</div>
        <div className="ld">{formatDate(lang, now, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div className="lbadge"><OwlLogo size={12} /> OWL</div>
      </div>

      <div className="lockHint">
        {hasPassword ? (
          <div className="lockPassWrap">
            <div style={{ fontSize: 9, letterSpacing: '0.1em', opacity: 0.9 }}>
              {cooldown > 0
                ? `Too many attempts. Wait ${cooldown}s.`
                : 'Enter password'}
            </div>
            <div
              className="field"
              style={{ borderColor: failedAttempts ? 'var(--red)' : undefined }}
              role="textbox"
              aria-label="Password"
              onClick={() => useStore.getState().focusField('lock-pass')}
            >
              {pass ? '•'.repeat(pass.length) : <span style={{ opacity: 0.5 }}>{settings.passwordIsPin ? 'PIN' : 'password'}</span>}
              <span className="caret" />
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button className="btn primary" onClick={() => void tryUnlock()} style={{ fontSize: 10 }}>
                Unlock
              </button>
            </div>
            <div style={{ fontSize: 8, opacity: 0.65, maxWidth: 190 }}>
              Forgot it? Settings → Reset OS wipes local data.
            </div>
          </div>
        ) : (
          <>
            Press <kbd>Menu</kbd> then <kbd>Enter</kbd> to unlock
          </>
        )}
      </div>
    </div>
  );
}

export default LockScreen;

/* ---------------------------------------------------------------- lock field
 * The password field is registered once (from App) and its value is published
 * through a tiny external store, so the lock screen renders exactly what the
 * keyboard has typed without keeping a second copy of the password.
 */
let lockValue = '';
const lockListeners = new Set<(value: string) => void>();
function publishLockValue(next: string) {
  lockValue = next;
  lockListeners.forEach((l) => l(next));
}

export function useLockFieldValue(): string {
  const [value, setValue] = useState(lockValue);
  useEffect(() => {
    lockListeners.add(setValue);
    setValue(lockValue);
    return () => { lockListeners.delete(setValue); };
  }, []);
  return value;
}

/* Register the lock password as a virtual field so the physical keyboard types into it. */
export function useLockField() {
  const hasPassword = useStore((s) => !!s.settings.passwordHash);
  const passwordIsPin = useStore((s) => s.settings.passwordIsPin);
  // Refs, not state: the field is read synchronously by the kernel on every
  // keystroke, and a stale closure would drop the first characters typed.
  const valueRef = useRef('');
  const caretRef = useRef(0);

  useEffect(() => { publishLockValue(''); }, [hasPassword]);

  useEffect(() => {
    if (!hasPassword) return;
    let off: (() => void) | undefined;
    void import('../focus').then(({ registerField }) => {
      off = registerField({
        id: 'lock-pass',
        kind: passwordIsPin ? 'number' : 'password',
        getValue: () => {
          const value = valueRef.current;
          const caret = caretRef.current;
          const active = useStore.getState().activeFieldId === 'lock-pass';
          return active ? value.slice(0, caret) + '\u0001' + value.slice(caret) : value;
        },
        setValue: (raw) => {
          const i = raw.indexOf('\u0001');
          const clean = raw.replace('\u0001', '');
          valueRef.current = clean;
          caretRef.current = i >= 0 ? i : clean.length;
          publishLockValue(clean);
        },
        setCaret: (c) => {
          caretRef.current = Math.max(0, Math.min(c, valueRef.current.length));
        },
        maxLength: 12,
        onSubmit: () => {
          const attempt = valueRef.current;
          valueRef.current = '';
          caretRef.current = 0;
          publishLockValue('');
          void useStore.getState().unlock(attempt).then((ok) => {
            if (ok) successChime(0.6);
            else errorBuzz(0.6);
          });
        },
      });
    });
    return () => off?.();
  }, [hasPassword, passwordIsPin]);

  return { getValue: () => valueRef.current };
}
