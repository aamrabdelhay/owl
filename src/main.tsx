import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { registerSW } from 'virtual:pwa-register';
import { unlockAudio } from './os/audio';

registerSW({ immediate: true });

// Browsers only allow audio after a gesture; unlock on the first one.
const unlock = () => {
  unlockAudio();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Exposed for automated QA (scripts/smoke.mjs) and for debugging a deployed
// build from the console. Read-only in practice: nothing external uses it.
import { useStore } from './os/store';
(window as unknown as { __OWL_STORE__: typeof useStore }).__OWL_STORE__ = useStore;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
