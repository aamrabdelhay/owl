import React from 'react';
import { useStore, profileLabel } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import type { ProfileId } from '../../os/types';

const PROFILES: { id: ProfileId; desc: string; icon: string; ring: number; keyClick: boolean; vibrate: boolean }[] = [
  { id: 'normal', desc: 'Balanced ring and key clicks', icon: 'volume', ring: 0.75, keyClick: true, vibrate: true },
  { id: 'loud', desc: 'Maximum ring, alarms and key clicks', icon: 'bell', ring: 1, keyClick: true, vibrate: true },
  { id: 'vibrate', desc: 'No sound, vibration only', icon: 'headphones', ring: 0, keyClick: false, vibrate: true },
  { id: 'silent', desc: 'No sound and no vibration', icon: 'headphones', ring: 0, keyClick: false, vibrate: false },
  { id: 'meeting', desc: 'Low ring, no key clicks', icon: 'volume', ring: 0.25, keyClick: false, vibrate: true },
  { id: 'custom', desc: 'Your own mix of the sliders', icon: 'settings', ring: 0.6, keyClick: true, vibrate: true },
];

export default function ProfilesApp() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setSetting = useStore((s) => s.setSetting);
  const toast = useStore((s) => s.toast);

  const apply = (id: ProfileId) => {
    const p = PROFILES.find((x) => x.id === id)!;
    updateSettings({
      profile: id,
      ringVolume: id === 'custom' ? settings.ringVolume : p.ring,
      keyClick: id === 'custom' ? settings.keyClick : p.keyClick,
      vibrate: id === 'custom' ? settings.vibrate : p.vibrate,
      volume: id === 'silent' || id === 'vibrate' ? 0 : id === 'loud' ? 1 : settings.volume,
    });
    toast(`${profileLabel(id, settings.language)} profile on`);
  };

  return (
    <AppFrame title="Sound profiles" icon="volume">
      <div className="appBody">
        <div className="owlSection">Choose a profile</div>
        {PROFILES.map((p) => (
          <button
            key={p.id}
            className="rowBtn"
            onClick={() => apply(p.id)}
            style={{ background: settings.profile === p.id ? 'rgba(246,185,63,.12)' : undefined }}
          >
            <Icon name={p.icon} size={13} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600 }}>{profileLabel(p.id, settings.language)}</span>
              <span className="tiny">{p.desc}</span>
            </div>
            {settings.profile === p.id && <span className="pill amber meta">active</span>}
          </button>
        ))}

        <div className="owlSection">Fine tune</div>
        <div style={{ padding: '0 8px 6px', display: 'grid', gap: 3 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span className="tiny" style={{ width: 56 }}>Ring</span>
            <input type="range" min={0} max={1} step={0.05} value={settings.ringVolume} onChange={(e) => { setSetting('ringVolume', Number(e.target.value)); setSetting('profile', 'custom'); }} style={{ flex: 1, accentColor: 'var(--hl)' }} inputMode="none" aria-label="Ring volume" />
            <span className="tiny mono" style={{ width: 24 }}>{Math.round(settings.ringVolume * 100)}</span>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span className="tiny" style={{ width: 56 }}>Media</span>
            <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => { setSetting('volume', Number(e.target.value)); setSetting('profile', 'custom'); }} style={{ flex: 1, accentColor: 'var(--hl)' }} inputMode="none" aria-label="Media volume" />
            <span className="tiny mono" style={{ width: 24 }}>{Math.round(settings.volume * 100)}</span>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span className="tiny" style={{ width: 56 }}>Alarm</span>
            <input type="range" min={0} max={1} step={0.05} value={settings.alarmVolume} onChange={(e) => setSetting('alarmVolume', Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--hl)' }} inputMode="none" aria-label="Alarm volume" />
            <span className="tiny mono" style={{ width: 24 }}>{Math.round(settings.alarmVolume * 100)}</span>
          </div>
          <div className="btnRow" style={{ marginTop: 2 }}>
            <button className={`chip ${settings.keyClick ? 'on' : ''}`} onClick={() => { setSetting('keyClick', !settings.keyClick); setSetting('profile', 'custom'); }}>Key clicks</button>
            <button className={`chip ${settings.vibrate ? 'on' : ''}`} onClick={() => { setSetting('vibrate', !settings.vibrate); setSetting('profile', 'custom'); }}>Vibration</button>
            <button className={`chip ${settings.vibrateKeys ? 'on' : ''}`} onClick={() => setSetting('vibrateKeys', !settings.vibrateKeys)}>Vibrate on key</button>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
