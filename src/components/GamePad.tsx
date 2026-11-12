import React from 'react';
import type { GamePadSpec } from '../os/types';
import { useStore } from '../os/store';
import { keyClick, vibrate } from '../os/audio';

/**
 * Direction controls live in the handset's lower control area. Game actions
 * are rendered at the top of the game screen, separate from the D-pad.
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
    <div className="gamePad" aria-label="Game controls" onContextMenu={noMenu} style={{ '--gamepad-scale': settings.gamePadScale || 1 } as React.CSSProperties}>
      <div className="gpControls" aria-label="Direction pad">
        <span />
        <button className="gpBtn gpDir" onPointerDown={fire(() => pad.onDir('up'))} aria-label="Up">▲</button>
        <span />
        <button className="gpBtn gpDir" onPointerDown={fire(() => pad.onDir('left'))} aria-label="Left">◀</button>
        <span className="gpCenter" aria-hidden="true">OWL</span>
        <button className="gpBtn gpDir" onPointerDown={fire(() => pad.onDir('right'))} aria-label="Right">▶</button>
        <span />
        <button className="gpBtn gpDir" onPointerDown={fire(() => pad.onDir('down'))} aria-label="Down">▼</button>
        <span />
      </div>
    </div>
  );
}
