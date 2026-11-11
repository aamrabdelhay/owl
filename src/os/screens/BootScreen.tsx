import React, { useEffect } from 'react';
import { useStore } from '../store';
import { OwlLogo } from '../../components/OwlLogo';

export function BootScreen() {
  const progress = useStore((s) => s.bootProgress);
  return (
    <div className="bootScreen" role="status" aria-label="Booting OWL OS">
      <div className="bootInner">
        <div className="bootLogo">
          <OwlLogo size={72} glow />
        </div>
        <div className="bootBrand">OWL</div>
        <div className="bootText">Loading</div>
        <div className="bootBar"><i style={{ width: `${progress}%` }} /></div>
        <div className="bootText" style={{ fontSize: 7, letterSpacing: '0.2em', opacity: 0.5 }}>OS 1.0 · RETRO EDITION</div>
      </div>
    </div>
  );
}

/** Drives the ~2.5s boot animation. */
export function useBootSequence() {
  const booting = useStore((s) => s.booting);
  const finishBoot = useStore((s) => s.finishBoot);

  useEffect(() => {
    if (!booting) return;
    let value = 0;
    useStore.setState({ bootProgress: 0 });
    const started = Date.now();
    const id = window.setInterval(() => {
      const t = (Date.now() - started) / 2200;
      value = Math.min(100, Math.round(t * 100));
      const eased = Math.round(Math.min(100, value * (1 + Math.max(0, 0.08 - t * 0.1))));
      useStore.setState({ bootProgress: eased });
      if (t >= 1) {
        window.clearInterval(id);
        finishBoot();
      }
    }, 60);
    return () => window.clearInterval(id);
  }, [booting, finishBoot]);
}

export function ShutdownScreen() {
  return (
    <div className="shutdownAnim">
      <div className="bootInner">
        <OwlLogo size={46} glow />
        <div className="bootText">Shutting down</div>
      </div>
    </div>
  );
}

export function PoweredOff() {
  const powerOn = useStore((s) => s.powerOn);
  return (
    <div className="offScreen">
      <div className="pwHint">
        <div style={{ color: '#4b5c74', letterSpacing: '0.3em', fontSize: 8 }}>OWL</div>
        <div style={{ marginTop: 6 }}>Powered off — press Power to start</div>
        <button
          className="pwBtn"
          style={{ marginLeft: 'auto', marginRight: 'auto' }}
          onClick={powerOn}
          aria-label="Power on"
        >
          <span style={{ fontSize: 15 }}>⏻</span>
        </button>
      </div>
    </div>
  );
}

export default BootScreen;
