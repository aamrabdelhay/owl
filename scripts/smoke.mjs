/**
 * Headless smoke test for OWL OS.
 *
 * Boots the real React app inside jsdom (through Vite's SSR module runner, so
 * TypeScript and the lazy app chunks load exactly as they do in dev), then opens
 * every registered app one by one and reports crashes, React errors and empty
 * renders. No browser download needed.
 *
 *   npm run smoke
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import 'fake-indexeddb/auto'; // real IndexedDB behaviour without a browser
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const issues = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const msg = String(e?.message || e).split('\n')[0];
  if (/Could not parse CSS|Not implemented:/.test(msg)) return;
  issues.push(`jsdomError: ${msg}`);
});
vc.on('error', (...a) => issues.push(`console.error: ${a.join(' ').split('\n')[0]}`));
vc.on('warn', (...a) => {
  const msg = a.join(' ');
  if (!/Warning/.test(msg)) return;
  if (/Each child in a list|Cannot update a component|not wrapped in act|React Router/.test(msg)) return;
  issues.push(`console.warn: ${msg.split('\n')[0]}`);
});

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;

// --- browser APIs jsdom does not implement -------------------------------
window.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
window.scrollTo = () => {};
window.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {};
  return new Proxy({}, {
    get: (_t, k) => {
      if (k === 'canvas') return this;
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (k === 'toDataURL') return () => 'data:image/png;base64,';
      return noop;
    },
    set: () => true,
  });
};
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};
window.HTMLMediaElement.prototype.load = () => {};
window.indexedDB = globalThis.indexedDB;
window.IDBKeyRange = globalThis.IDBKeyRange;
window.navigator.vibrate = () => true;
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
window.cancelAnimationFrame = (id) => clearTimeout(id);
window.AudioContext = class {
  constructor() { this.currentTime = 0; this.destination = {}; this.state = 'running'; this.sampleRate = 44100; }
  createOscillator() { return { connect() {}, start() {}, stop() {}, type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, detune: { setValueAtTime() {} }, onended: null }; }
  createGain() { return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 1 } }; }
  createBiquadFilter() { return { connect() {}, frequency: { setValueAtTime() {} }, Q: { setValueAtTime() {} }, type: 'lowpass' }; }
  createBuffer() { return { getChannelData: () => new Float32Array(256) }; }
  createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null, loop: false, playbackRate: { setValueAtTime() {} } }; }
  createAnalyser() { return { connect() {}, fftSize: 128, frequencyBinCount: 64, smoothingTimeConstant: 0.8, getByteFrequencyData() {}, getByteTimeDomainData() {} }; }
  createMediaElementSource() { return { connect() {} }; }
  createDynamicsCompressor() { return { connect() {}, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
  createStereoPanner() { return { connect() {}, pan: { setValueAtTime() {} } }; }
  resume() {} close() {}
};

// --- expose the jsdom globals to the SSR module graph --------------------
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'localStorage', 'sessionStorage', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'AudioContext', 'Image', 'Blob', 'File', 'FileReader', 'URL', 'screen', 'devicePixelRatio', 'matchMedia', 'ResizeObserver', 'IntersectionObserver', 'MediaStream', 'Audio', 'HTMLMediaElement', 'HTMLVideoElement', 'HTMLInputElement', 'SVGElement', 'Text', 'DOMParser', 'XMLSerializer', 'Notification', 'indexedDB', 'IDBKeyRange']) {
  if (window[key] === undefined) continue;
  try {
    globalThis[key] = window[key];
  } catch {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
  }
}
globalThis.window = window;
globalThis.document = window.document;

const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false, host: '127.0.0.1' },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
try {
  const [{ createRoot }, { createElement, StrictMode }, storeMod] = await Promise.all([
    import('react-dom/client'),
    import('react'),
    server.ssrLoadModule('/src/os/store.ts'),
  ]);
  const { default: App } = await server.ssrLoadModule('/src/App.tsx');
  const store = storeMod.useStore;
  const registry = storeMod.APP_MAP ? storeMod : await server.ssrLoadModule('/src/os/appRegistry.ts');
  const ids = Object.keys(registry.APP_MAP || {});

  createRoot(window.document.getElementById('root')).render(createElement(StrictMode, null, createElement(App)));
  await wait(400);
  console.log(`booted — ${ids.length} apps registered`);

  const booted = window.document.body.textContent.length > 0;
  if (!booted) {
    console.log('FAIL: nothing rendered on boot');
    failures += 1;
  }

  // leave the boot/lock flow alone: open apps directly through the store
  store.setState({ screen: 'app', locked: false });

  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const id of (ONLY || ids)) {
    const before = issues.length;
    // user activity, so the idle auto-lock can never fire mid-run
    window.dispatchEvent(new window.Event('pointerdown'));
    try {
      store.getState().openApp(id);
    } catch (e) {
      issues.push(`openApp(${id}) threw: ${e.message}`);
    }
    const openState = store.getState();
    if (openState.appId !== id || openState.screen !== 'app') {
      console.log(`FAIL ${id}: openApp ignored (appId=${openState.appId}, screen=${openState.screen})`);
      failures += 1;
      continue;
    }
    await wait(150);
    if (store.getState().screen !== 'app') {
      console.log(`FAIL ${id}: the screen changed to "${store.getState().screen}" after opening` + (process.env.TRACE ? ' | lastClose=' + JSON.stringify(globalThis.__lastClose) : ''));
      failures += 1;
      try { store.getState().closeApp(); } catch { /* ignore */ }
      await wait(60);
      continue;
    }
    const text = window.document.body.textContent || '';
    const crashed = /hit a snag/.test(text);
    const hasMenu = !!store.getState().appMenu;
    const screenNow = store.getState().screen;
    if (screenNow !== 'app') {
      // the OS went home instead of showing the app: report it as a failure
      failures += 1;
      console.log(`FAIL ${id}: screen reverted to "${screenNow}"`);
      try { store.getState().closeApp(); } catch { /* ignore */ }
      await wait(60);
      continue;
    }
    const rendered = /appFrame|gameWrap/.test(window.document.body.innerHTML) && text.trim().length > 4;
    const newIssues = issues.slice(before);
    if (!rendered) {
      failures += 1;
      console.log(`FAIL ${id}: rendered nothing`);
      try { store.getState().closeApp(); } catch { /* ignore */ }
      await wait(80);
      continue;
    }
    if (crashed || newIssues.length) {
      failures += 1;
      console.log(`FAIL ${id}`);
      (crashed ? ['error boundary caught a crash'] : newIssues).slice(0, 3).forEach((m) => console.log('    ', m));
    } else {
      console.log(`ok   ${id}${hasMenu ? '' : '   (no Menu rows)'}`);
    }
    try { store.getState().closeApp(); } catch { /* ignore */ }
    await wait(50);
  }
} catch (e) {
  failures += 1;
  console.log('FATAL', e?.stack || e);
} finally {
  await server.close();
}

if (issues.length) {
  console.log(`\n${issues.length} console issue(s):`);
  [...new Set(issues)].slice(0, 30).forEach((m) => console.log(' -', m));
}
console.log(failures ? `\n${failures} failure(s)` : '\nAll apps rendered without errors.');
process.exit(failures ? 1 : 0);
