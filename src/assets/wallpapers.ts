/**
 * Eight built-in wallpapers, generated as SVG (no bitmap assets, crisp at any
 * scale, tiny payload). Users can also upload their own image, which is then
 * cropped to the screen ratio and stored in IndexedDB.
 */

export interface WallpaperDef {
  id: string;
  name: string;
  kind: 'svg' | 'custom';
  css?: string; // for svg: a url("data:image/svg+xml,...")
  svg?: string;
}

const svg = (body: string, w = 480, h = 360) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  )}")`;

const stars = (count: number, seed = 7, maxY = 230) => {
  let out = '';
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    const x = (s % 480);
    s = (s * 16807) % 2147483647;
    const y = (s % maxY);
    s = (s * 16807) % 2147483647;
    const r = 0.4 + (s % 12) / 12;
    out += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.25 + (s % 60) / 100).toFixed(2)}"/>`;
  }
  return out;
};

const owlFace = (cx: number, cy: number, r: number, opacity = 0.55) => `
  <g opacity="${opacity}" transform="translate(${cx} ${cy})">
    <path d="M${-r} ${-r * 0.4}c0-${r * 0.75} ${r * 0.55}-${r * 1.1} ${r}-${r * 1.1}s${r} ${r * 0.35} ${r} ${r * 1.1}c0 ${r * 0.95}-${r * 0.5} ${r * 1.4}-${r} ${r * 1.4}s-${r}-${r * 0.45}-${r}-${r * 1.4}z" fill="none" stroke="#ffd78a" stroke-width="${Math.max(1.2, r * 0.1)}"/>
    <circle cx="${-r * 0.42}" cy="-${r * 0.05}" r="${r * 0.32}" fill="none" stroke="#ffd78a" stroke-width="${Math.max(1, r * 0.09)}"/>
    <circle cx="${r * 0.42}" cy="-${r * 0.05}" r="${r * 0.32}" fill="none" stroke="#ffd78a" stroke-width="${Math.max(1, r * 0.09)}"/>
    <path d="M${-r * 0.12} ${r * 0.3}l${r * 0.12} ${r * 0.22} ${r * 0.12}-${r * 0.22}z" fill="#ffd78a"/>
  </g>`;

export const WALLPAPERS: WallpaperDef[] = [
  {
    id: 'owl-night-glow',
    name: 'Owl Night',
    kind: 'svg',
    css: svg(`
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stop-color="#122a49"/><stop offset="0.55" stop-color="#0a1626"/><stop offset="1" stop-color="#05090f"/>
        </linearGradient>
        <radialGradient id="m" cx="0.72" cy="0.24" r="0.3">
          <stop offset="0" stop-color="#ffe6b0" stop-opacity=".95"/><stop offset="0.45" stop-color="#f6b93f" stop-opacity=".35"/><stop offset="1" stop-color="#f6b93f" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="480" height="360" fill="url(#g)"/>
      ${stars(46, 11, 250)}
      <circle cx="346" cy="86" r="86" fill="url(#m)"/>
      <circle cx="346" cy="86" r="26" fill="#fff2d0" opacity=".95"/>
      <circle cx="336" cy="78" r="7" fill="#fff" opacity=".6"/>
      <path d="M0 275c52-26 92-8 132-22s70-40 116-30 88 34 132 18 72-18 100-6v125H0z" fill="#0a1524" opacity=".9"/>
      <path d="M0 305c64-18 118 6 168-8s84-26 132-16 106 26 180 6v73H0z" fill="#050b14"/>
      ${owlFace(96, 250, 34, 0.5)}
      <g opacity=".8"><path d="M300 210c16-10 34-10 50 0" stroke="#1d3552" stroke-width="2" fill="none"/><path d="M290 196c22-14 48-14 70 0" stroke="#1d3552" stroke-width="2" fill="none"/></g>
    `),
  },
  {
    id: 'amber-dusk',
    name: 'Amber Dusk',
    kind: 'svg',
    css: svg(`
      <defs>
        <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#243a5c"/><stop offset="0.42" stop-color="#8a5a3c"/><stop offset="0.62" stop-color="#e0a055"/><stop offset="1" stop-color="#2a1c1c"/>
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#s)"/>
      <circle cx="240" cy="228" r="58" fill="#ffd88f" opacity=".9"/>
      <path d="M0 250c60-14 110 8 170-4s100-22 160-8 100 18 150 2v120H0z" fill="#2b2026" opacity=".85"/>
      <path d="M0 286c70-10 120 10 190 0s130-16 190-2 70 10 100 4v72H0z" fill="#191317"/>
      <g stroke="#2c2430" stroke-width="3" fill="none">
        <path d="M60 260v-46M60 226l-22-18M60 232l24-16"/>
        <path d="M420 268v-40M420 240l-20-16M420 244l22-14"/>
      </g>
      ${owlFace(360, 200, 22, 0.42)}
    `),
  },
  {
    id: 'forest-canopy',
    name: 'Forest Canopy',
    kind: 'svg',
    css: svg(`
      <defs>
        <linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0d3324"/><stop offset="0.6" stop-color="#0a2419"/><stop offset="1" stop-color="#04120c"/>
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#f)"/>
      <g opacity=".55" stroke="#7fe0a8" stroke-width="1.2" fill="none">
        ${Array.from({ length: 9 }).map((_, i) => {
          const x = i * 58 + 20;
          return `<path d="M${x} 0v${200 + (i % 3) * 40}" opacity=".5"/><path d="M${x} ${70 + (i % 4) * 30}q-26-10-34-40" opacity=".5"/><path d="M${x} ${110 + (i % 3) * 26}q28-12 38-44" opacity=".5"/>`;
        }).join('')}
      </g>
      <ellipse cx="240" cy="330" rx="240" ry="70" fill="#061c13"/>
      <ellipse cx="130" cy="345" rx="120" ry="46" fill="#04140e"/>
      ${owlFace(392, 96, 26, 0.6)}
      <g fill="#8ef2bb" opacity=".75">
        <circle cx="78" cy="300" r="2.4"/><circle cx="118" cy="318" r="1.6"/><circle cx="230" cy="312" r="2"/><circle cx="330" cy="322" r="1.4"/>
      </g>
    `),
  },
  {
    id: 'chrome-mountain',
    name: 'Chrome Mountain',
    kind: 'svg',
    css: svg(`
      <defs>
        <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#cfd9e8"/><stop offset="0.45" stop-color="#7d8ea6"/><stop offset="1" stop-color="#111a26"/>
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#c)"/>
      <path d="M0 250 120 90l70 88 60-44 90 116z" fill="#33465e" opacity=".9"/>
      <path d="M120 90l24 30-14 6 22 26-18 4 26 30-40 16z" fill="#eef4fb" opacity=".85"/>
      <path d="M250 134l34 44-22 4 26 36-28-6z" fill="#e7eef8" opacity=".7"/>
      <path d="M0 268 120 108l70 88 60-44 90 116 60-52 80 52v92H0z" fill="#1a2637" opacity=".55"/>
      <path d="M0 300c90-20 150 10 240-6s160-24 240 0v66H0z" fill="#0c131d"/>
      <g opacity=".35" stroke="#fff" stroke-width="1">
        <path d="M0 214c120-40 200 30 320-20s120-10 160-30"/>
      </g>
    `),
  },
  {
    id: 'ocean-depth',
    name: 'Ocean Depth',
    kind: 'svg',
    css: svg(`
      <defs>
        <linearGradient id="o" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#12496e"/><stop offset="0.5" stop-color="#082a44"/><stop offset="1" stop-color="#02121d"/>
        </linearGradient>
        <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9fe6ff" stop-opacity=".5"/><stop offset="1" stop-color="#9fe6ff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#o)"/>
      <g fill="url(#ray)">
        <path d="M70 0h46L58 300h-40z"/><path d="M180 0h30L140 250h-26z"/><path d="M300 0h54L296 280h-44z"/><path d="M400 0h26L392 190h-22z"/>
      </g>
      <path d="M0 300c80-26 150 12 230-8s140-30 250-4v72H0z" fill="#04121c"/>
      <g fill="#8fe4ff" opacity=".7">
        <circle cx="90" cy="120" r="2.6"/><circle cx="110" cy="150" r="1.7"/><circle cx="380" cy="90" r="2"/><circle cx="400" cy="130" r="1.4"/><circle cx="250" cy="200" r="2.2"/>
      </g>
      ${owlFace(240, 286, 30, 0.28)}
    `),
  },
  {
    id: 'ruby-silk',
    name: 'Ruby Silk',
    kind: 'svg',
    css: svg(`
      <defs>
        <linearGradient id="r" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4a0f1e"/><stop offset="0.5" stop-color="#8f1f37"/><stop offset="1" stop-color="#22060e"/>
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#r)"/>
      <g fill="none" stroke="#ff8fa8" opacity=".26">
        ${Array.from({ length: 14 }).map((_, i) => `<path d="M-40 ${i * 30}q120-44 260 0t300-8" stroke-width="${i % 3 === 0 ? 2 : 1}"/>`).join('')}
      </g>
      <circle cx="330" cy="110" r="110" fill="#ff6f8f" opacity=".09"/>
      ${owlFace(120, 250, 34, 0.4)}
    `),
  },
  {
    id: 'lcd-grid',
    name: 'LCD Grid',
    kind: 'svg',
    css: svg(`
      <rect width="480" height="360" fill="#b9c9a4"/>
      <g stroke="#6c7d59" opacity=".5">
        ${Array.from({ length: 13 }).map((_, i) => `<path d="M${i * 40} 0v360" stroke-width="0.8"/>`).join('')}
        ${Array.from({ length: 10 }).map((_, i) => `<path d="M0 ${i * 40}h480" stroke-width="0.8"/>`).join('')}
      </g>
      <g opacity=".55" transform="translate(240 150)">
        ${owlFace(0, 0, 54, 0.6)}
      </g>
      <rect x="0" y="0" width="480" height="360" fill="none" stroke="#3c5130" stroke-width="14" opacity=".18"/>
    `),
  },
  {
    id: 'nebula',
    name: 'Nebula',
    kind: 'svg',
    css: svg(`
      <defs>
        <radialGradient id="n1" cx="0.3" cy="0.3" r="0.6">
          <stop offset="0" stop-color="#8f5cff" stop-opacity=".55"/><stop offset="1" stop-color="#8f5cff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="n2" cx="0.72" cy="0.6" r="0.55">
          <stop offset="0" stop-color="#3fa9ff" stop-opacity=".5"/><stop offset="1" stop-color="#3fa9ff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="480" height="360" fill="#070a14"/>
      ${stars(70, 23, 350)}
      <rect width="480" height="360" fill="url(#n1)"/>
      <rect width="480" height="360" fill="url(#n2)"/>
      <circle cx="240" cy="190" r="66" fill="#0b1020" stroke="#ffd27a" stroke-width="1.4" opacity=".8"/>
      <ellipse cx="240" cy="190" rx="108" ry="22" fill="none" stroke="#9fe6ff" stroke-width="2" opacity=".55" transform="rotate(-14 240 190)"/>
    `),
  },
];

export const WALLPAPER_MAP: Record<string, WallpaperDef> = Object.fromEntries(WALLPAPERS.map((w) => [w.id, w]));

export function wallpaperCss(id: string, customDataUrl?: string | null): string {
  if (id && id.startsWith('custom:') && customDataUrl) return `url("${customDataUrl}")`;
  return WALLPAPER_MAP[id]?.css || WALLPAPER_MAP['owl-night-glow'].css!;
}

export function wallpaperName(id: string): string {
  if (id.startsWith('custom:')) return 'Your image';
  return WALLPAPER_MAP[id]?.name || 'Owl Night';
}
