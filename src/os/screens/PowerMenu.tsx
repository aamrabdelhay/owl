import React from 'react';
import { useStore } from '../store';
import { Icon } from '../../components/Icon';

export function PowerMenu() {
  const open = useStore((s) => s.powerMenuOpen);
  const setOpen = useStore((s) => s.setPowerMenuOpen);
  const lock = useStore((s) => s.lock);
  const powerOff = useStore((s) => s.powerOff);
  const toast = useStore((s) => s.toast);
  if (!open) return null;
  return (
    <div className="powerMenu" role="dialog" aria-label="Device power menu" onClick={() => setOpen(false)}>
      <div className="pmCard" onClick={(e) => e.stopPropagation()}>
        <h4>Device</h4>
        <button onClick={() => { setOpen(false); lock(); }} autoFocus>
          <Icon name="lock" size={12} /> Lock keyboard
        </button>
        <button onClick={() => { setOpen(false); toast('Restarting…'); window.setTimeout(() => useStore.getState().powerOn(), 260); }}>
          <Icon name="repeat" size={12} /> Restart
        </button>
        <button onClick={() => { setOpen(false); powerOff(); }}>
          <Icon name="power" size={12} /> Shutdown
        </button>
        <button onClick={() => setOpen(false)}>
          <Icon name="close" size={12} /> Cancel
        </button>
      </div>
    </div>
  );
}

export default PowerMenu;
