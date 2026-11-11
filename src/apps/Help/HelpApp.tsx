import React from 'react';
import { useStore } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { SHORTCUT_LEGEND } from '../../os/keys';

export default function HelpApp() {
  const openApp = useStore((s) => s.openApp);
  return (
    <AppFrame title="Quick Help" icon="help" actions={<span className="tiny">tips</span>}>
      <div className="appBody pad" style={{ display: 'grid', gap: 6 }}>
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Driving the phone</div>
          <div className="tiny" style={{ lineHeight: 1.6 }}>
            The desk keyboard and the on-screen keyboard are the same thing. Physical presses light
            up the matching key on the device. Arrows move the highlight, Enter selects, Esc goes back.
            Tap the screen for direct touch on phones and tablets.
          </div>
        </div>

        <div className="owlSection" style={{ padding: 0 }}>Keyboard map</div>
        <div className="card">
          {SHORTCUT_LEGEND.map(([k, d]) => (
            <div key={k} className="kv" style={{ borderBottom: '1px dashed var(--line)' }}>
              <b className="mono" style={{ fontSize: 9.5 }}>{k}</b>
              <span style={{ fontSize: 9.5, textAlign: 'right' }}>{d}</span>
            </div>
          ))}
        </div>

        <div className="owlSection" style={{ padding: 0 }}>Power user tips</div>
        <div className="card tiny" style={{ lineHeight: 1.6 }}>
          • Type any letter on the home screen to search everything.<br />
          • Hold a letter to jump to its hotkey app.<br />
          • Hold Menu to switch between recent apps.<br />
          • PageUp / PageDown adjusts the volume with a HUD.<br />
          • Hold T on the home screen for the flashlight.<br />
          • Every app is code-split, so it's fast even on old hardware.
        </div>

        <div className="btnRow">
          <button className="btn primary" onClick={() => openApp('settings')}>
            <Icon name="settings" size={10} /> Open Settings
          </button>
          <button className="btn" onClick={() => openApp('setup')}>Setup wizard</button>
        </div>
        <div className="tiny" style={{ textAlign: 'center' }}>
          Everything runs locally. No account, no cloud, no tracking.
        </div>
        <a
          href="https://github.com/aamrabdelhay/owl"
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: 'var(--hl)', fontSize: 9, textAlign: 'center', display: 'block' }}
        >
          github.com/aamrabdelhay/owl
        </a>
      </div>
    </AppFrame>
  );
}
