import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../os/store';
import { OwlLogo } from './OwlLogo';
import { Keyboard } from './Keyboard';
import { SimpleKeyboard } from './SimpleKeyboard';
import { Icon } from './Icon';
import { keyClick, navBlip, vibrate } from '../os/audio';
import type { KeyEventLike } from '../os/kernelTypes';

interface PhoneShellProps {
  children: React.ReactNode;
  onKey: (e: KeyEventLike) => boolean;
  screenRef: React.RefObject<HTMLDivElement>;
  scale: number;
  screenWidth: number;
}

/**
 * The device: bezel, screen, navigation row with optical trackpad, full
 * laptop-layout QWERTY and side keys. Pure HTML/CSS/SVG.
 */
export function PhoneShell({ children, onKey, screenRef, scale, screenWidth }: PhoneShellProps) {
  const settings = useStore((s) => s.settings);
  const toggleCaps = useStore((s) => s.toggleCaps);
  const setShift = useStore((s) => s.setShift);
  const bumpVolume = useStore((s) => s.bumpVolume);
  const powerMenu = useStore((s) => s.setPowerMenuOpen);
  const lock = useStore((s) => s.lock);
  const screen = useStore((s) => s.screen);
  const setRecentOpen = useStore((s) => s.setRecentOpen);
  const back = useStore((s) => s.back);
  const openDrawer = useStore((s) => s.openDrawer);
  const openApp = useStore((s) => s.openApp);
  const openSearch = useStore((s) => s.openSearch);
  const appId = useStore((s) => s.appId);
  const setKeyPressed = useStore((s) => s.setKeyPressed);
  const pressed = useStore((s) => s.pressedCodes);

  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState(0);
  const powerTimer = useRef<number | undefined>(undefined);
  const menuTimer = useRef<number | undefined>(undefined);
  const padRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.reduceMotion) return;
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      setTilt({ x: nx * 2.4, y: ny * 1.6 });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [settings.reduceMotion]);

  useEffect(() => () => {
    window.clearTimeout(powerTimer.current);
    window.clearTimeout(menuTimer.current);
  }, []);

  const clickFeedback = () => {
    if (settings.keyClick) keyClick(settings.keyClickVolume);
    if (settings.vibrateKeys) vibrate(8);
    setTrail((t) => t + 1);
  };

  /* ------------------------------ nav keys ------------------------------ */
  const onCall = () => {
    clickFeedback();
    setKeyPressed('F2', true);
    window.setTimeout(() => setKeyPressed('F2', false), 140);
    onKey({ key: 'F2', code: 'F2', dispatch: 'physical', shift: false, caps: false, ctrl: false, alt: false });
  };

  const onMenuDown = () => {
    clickFeedback();
    window.clearTimeout(menuTimer.current);
    menuTimer.current = window.setTimeout(() => {
      setRecentOpen(true);
    }, 600);
  };
  const onMenuUp = () => {
    window.clearTimeout(menuTimer.current);
    if (useStore.getState().recentOpen) return;
    onKey({ key: 'F1', code: 'F1', dispatch: 'physical', shift: false, caps: false, ctrl: false, alt: false });
  };

  const onBackKey = () => {
    clickFeedback();
    onKey({ key: 'Escape', code: 'Escape', dispatch: 'physical', shift: false, caps: false, ctrl: false, alt: false });
  };

  const onPowerDown = () => {
    clickFeedback();
    window.clearTimeout(powerTimer.current);
    powerTimer.current = window.setTimeout(() => {
      powerMenu(true);
    }, 1000);
  };
  const onPowerUp = () => {
    const fired = powerTimer.current;
    window.clearTimeout(powerTimer.current);
    // if the long press already fired, the power menu is open — don't also lock
    if (useStore.getState().powerMenuOpen) return;
    void fired;
    onKey({ key: 'F3', code: 'F3', dispatch: 'physical', shift: false, caps: false, ctrl: false, alt: false });
  };

  /* ------------------------------ trackpad ------------------------------ */
  const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastMove = useRef(0);

  const moveFocus = (dir: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight') => {
    if (settings.keyClick) navBlip(settings.keyClickVolume);
    if (settings.vibrateKeys) vibrate(4);
    setTrail((t) => t + 1);
    onKey({ key: dir, code: dir, dispatch: 'physical', shift: false, caps: false, ctrl: false, alt: false });
  };

  const padPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
    lastMove.current = 0;
  };

  const padPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || e.buttons === 0) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const threshold = 16;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    const now = performance.now();
    if (now - lastMove.current < 95) return;
    lastMove.current = now;
    if (Math.abs(dx) > Math.abs(dy)) {
      moveFocus(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
      moveFocus(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
    dragStart.current = { x: e.clientX, y: e.clientY, moved: true };
  };

  const padPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    if (!start.moved) {
      clickFeedback();
      onKey({ key: 'Enter', code: 'Enter', dispatch: 'physical', shift: false, caps: false, ctrl: false, alt: false });
    }
  };

  const navPress = (code: string, down: boolean) => setKeyPressed(code, down);

  return (
    <div className="phoneStage">
      <div className="deskGlow" aria-hidden="true" />
      <div
        className="phoneTilt"
        style={{ transform: 'none' }}
      >
        <div className={`phone ${screen === 'boot' ? 'booting' : ''}`} data-trail={trail} role="application" aria-label="OWL phone simulator">
          {/* side keys */}
          <button
            type="button"
            className="sideBtn left"
            style={{ top: '16%', height: '7%' }}
            aria-label="Convenience key"
            onClick={() => { clickFeedback(); useStore.getState().toast('Convenience key — assign in Settings › Home screen'); }}
          />
          <button
            type="button"
            className="sideBtn left"
            style={{ top: '27%', height: '9%' }}
            aria-label="Volume up"
            onClick={() => bumpVolume(0.05, 'media')}
          />
          <button
            type="button"
            className="sideBtn left"
            style={{ top: '38%', height: '9%' }}
            aria-label="Volume down"
            onClick={() => bumpVolume(-0.05, 'media')}
          />
          <button
            type="button"
            className="sideBtn right"
            style={{ top: '30%', height: '6%' }}
            aria-label="Power / End"
            onPointerDown={onPowerDown}
            onPointerUp={onPowerUp}
            onPointerLeave={() => window.clearTimeout(powerTimer.current)}
            onContextMenu={(e) => e.preventDefault()}
          />
          <button
            type="button"
            className="sideBtn right"
            style={{ top: '40%', height: '5%' }}
            aria-label="Mute"
            onClick={() => useStore.getState().setSetting('profile', useStore.getState().settings.profile === 'silent' ? 'normal' : 'silent')}
          />

          <div className="phoneDisplayArea">
          {/* forehead */}
          <div className="topBezel">
            <div className="earpiece" aria-label="Earpiece speaker">
              {Array.from({ length: 14 }).map((_, i) => <i key={i} />)}
            </div>
            <div className="owlPlate">
              <OwlLogo size={18} />
              <span>OWL</span>
            </div>
            <div className="sensorDot" aria-label="Ambient sensor" />
          </div>

          {/* screen */}
          <div className="screenBezel">
            <div className="screenClip" ref={screenRef}>
              <div
                className="screenScale"
                style={{ width: `${screenWidth}px`, transform: `translate(-50%, -50%) scale(${scale})` }}
              >
                {children}
              </div>
              <div className="screenGlass" aria-hidden="true" />
            </div>
          </div>

          </div>
          <div className="phoneInputArea">
          {/* navigation row */}
          <div className="navRow">
            <button
              type="button"
              className={`navKey call ${pressed.includes('F2') ? 'isDown' : ''}`}
              aria-label="Call / Answer"
              onClick={onCall}
              onPointerDown={() => navPress('F2', true)}
              onPointerUp={() => navPress('F2', false)}
            >
              <Icon name="phone" size={18} strokeWidth={2} />
              <span className="navBadge">CALL</span>
            </button>

            <button
              type="button"
              className="navKey menu"
              aria-label="Menu — press and hold to switch applications"
              onPointerDown={onMenuDown}
              onPointerUp={onMenuUp}
              onPointerLeave={() => window.clearTimeout(menuTimer.current)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <OwlLogo size={20} />
              <span className="navBadge">MENU</span>
            </button>

            <div className="trackpadWrap">
              <div className="trackpadRing" aria-hidden="true" />
              <div
                ref={padRef}
                className={`trackpad ${trail % 2 === 0 ? 'glow' : ''} ${pressed.includes('Enter') ? 'pressed' : ''}`}
                role="button"
                tabIndex={-1}
                aria-label="Optical trackpad — drag to move, click to select"
                onPointerDown={padPointerDown}
                onPointerMove={padPointerMove}
                onPointerUp={padPointerUp}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>

            <button
              type="button"
              className={`navKey back ${pressed.includes('Escape') ? 'isDown' : ''}`}
              aria-label="Back"
              onClick={onBackKey}
              onPointerDown={() => navPress('Escape', true)}
              onPointerUp={() => navPress('Escape', false)}
            >
              <Icon name="enter" size={18} strokeWidth={2} style={{ transform: 'scaleX(-1)' }} />
              <span className="navBadge">BACK</span>
            </button>

            <button
              type="button"
              className={`navKey end ${pressed.includes('F3') ? 'isDown' : ''}`}
              aria-label="End / Power — press and hold for power menu"
              onPointerDown={onPowerDown}
              onPointerUp={onPowerUp}
              onPointerLeave={() => window.clearTimeout(powerTimer.current)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <Icon name="phoneOff" size={18} strokeWidth={2} />
              <span className="navBadge">END</span>
            </button>
          </div>

          {/* keyboard */}
          {settings.keyboardMode === 'simple' ? <SimpleKeyboard onKey={onKey} /> : <Keyboard onKey={onKey} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhoneShell;
