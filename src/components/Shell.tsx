import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../os/store';
import { Icon } from './Icon';
import type { SoftMenuAction as AppMenuAction } from '../os/types';

/* ------------------------------- Status bar ------------------------------- */

export function StatusBar() {
  const battery = useStore((s) => s.battery);
  const online = useStore((s) => s.online);
  const settings = useStore((s) => s.settings);
  const nowPlaying = useStore((s) => s.nowPlaying);
  const counters = useStore((s) => s.counters);
  const openApp = useStore((s) => s.openApp);
  const now = useNowLike();
  const pct = Math.round(battery.level * 100);

  return (
    <div className="statusbar" role="status" aria-label="Status bar">
      <span className="carrier">OWL</span>
      <Icon name="signal" size={11} />
      <span className="sbItem" title={online ? 'Online' : 'Offline'}>
        <Icon name={online ? 'wifi' : 'wifiOff'} size={10} />
      </span>
      <span className="sbItem" aria-label={online ? '3G' : 'No network'} style={{ fontSize: 8, opacity: 0.85 }}>
        {online ? '3G' : '—'}
      </span>
      {settings.bluetooth && (
        <span className="sbItem" title="Bluetooth on"><Icon name="bluetooth" size={10} /></span>
      )}
      <span className="sbItem" title={`${settings.profile} profile`}>
        <Icon name={settings.profile === 'silent' || settings.profile === 'vibrate' ? 'headphones' : 'volume'} size={10} />
      </span>
      {nowPlaying?.playing && (
        <button className="sbBtn" onClick={() => openApp('music')} aria-label="Now playing" title={nowPlaying.title}>
          <Icon name="music" size={10} />
          <span className="mono" style={{ maxWidth: 62, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nowPlaying.title}
          </span>
        </button>
      )}
      <span className="grow" />
      {counters.messages > 0 && (
        <button className="sbBtn" onClick={() => openApp('messages')} aria-label={`${counters.messages} unread messages`}>
          <Icon name="message" size={10} />
          {counters.messages}
        </button>
      )}
      {counters.missedCalls > 0 && (
        <button className="sbBtn" onClick={() => openApp('phone', { tab: 'log' })} aria-label={`${counters.missedCalls} missed calls`}>
          <Icon name="phone" size={10} />
          {counters.missedCalls}
        </button>
      )}
      <span className="mono" style={{ fontSize: 9 }}>
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24 })}
      </span>
      <span className="batt" title={`Battery ${pct}%${battery.charging ? ' (charging)' : ''}`}>
        <i style={{ width: `${Math.max(6, pct)}%`, background: pct < 20 ? 'var(--red)' : 'var(--green)' }} />
      </span>
      <span style={{ fontSize: 8.5, opacity: 0.85, minWidth: 20 }}>{pct}%</span>
    </div>
  );
}

function useNowLike() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/* ------------------------------- App frame ------------------------------- */

export function AppFrame({
  title,
  actions,
  children,
  noHeader,
  icon,
  menu,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  noHeader?: boolean;
  icon?: string;
  /** Rows for the hardware Menu key. Recomputed whenever the app re-renders. */
  menu?: AppMenuAction[];
}) {
  const setAppMenu = useStore((s) => s.setAppMenu);
  const menuKey = menu ? menu.map((a) => `${a.id}:${a.label}:${a.danger ? 'd' : ''}`).join('|') : '';
  // keep the latest closure without re-registering on every render
  const menuRef = useRef(menu);
  menuRef.current = menu;
  useEffect(() => {
    if (!menu) return;
    setAppMenu({
      title,
      actions: (menuRef.current || []).map((a) => ({
        ...a,
        run: () => menuRef.current?.find((m) => m.id === a.id)?.run(),
      })),
    });
    return () => setAppMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuKey, title, setAppMenu]);

  return (
    <div className="appFrame">
      {!noHeader && (
        <div className="appHeader">
          {icon && <Icon name={icon} size={12} />}
          <span className="title">{title}</span>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/* --------------------------------- Dialog -------------------------------- */

export function DialogLayer() {
  const dialog = useStore((s) => s.dialog);
  const closeDialog = useStore((s) => s.closeDialog);
  const [value, setValue] = useState('');
  const activeFieldId = useStore((s) => s.activeFieldId);

  useEffect(() => {
    if (dialog) setValue(dialog.input?.value || '');
  }, [dialog?.id]);

  if (!dialog) return null;
  const isFieldActive = activeFieldId === 'dialog-input';
  return (
    <div className="dialogLayer" role="dialog" aria-modal="true" aria-label={dialog.title}>
      <div className="dialog">
        <h3>{dialog.title}</h3>
        <div className="dBody">
          {dialog.body && <div dangerouslySetInnerHTML={{ __html: dialog.body }} />}
          {dialog.input && (
            <div style={{ marginTop: 6 }}>
              <div className="fieldLabel">{dialog.input.label}</div>
              <DialogInput
                value={value}
                onChange={setValue}
                placeholder={dialog.input.placeholder}
                password={dialog.input.password}
                active={isFieldActive}
                multiline={dialog.input.multiline}
                onSubmit={() => { dialog.onConfirm(value); closeDialog(); }}
              />
            </div>
          )}
        </div>
        <div className="dActions">
          {dialog.showCancel && (
            <button className="btn" onClick={() => { dialog.onCancel?.(); closeDialog(); }}>
              {dialog.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            className={`btn ${dialog.danger ? 'danger' : 'primary'}`}
            autoFocus
            onClick={() => {
              dialog.onConfirm(value);
              closeDialog();
            }}
          >
            {dialog.confirmLabel || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogInput({
  value, onChange, placeholder, password, active, multiline, onSubmit,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  password?: boolean; active: boolean; multiline?: boolean; onSubmit?: () => void;
}) {
  const focusField = useStore((s) => s.focusField);
  const [caret, setCaret] = useState(value.length);
  const reg = useRef(false);

  useEffect(() => {
    setCaret((v) => Math.min(v, value.length));
  }, [value]);

  useEffect(() => {
    // register this dialog field lazily with the focus kernel
    let off: (() => void) | undefined;
    void import('../os/focus').then(({ registerField }) => {
      off = registerField({
        id: 'dialog-input',
        kind: password ? 'password' : 'text',
        getValue: () => {
          if (!useStore.getState().activeFieldId || useStore.getState().activeFieldId !== 'dialog-input') return value;
          return value.slice(0, caret) + '\u0001' + value.slice(caret);
        },
        setValue: (raw) => {
          const i = raw.indexOf('\u0001');
          if (i >= 0) {
            setCaret(i);
            onChange(raw.replace('\u0001', ''));
          } else {
            onChange(raw);
            setCaret(raw.length);
          }
        },
        setCaret: (c) => setCaret(Math.max(0, Math.min(c, value.length))),
        onSubmit,
      });
      reg.current = true;
    });
    return () => off?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, caret, password]);

  return (
    <div
      className="field"
      onClick={(e) => { e.stopPropagation(); focusField('dialog-input'); }}
      role="textbox"
      aria-label={placeholder || 'input'}
    >
      {active ? (
        <span>
          {password ? '•'.repeat(caret) : value.slice(0, caret)}
          <span className="caret" />
          {password ? '•'.repeat(Math.max(0, value.length - caret)) : value.slice(caret)}
        </span>
      ) : (
        <span style={{ opacity: value ? 1 : 0.55 }}>
          {value ? (password ? '•'.repeat(value.length) : value) : placeholder}
        </span>
      )}
      {multiline && <span className="tiny">↵ for new line</span>}
    </div>
  );
}

/* --------------------------------- Toasts -------------------------------- */

export function ToastStack() {
  const toasts = useStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toastStack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">{t.text}</div>
      ))}
    </div>
  );
}

/* -------------------------------- Soft menu ------------------------------- */

export function SoftMenuLayer() {
  const softMenu = useStore((s) => s.softMenu);
  const setSoftMenu = useStore((s) => s.setSoftMenu);
  if (!softMenu) return null;
  return (
    <div className="softMenuLayer" onClick={() => setSoftMenu(null)} role="menu" aria-label={softMenu.title}>
      <div className="softMenu" onClick={(e) => e.stopPropagation()}>
        <div className="smTitle">{softMenu.title}</div>
        {softMenu.actions.map((a) => (
          <button
            key={a.id}
            className={a.danger ? 'danger' : ''}
            role="menuitem"
            onClick={() => {
              setSoftMenu(null);
              a.run();
            }}
          >
            {a.icon && <Icon name={a.icon} size={12} />}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export { useNowLike };
