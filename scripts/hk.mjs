import { JSDOM, VirtualConsole } from 'jsdom';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';
const vc = new VirtualConsole();
vc.on('jsdomError', () => {});
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false });
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
window.scrollTo = () => {};
window.HTMLCanvasElement.prototype.getContext = function () { const noop = () => {}; return new Proxy({}, { get: (t, k) => k === 'canvas' ? this : k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'measureText' ? () => ({ width: 10 }) : noop, set: () => true }); };
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
window.cancelAnimationFrame = (id) => clearTimeout(id);
window.AudioContext = class { constructor(){this.currentTime=0;this.destination={};this.state='running';} createOscillator(){return{connect(){},start(){},stop(){},type:'sine',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},detune:{setValueAtTime(){}}};} createGain(){return{connect(){},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:1}};} createBiquadFilter(){return{connect(){},frequency:{setValueAtTime(){}},Q:{setValueAtTime(){}}};} createBuffer(){return{getChannelData:()=>new Float32Array(256)};} createBufferSource(){return{connect(){},start(){},stop(){},buffer:null,playbackRate:{setValueAtTime(){}}};} createAnalyser(){return{connect(){},fftSize:128,frequencyBinCount:64,getByteFrequencyData(){},getByteTimeDomainData(){}};} createMediaElementSource(){return{connect(){}};} createDynamicsCompressor(){return{connect(){},threshold:{},knee:{},ratio:{},attack:{},release:{}};} resume(){} close(){} };
for (const k of ['window','document','navigator','HTMLElement','HTMLCanvasElement','Element','Node','Event','CustomEvent','MouseEvent','KeyboardEvent','PointerEvent','localStorage','sessionStorage','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','AudioContext','Image','Blob','File','FileReader','URL','screen','devicePixelRatio','matchMedia','ResizeObserver','IntersectionObserver','MediaStream','Audio','HTMLMediaElement','HTMLVideoElement','HTMLInputElement','SVGElement','Text','DOMParser','indexedDB','IDBKeyRange']) { if (window[k] !== undefined) { try { globalThis[k] = window[k]; } catch { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); } } }
globalThis.window = window; globalThis.document = window.document;
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, host: '127.0.0.1' }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const { createRoot } = await import('react-dom/client');
const { createElement, StrictMode } = await import('react');
const { useStore } = await server.ssrLoadModule('/src/os/store.ts');
const { default: App } = await server.ssrLoadModule('/src/App.tsx');
createRoot(document.getElementById('root')).render(createElement(StrictMode, null, createElement(App)));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3200);
useStore.getState().closeApp();
await wait(300);
const s = () => useStore.getState();
const origClose = useStore.getState().closeSearch;
for (const key of ['closeSearch', 'openSearch', 'back', 'openApp']) {
  const orig = useStore.getState()[key];
  useStore.setState({ [key]: (...args) => { console.log('  [call]', key, JSON.stringify(args), '\n     ', new Error().stack.split('\n').slice(2, 6).map(l => l.trim().slice(0, 90)).join('\n      ')); return orig(...args); } });
}
useStore.subscribe((st, prev) => {
  if (prev.searchOpen !== st.searchOpen) console.log('  [state] searchOpen', prev.searchOpen, '->', st.searchOpen, 'query', JSON.stringify(st.searchQuery));
  if (prev.screen !== st.screen) console.log('  [state] screen', prev.screen, '->', st.screen);
});
const before = s().recentApps.includes('settings');
// quick tap of 's'
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 's', code: 'KeyS', bubbles: true }));
window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 's', code: 'KeyS', bubbles: true }));
await wait(400);
console.log('quick tap s -> searchOpen:', s().searchOpen, 'query:', JSON.stringify(s().searchQuery), 'appId:', s().appId);
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
await wait(200);
// hold 600ms
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }));
await wait(650);
window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'm', code: 'KeyM', bubbles: true }));
await wait(400);
console.log('hold m -> appId:', s().appId);
// F1 opens app menu when inside an app
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'F1', code: 'F1', bubbles: true }));
await wait(300);
console.log('F1 in app -> appMenu:', !!s().appMenu, 'softMenu:', !!s().softMenu);
window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'F1', code: 'F1', bubbles: true }));
// Esc back
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
await wait(200);
console.log('after Esc -> appId:', s().appId, 'screen:', s().screen);
// PgUp volume
const vol = s().settings.volume;
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'PageUp', code: 'PageUp', bubbles: true }));
await wait(200);
console.log('PgUp volume', vol, '->', s().settings.volume);
s().closeApp();
await wait(300);
console.log('before typing: appId:', s().appId, 'screen:', s().screen);
// home search typing continues into the field across several keys
for (const k of ['c','a','l']) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, code: 'Key' + k.toUpperCase(), bubbles: true }));
  await wait(120);
  console.log('  after', k, '-> query:', JSON.stringify(s().searchQuery), 'active:', s().activeFieldId, 'open:', s().searchOpen, 'dom:', (document.querySelector('.homeSearch')?.textContent || '').slice(0, 24));
}
console.log('  [debug] searchOpen right after loop:', s().searchOpen, JSON.stringify(s().searchQuery));
await new Promise(r => setTimeout(r, 60));
console.log('  [debug] +60ms:', s().searchOpen, JSON.stringify(s().searchQuery));
await wait(240);
console.log('typed cal on home -> searchOpen:', s().searchOpen, 'activeField:', s().activeFieldId, 'query:', JSON.stringify(s().searchQuery));
const results = document.querySelectorAll('[data-search-result]').length;
console.log('search result rows:', results);
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
await wait(500);
console.log('Enter in search -> appId:', s().appId, 'searchOpen:', s().searchOpen);
await server.close();
process.exit(0);
