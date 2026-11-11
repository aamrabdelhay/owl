import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore, profileVolume } from './os/store';
import { StatusBar, DialogLayer, ToastStack, SoftMenuLayer } from './components/Shell';
import { PhoneShell } from './components/PhoneShell';
import { HomeScreen } from './os/screens/HomeScreen';
import { Drawer } from './os/screens/Drawer';
import { BootScreen, PoweredOff, ShutdownScreen, useBootSequence } from './os/screens/BootScreen';
import { LockScreen, useLockField } from './os/screens/LockScreen';
import { AppWindow } from './os/AppWindow';
import { PowerMenu } from './os/screens/PowerMenu';
import { RecentApps } from './os/screens/RecentApps';
import { dispatchKey, onKeyUp } from './os/kernel';
import { describeKey } from './os/keys';
import { keyClick, messageTone, unlockAudio, vibrate } from './os/audio';
import { Icon } from './components/Icon';
import { useEffects } from './os/effects';
import type { KeyEventLike } from './os/kernelTypes';

const SCREEN_W = 480;
const SCREEN_H = 360;

export default function App() {
  const settings = useStore((s) => s.settings);
  const screen = useStore((s) => s.screen);
  const appId = useStore((s) => s.appId);
  const searchOpen = useStore((s) => s.searchOpen);
  const drawerOpen = useStore((s) => s.drawerOpen);
  const locked = useStore((s) => s.locked);
  const themePreview = useStore((s) => s.themePreview);
  const wallpaperVersion = useStore((s) => s.wallpaperVersion);
  const clipRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [screenWidth, setScreenWidth] = useState(SCREEN_W);
  const [shutdown, setShutdown] = useState(false);
  const lastAlive = useRef(Date.now());

  useBootSequence();
  useEffects();
  useLockField();

  /* theme + accessibility applied to document root */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themePreview || settings.theme;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.style.setProperty('--ui-font-scale', String(settings.fontScale));
    root.lang = settings.language;
    document.title = 'OWL — Retro QWERTY Phone Simulator';
  }, [settings.theme, themePreview, settings.highContrast, settings.fontScale, settings.language]);

  /* responsive screen scaling: measure before the first visible paint */
  useLayoutEffect(() => {
    const measure = () => {
      const el = clipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Keep the 360px logical height, but expand the logical width to the
      // entire upper half of the viewport so the phone display uses 100% width.
      const s = rect.height / SCREEN_H;
      setScale(s);
      setScreenWidth(rect.width / s);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (clipRef.current) ro?.observe(clipRef.current);
    const viewport = window.visualViewport;
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    viewport?.addEventListener('resize', measure);
    const t = window.setTimeout(measure, 60);
    return () => {
      ro?.disconnect();
      viewport?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.clearTimeout(t);
    };
  }, []);

  /* shutdown animation */
  const powerOff = useStore((s) => s.powerOff);
  const powerMenuOpen = useStore((s) => s.powerMenuOpen);
  const setPowerMenuOpen = useStore((s) => s.setPowerMenuOpen);
  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      if (prev.powered && !state.powered) {
        setShutdown(true);
        window.setTimeout(() => setShutdown(false), 900);
      }
    });
    return unsub;
  }, []);

  const handleKey = useCallback((e: KeyEventLike): boolean => {
    unlockAudio();
    return dispatchKey(e);
  }, []);

  /* global physical keyboard */
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      const state = useStore.getState();
      if (!state.powered) {
        if (ev.code === 'F3' || ev.code === 'Space' || ev.code === 'Enter') {
          ev.preventDefault();
          state.powerOn();
        }
        return;
      }
      if (ev.ctrlKey && ['KeyR', 'F5', 'F12'].includes(ev.code)) return;
      if (ev.metaKey) return;
      if (ev.ctrlKey && ['KeyC', 'KeyV', 'KeyX', 'KeyA', 'KeyZ', 'KeyT', 'KeyW', 'KeyN', 'KeyP', 'KeyL', 'KeyF', 'KeyS', 'KeyD'].includes(ev.code)) {
        if (!state.activeFieldId) return;
        if (!['KeyC', 'KeyV', 'KeyX', 'KeyA', 'KeyZ'].includes(ev.code)) return;
      }
      if (ev.code === 'F11' || ev.code === 'F12') return;

      const desc = describeKey(ev, state.caps);
      if (!desc) return;

      if (desc.key === 'Shift') {
        state.setShift(true);
        state.setKeyPressed(ev.code, true);
        return;
      }
      if (desc.key === 'Control') { state.setCtrl(true); return; }
      if (desc.key === 'Alt' && !ev.repeat) {
        state.setAlt(true);
        state.setKeyPressed('AltLeft', true);
        return;
      }
      if (desc.key === 'CapsLock') {
        if (!ev.repeat) state.toggleCaps();
        state.setKeyPressed('CapsLock', true);
        return;
      }
      if (desc.key === 'Meta') return;

      if (state.settings.keyClick && !ev.repeat) keyClick(state.settings.keyClickVolume);
      if (state.settings.vibrateKeys && !ev.repeat) vibrate(6);
      state.setKeyPressed(ev.code, true);

      const consumed = handleKey({
        key: desc.key,
        code: desc.code,
        dispatch: 'physical',
        shift: desc.shift,
        caps: desc.caps,
        ctrl: desc.ctrl,
        alt: desc.alt,
        repeat: ev.repeat,
      });

      if (consumed) ev.preventDefault();
      if (ev.key === ' ') ev.preventDefault();
      if (desc.key === 'Tab') ev.preventDefault();
      if (desc.key === 'Backspace') ev.preventDefault();
      if (desc.key === 'Escape') ev.preventDefault();
      if (desc.key === 'Enter') ev.preventDefault();
      if (desc.key.startsWith('Arrow')) ev.preventDefault();
      if (desc.key === 'F1' || desc.key === 'F2' || desc.key === 'F3') ev.preventDefault();

      if (desc.kind === 'char' && state.shift && !ev.repeat) {
        state.setShift(false);
      }
    };

    const up = (ev: KeyboardEvent) => {
      const state = useStore.getState();
      state.setKeyPressed(ev.code, false);
      if (ev.key === 'Shift' || ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') state.setShift(false);
      if (ev.key === 'Control') state.setCtrl(false);
      if (ev.key === 'Alt' || ev.code === 'AltLeft' || ev.code === 'AltRight') {
        state.setAlt(false);
        state.setKeyPressed('AltLeft', false);
      }
      const desc = describeKey(ev, state.caps);
      if (desc && desc.kind === 'char' && !ev.ctrlKey && !ev.altKey) {
        onKeyUp({ key: ev.key.length === 1 ? ev.key.toLowerCase() : '', code: ev.code });
      }
    };

    const blur = () => useStore.getState().clearPressed();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [handleKey]);

  /* backlight + auto-lock idle tracking */
  useEffect(() => {
    const bump = () => { lastAlive.current = Date.now(); };
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = window.setInterval(() => {
      const s = useStore.getState();
      if (!s.powered || s.booting) return;
      const idle = (Date.now() - lastAlive.current) / 1000;
      if (s.settings.autoLock > 0 && idle > s.settings.autoLock && s.screen === 'app') {
        s.lock();
      }
    }, 5000);
    return () => {
      ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(id);
    };
  }, []);

  const dim = settings.powerSaver ? 0.82 : 1;
  const brightness = Math.max(0.35, settings.brightness) * dim;

  const screenContent = useMemo(() => {
    if (!useStore.getState().powered) return <PoweredOff />;
    if (screen === 'boot') return <BootScreen />;
    return (
      <>
        {screen !== 'off' && <StatusBar />}
        {screen === 'lock' && <LockScreen />}
        {screen === 'home' && <HomeScreen />}
        {screen === 'app' && <AppWindow />}
        {drawerOpen && screen !== 'lock' && <Drawer />}
        <RecentApps />
        <DialogLayer />
        <SoftMenuLayer />
        <ToastStack />
        <VolumeHud />
        <AlarmOverlay />
        <IncomingCallOverlay />
        <PowerMenu />
        {shutdown && <ShutdownScreen />}
      </>
    );
  }, [screen, drawerOpen, shutdown, appId, locked, searchOpen, wallpaperVersion]);

  return (
    <div className="desk" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
      <PhoneShell onKey={handleKey} screenRef={clipRef} scale={scale} screenWidth={screenWidth}>
        <div
          className="screenRoot"
          dir={settings.language === 'ar' ? 'rtl' : 'ltr'}
          data-lcd={settings.theme === 'lcd' || themePreview === 'lcd' ? 'true' : 'false'}
          data-large={settings.largeText ? 'true' : 'false'}
          style={{
            filter: `brightness(${brightness})${settings.powerSaver ? ' saturate(.85)' : ''}`,
            fontSize: settings.largeText ? 14.5 : 13,
          }}
        >
          {screenContent}
        </div>
      </PhoneShell>
    </div>
  );
}

/* ------------------------------- overlays ------------------------------- */

function VolumeHud() {
  const hud = useStore((s) => s.volumeHud);
  if (!hud) return null;
  return (
    <div className="volHud" role="status">
      <Icon name={hud.label === 'silent' ? 'headphones' : 'volume'} size={11} />
      <span style={{ textTransform: 'capitalize', fontSize: 8.5 }}>{hud.label}</span>
      <span className="bar"><i style={{ width: `${hud.value * 100}%` }} /></span>
    </div>
  );
}

function AlarmOverlay() {
  const ringing = useStore((s) => s.alarmRinging);
  const setRinging = useStore((s) => s.setAlarmRinging);
  if (!ringing) return null;
  return (
    <div className="dialogLayer" role="alertdialog" aria-label="Alarm">
      <div className="dialog" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 30, paddingTop: 10 }}>⏰</div>
        <h3 style={{ fontSize: 15 }}>{ringing}</h3>
        <div className="dBody">Alarm ringing</div>
        <div className="dActions" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => setRinging(null)}>Dismiss</button>
          <button
            className="btn primary"
            onClick={() => {
              setRinging(null);
              useStore.getState().toast('Snoozed for 5 minutes');
              window.setTimeout(() => setRinging('Snoozed alarm'), 300000);
            }}
          >
            Snooze 5 min
          </button>
        </div>
      </div>
    </div>
  );
}

function IncomingCallOverlay() {
  const call = useStore((s) => s.incomingCall);
  const setCall = useStore((s) => s.setIncomingCall);
  const openApp = useStore((s) => s.openApp);
  if (!call) return null;
  return (
    <div className="dialogLayer" role="alertdialog" aria-label="Incoming call">
      <div className="dialog" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', paddingTop: 9 }}>
          Incoming call
        </div>
        <h3 style={{ fontSize: 18 }}>{call.name || call.number}</h3>
        <div className="dBody">Simulated call — no network is used.</div>
        <div className="dActions" style={{ justifyContent: 'center' }}>
          <button
            className="btn danger"
            onClick={() => {
              setCall(null);
              useStore.getState().toast('Call declined');
            }}
          >
            Decline
          </button>
          <button
            className="btn primary"
            style={{ background: 'linear-gradient(180deg,#5fe3a1,#2fbf71)', color: '#052015' }}
            onClick={() => {
              setCall(null);
              openApp('phone', { number: call.number, activeCall: true });
            }}
          >
            Answer
          </button>
          {useStore.getState().settings.geminiApiKey && (
            <button className="btn" onClick={() => {
              setCall(null);
              openApp('phone', { number: call.number, activeCall: true, aiStart: true });
            }}>
              AI answer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
