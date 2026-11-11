import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { registerSW } from 'virtual:pwa-register';
import { unlockAudio } from './os/audio';
import { useStore } from './os/store';

/* ------------------------------ service worker -----------------------------
 * `autoUpdate` plus a reload when a new worker takes over means a redeploy can
 * never leave the browser pairing an old index.html with asset hashes that no
 * longer exist — the classic "blank screen right after a deploy" bug.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true);
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    // look for a new deployment whenever the tab is brought back to the front
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update();
    });
    // and once shortly after load, to catch a deploy made while we were open
    window.setTimeout(() => void registration.update(), 8_000);
  },
});

// Browsers only allow audio after a gesture; unlock on the first one.
const unlock = () => {
  unlockAudio();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Exposed for automated QA (scripts/smoke.mjs) and for debugging a deployed
// build from the console.
(window as unknown as { __OWL_STORE__: typeof useStore }).__OWL_STORE__ = useStore;

function showFallback() {
  const el = document.getElementById('owl-fallback');
  if (el) el.classList.add('on');
}

const container = document.getElementById('root');
if (!container) {
  showFallback();
  throw new Error('OWL: #root container is missing from index.html');
}

try {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // tell index.html's watchdog that the app is alive
  window.__owlBooted = true;
  document.getElementById('owl-fallback')?.classList.remove('on');
} catch (error) {
  console.error('[OWL] failed to mount', error);
  showFallback();
}
