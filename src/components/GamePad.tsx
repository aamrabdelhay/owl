import React from 'react';
import type { GamePadSpec } from '../os/types';
import { useStore } from '../os/store';
import { keyClick, vibrate } from '../os/audio';

/**
 * Large touch controls that replace the keyboard while a game that asked for
 * them is open. Uses pointer-down so turns register instantly.
 */
export function GamePad({ pad }: { pad: GamePadSpec }) {
  const settings = useStore((s) => s.settings);
  const fire = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (settings.keyClick) keyClick(settings.keyClickVolume);
    if (settings.vibrateKeys) vibrate(7);
    fn();
  };
  const noMenu = (e: React.SyntheticEvent) => e.preventDefault();
  return (
    <div className="gamePad" aria-label="Game controls" onContextMenu={noMenu}>
      <div className="gpGrid">
        <button className="gpBtn gpSide" onPointerDown={fire(() => pad.onPause?.())} aria-label={pad.pauseLabel || 'Pause'} disabled={!pad.onPause}>
          {pad.pauseLabel || 'PAUSE'}
        </button>
        <button className="gpBtn gpDir" onPointerDown={fire(() => pad.onDir('up'))} aria-label="Up">▲</button>
        <button className="gpBtn gpSide" onPointerDown={fire(() => pad.onRestart?.())} aria-label="Restart" disabled={!pad.onRestart}>
          RESTART
        </button>
        <button className="gpBtn gpDir" onPointerDown={fire(() => pad.onDir('left'))} aria-label="Left">◀</button>
        <button className="gpBtn gpAction" onPointerDown={fire(() => pad.onAction())} aria-label={pad.actionLabel || 'Action'}>
          {pad.actionLabel || 'OK'}
        </button>
        <button className="gpBtn gpDir" onPointerDown={fire(() => pad.onDir('right'))} aria-label="Right">▶</button>
        <span />
        <button className="gpBtn gpDir" onPointerDown={fire(() => pad.onDir('down'))} aria-label="Down">▼</button>
        <span />
      </div>
    </div>
  );
}
