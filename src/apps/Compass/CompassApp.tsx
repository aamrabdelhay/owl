import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Compass: DeviceOrientationEvent with iOS permission flow + manual demo. */
export default function CompassApp() {
  const [heading, setHeading] = useState(0);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');
  const [demo, setDemo] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const rafRef = useRef(0);
  const demoRef = useRef(0);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    const hasOrientation = typeof DeviceOrientationEvent !== 'undefined';
    if (!hasOrientation) { setPermission('unsupported'); setDemo(true); return; }
    const anyDOE = DeviceOrientationEvent as any;
    if (typeof anyDOE.requestPermission === 'function') {
      setPermission('unknown');
    } else {
      attach();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function attach() {
    const handler = (e: DeviceOrientationEvent) => {
      const anyE = e as any;
      let h: number | null = null;
      if (typeof anyE.webkitCompassHeading === 'number') h = anyE.webkitCompassHeading;
      else if (e.alpha !== null && e.alpha !== undefined) {
        h = 360 - e.alpha;
        // rough tilt compensation
        if (e.beta !== null && e.gamma !== null) {
          const beta = (e.beta || 0) * Math.PI / 180;
          const gamma = (e.gamma || 0) * Math.PI / 180;
          if (Math.abs(beta) > 0.3) h = h + Math.sin(gamma) * 12;
        }
      }
      if (h === null) return;
      setHeading(((h % 360) + 360) % 360);
      setPermission('granted');
      setDemo(false);
    };
    window.addEventListener('deviceorientationabsolute' as any, handler, true);
    window.addEventListener('deviceorientation', handler, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute' as any, handler, true);
      window.removeEventListener('deviceorientation', handler, true);
    };
  }

  useEffect(() => {
    if (!demo) return;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      demoRef.current = (demoRef.current + dt * 0.02) % 360;
      setHeading(demoRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [demo]);

  const request = async () => {
    try {
      const anyDOE = DeviceOrientationEvent as any;
      if (typeof anyDOE.requestPermission === 'function') {
        const result = await anyDOE.requestPermission();
        if (result === 'granted') {
          setPermission('granted');
          attach();
          toast('Compass enabled');
        } else {
          setPermission('denied');
          setDemo(true);
        }
      } else {
        attach();
        setPermission('granted');
      }
    } catch {
      setPermission('denied');
      setDemo(true);
    }
  };

  const cardinal = CARDINALS[Math.round(heading / 45) % 8];
  const degrees = Math.round(heading);

  return (
    <AppFrame
      title="Compass"
      icon="compass"
      actions={<button className="hbtn" onClick={() => setDemo((d) => !d)}>{demo ? 'Real' : 'Demo'}</button>}
      menu={[
        { id: 'demo', label: demo ? 'Use real sensors' : 'Use demo mode', icon: 'compass', run: () => setDemo((d) => !d) },
        { id: 'help', label: 'How to calibrate', icon: 'help', run: () => useStore.getState().toast('Wave the phone in a figure-8 away from metal') },
      ]}
    >
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 200, height: 200, marginTop: 4 }}>
          <div
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(circle at 45% 35%, #1d2b40, #0a121d 70%)',
              border: '1px solid var(--line)',
              boxShadow: '0 0 0 3px rgba(255,255,255,.05), inset 0 0 26px rgba(0,0,0,.8)',
            }}
          />
          <div style={{ position: 'absolute', inset: 0, transform: `rotate(${-heading}deg)`, transition: demo ? 'none' : 'transform 90ms linear' }}>
            <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
              {Array.from({ length: 72 }).map((_, i) => {
                const major = i % 9 === 0;
                const angle = (i * 5 * Math.PI) / 180;
                const r1 = 82;
                const r2 = major ? 70 : 76;
                const x1 = 100 + Math.sin(angle) * r1;
                const y1 = 100 - Math.cos(angle) * r1;
                const x2 = 100 + Math.sin(angle) * r2;
                const y2 = 100 - Math.cos(angle) * r2;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? 'rgba(246,185,63,.7)' : 'rgba(180,205,235,.3)'} strokeWidth={major ? 2 : 1} />;
              })}
              {['N', 'E', 'S', 'W'].map((c, i) => {
                const angle = (i * 90 * Math.PI) / 180;
                const x = 100 + Math.sin(angle) * 60;
                const y = 100 - Math.cos(angle) * 60 + 4;
                return (
                  <text key={c} x={x} y={y} textAnchor="middle" fontSize="12" fontWeight="700" fill={c === 'N' ? '#f6b93f' : '#cfe0f7'} fontFamily="Rajdhani, Inter, sans-serif">
                    {c}
                  </text>
                );
              })}
              <polygon points="100,30 106,100 100,94 94,100" fill="#f2585b" />
              <polygon points="100,170 106,100 100,106 94,100" fill="#cfe0f7" opacity="0.75" />
              <circle cx="100" cy="100" r="4" fill="#0b1421" stroke="#8fa7c8" strokeWidth="1.5" />
            </svg>
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            <div style={{ marginTop: 66, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{degrees}°</div>
              <div className="tiny" style={{ letterSpacing: '0.2em' }}>{cardinal}</div>
            </div>
          </div>
        </div>

        {permission === 'unsupported' && (
          <div className="card tiny" style={{ maxWidth: 320 }}>
            This device has no orientation sensor. Demo mode rotates the needle so you can see how it behaves.
          </div>
        )}
        {permission === 'unknown' && (
          <button className="btn primary" onClick={() => void request()}>
            <Icon name="compass" size={11} /> Enable compass sensor
          </button>
        )}
        {permission === 'denied' && (
          <div className="card tiny" style={{ maxWidth: 320 }}>
            Sensor permission was declined. You can still use demo mode, or re-enable motion access
            in your browser's site settings.
          </div>
        )}

        <div className="btnRow" style={{ justifyContent: 'center' }}>
          <button className={`btn ${demo ? 'primary' : ''}`} onClick={() => { demoRef.current = heading; setDemo((d) => !d); }}>
            {demo ? 'Stop demo' : 'Demo mode'}
          </button>
          <button className="btn" onClick={() => { setCalibrating(true); toast('Move the device in a figure-8 to calibrate'); window.setTimeout(() => setCalibrating(false), 2600); }}>
            {calibrating ? 'Calibrating…' : 'Calibrate'}
          </button>
        </div>
        <div className="tiny" style={{ textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
          {permission === 'granted' ? 'Live sensor data (device orientation).' : 'Sensors are optional — everything else on the phone works without them.'}
        </div>
      </div>
    </AppFrame>
  );
}
