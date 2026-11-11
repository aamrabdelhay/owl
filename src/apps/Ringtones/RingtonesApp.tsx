import React, { useState } from 'react';
import { useStore } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { RINGTONES, playRingtone, stopRingtone, messageTone } from '../../os/audio';

/** All tones are synthesised with oscillators — no copyrighted audio. */
export default function RingtonesApp() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const toast = useStore((s) => s.toast);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const preview = (id: string, kind: 'ring' | 'message' | 'alarm') => {
    if (previewing === id) { stopRingtone(); setPreviewing(null); return; }
    stopRingtone();
    setPreviewing(id);
    if (kind === 'message') {
      messageTone(id, 0.9);
      window.setTimeout(() => setPreviewing(null), 2200);
    } else {
      playRingtone(id, 0.8, kind === 'alarm' ? 3 : 2);
      window.setTimeout(() => { setPreviewing(null); }, 7000);
    }
  };

  return (
    <AppFrame
      title="Ringtones"
      icon="bell"
      actions={<span className="tiny">synthesised</span>}
      menu={[
        { id: 'stop', label: 'Stop preview', icon: 'pause', run: () => { stopRingtone(); setPreviewing(null); } },
        { id: 'random', label: 'Preview a random tone', icon: 'shuffle', run: () => preview(RINGTONES[Math.floor(Math.random() * RINGTONES.length)].id, 'ring') },
        { id: 'profiles', label: 'Sound profiles', icon: 'volume', run: () => useStore.getState().openApp('profiles') },
      ]}
    >
      <div className="appBody">
        <div className="owlSection">12 original tones · generated live</div>
        {RINGTONES.map((rt) => (
          <div key={rt.id} style={{ borderBottom: '1px solid var(--line)', padding: '3px 5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button className="iconBtn" onClick={() => preview(rt.id, 'ring')} aria-label={`Preview ${rt.name}`}>
                <Icon name={previewing === rt.id ? 'pause' : 'play'} size={9} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{rt.name}</div>
                <div className="tiny">
                  {rt.notes.length} notes · {rt.tempo} BPM
                  {settings.ringtone === rt.id && ' · ringtone'}
                  {settings.messageTone === rt.id && ' · message'}
                  {settings.alarmTone === rt.id && ' · alarm'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className={`chip ${settings.ringtone === rt.id ? 'on' : ''}`} onClick={() => { setSetting('ringtone', rt.id); toast(`Ringtone: ${rt.name}`); }}>Ring</button>
                <button className={`chip ${settings.messageTone === rt.id ? 'on' : ''}`} onClick={() => { setSetting('messageTone', rt.id); messageTone(rt.id, 0.8); toast(`Message tone: ${rt.name}`); }}>Msg</button>
                <button className={`chip ${settings.alarmTone === rt.id ? 'on' : ''}`} onClick={() => { setSetting('alarmTone', rt.id); toast(`Alarm tone: ${rt.name}`); }}>Alarm</button>
              </div>
            </div>
          </div>
        ))}
        <div className="tiny" style={{ padding: 8 }}>
          Every tone is built from oscillators at runtime. No samples, no licences, no downloads.
        </div>
      </div>
    </AppFrame>
  );
}
