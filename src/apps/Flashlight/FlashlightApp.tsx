import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';

type Mode = 'steady' | 'strobe' | 'sos';

/** Torch: real hardware torch where supported, otherwise a white-screen fallback. */
export default function FlashlightApp() {
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<Mode>('steady');
  const [torchSupported, setTorchSupported] = useState<boolean | null>(null);
  const [flash, setFlash] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    const check = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setTorchSupported(false); return; }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps: any = track.getCapabilities?.() || {};
        setTorchSupported(!!caps.torch);
      } catch {
        setTorchSupported(false);
      }
    };
    void check();
    return () => {
      window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const setTorch = async (value: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: value } as any] });
    } catch {
      /* not supported */
    }
  };

  useEffect(() => {
    window.clearInterval(timerRef.current);
    window.clearTimeout(timerRef.current);
    if (!on) {
      void setTorch(false);
      setFlash(false);
      return;
    }
    if (mode === 'steady') {
      setFlash(true);
      void setTorch(true);
      return;
    }
    if (mode === 'strobe') {
      let lit = false;
      const t = window.setInterval(() => {
        lit = !lit;
        setFlash(lit);
        void setTorch(lit);
      }, 110);
      timerRef.current = t;
      return;
    }
    // SOS: ... --- ...
    const pattern = [1, 1, 1, 0, 0, 0, 2, 2, 2, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
    let i = 0;
    const step = () => {
      const bit = pattern[i % pattern.length];
      setFlash(bit === 1);
      void setTorch(bit === 1);
      i += 1;
      timerRef.current = window.setTimeout(step, bit === 1 ? 200 : bit === 0 ? 220 : 700);
    };
    step();
    return () => window.clearTimeout(timerRef.current);
  }, [on, mode]);

  return (
    <AppFrame
      title="Flashlight"
      icon="flash"
      actions={<span className="tiny">{on ? 'on' : 'off'}</span>}
      menu={[
        { id: 'toggle', label: on ? 'Turn light off' : 'Turn light on', icon: 'flash', run: () => setOn((v) => !v) },
        { id: 'sos', label: 'SOS blink', icon: 'bell', run: () => { setOn(true); setMode('sos'); } },
        { id: 'exit', label: 'Exit and turn off', icon: 'close', danger: true, run: () => { setOn(false); useStore.getState().closeApp(); } },
      ]}
    >
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div
          style={{
            display: 'grid', placeItems: 'center', gap: 6, padding: 12, borderRadius: 8,
            background: on ? 'radial-gradient(circle at 50% 35%, rgba(255,240,180,.22), transparent 70%)' : 'var(--panel)',
            border: '1px solid var(--line)',
          }}
        >
          <div
            style={{
              width: 76, height: 76, borderRadius: '50%',
              background: on ? 'radial-gradient(circle, #fffbe8, #f2c14e 60%, #8a6416)' : 'radial-gradient(circle, #31363f, #12151a)',
              boxShadow: on ? '0 0 44px rgba(255,235,150,.75), 0 0 90px rgba(242,193,78,.4)' : 'inset 0 2px 8px #000',
              display: 'grid', placeItems: 'center',
              border: '2px solid rgba(255,255,255,.14)',
              transition: 'background 90ms linear',
            }}
            aria-hidden="true"
          >
            <Icon name="flash" size={30} style={{ color: on ? '#5c4304' : '#7d8798' }} />
          </div>
          <button
            className={`btn ${on ? 'danger' : 'primary'}`}
            onClick={() => {
              setOn((v) => !v);
              if (torchSupported === false) toast('Using the screen as a light (no hardware torch)');
            }}
          >
            {on ? 'Turn off' : 'Turn on'}
          </button>
        </div>

        <div className="fieldLabel">Mode</div>
        <div className="btnRow">
          {(['steady', 'strobe', 'sos'] as Mode[]).map((m) => (
            <button key={m} className={`btn ${mode === m ? 'primary' : ''}`} onClick={() => setMode(m)}>
              {m === 'steady' ? 'Steady' : m === 'strobe' ? 'Strobe' : 'SOS'}
            </button>
          ))}
        </div>

        <div className="card tiny" style={{ lineHeight: 1.5 }}>
          <b>Hardware torch:</b>{' '}
          {torchSupported === null ? 'checking…' : torchSupported ? 'available — using the camera flash' : 'not available in this browser/device'}.
          <br />
          When no torch is available the screen becomes a bright white panel — the classic fallback.
          Turn brightness up for maximum light.
        </div>

        <div style={{ display: 'flex', gap: 5 }}>
          <button className="btn" onClick={() => useStore.getState().setSetting('brightness', 1)}>Set brightness to 100%</button>
          <button className="btn" onClick={() => { setOn(true); setMode('sos'); }}>Quick SOS</button>
        </div>
        <div className="tiny" style={{ textAlign: 'center' }}>Tip: hold <b>T</b> on the home screen to open the torch.</div>
      </div>
      {on && <div style={{ position: 'absolute', inset: 0, background: flash ? '#fffef6' : '#e8e4d6', zIndex: -1 }} aria-hidden="true" />}
    </AppFrame>
  );
}
