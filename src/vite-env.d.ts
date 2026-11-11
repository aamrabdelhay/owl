/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  /** set by main.tsx once React has mounted; read by the index.html watchdog */
  __owlBooted?: boolean;
  /** debugging/QA handle to the Zustand store */
  __OWL_STORE__?: unknown;
}

declare module 'jsmediatags' {
  const x: any;
  export default x;
}
declare module 'jsmediatags/dist/jsmediatags.min.js' {
  const x: any;
  export default x;
}
