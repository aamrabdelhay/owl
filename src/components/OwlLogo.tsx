import React from 'react';

/**
 * The OWL mark: a front-facing owl face drawn with layered, chrome-embossed
 * strokes (highlight + shadow + gradient) so it reads as extruded 3D — not a
 * flat glyph. Original artwork, used on the forehead, boot screen, menu key,
 * favicon and PWA icon.
 */
export function OwlLogo({
  size = 24,
  glow = false,
  mono = false,
  title = 'OWL',
}: {
  size?: number;
  glow?: boolean;
  mono?: boolean;
  title?: string;
}) {
  const id = React.useId().replace(/[:]/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`chrome${id}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="34%" stopColor="#c8d3e2" />
          <stop offset="52%" stopColor="#6e7b8d" />
          <stop offset="70%" stopColor="#eef3fa" />
          <stop offset="100%" stopColor="#8d99ab" />
        </linearGradient>
        <linearGradient id={`amber${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffe9b0" />
          <stop offset="45%" stopColor="#f6b93f" />
          <stop offset="100%" stopColor="#a86f10" />
        </linearGradient>
        <linearGradient id={`navy${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b3e5e" />
          <stop offset="100%" stopColor="#060c18" />
        </linearGradient>
        <filter id={`glow${id}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={glow ? `url(#glow${id})` : undefined}>
        {/* extruded drop-shadow pass */}
        <g transform="translate(0.9 1.4)" opacity="0.55" style={{ mixBlendMode: 'multiply' }}>
          <path d={EAR_PATH} fill={mono ? '#000' : '#000'} />
          <path d={HEAD_PATH} fill="none" stroke="#000" strokeWidth="5.4" strokeLinejoin="round" />
        </g>

        {/* ear tufts */}
        <path d={EAR_PATH} fill={mono ? 'none' : `url(#chrome${id})`} stroke={mono ? 'currentColor' : '#0d1525'} strokeWidth="1.2" strokeLinejoin="round" />

        {/* head outline: layered strokes = bevel */}
        <path d={HEAD_PATH} fill="none" stroke={mono ? 'currentColor' : 'rgba(8,14,26,0.9)'} strokeWidth="5.6" strokeLinejoin="round" />
        <path d={HEAD_PATH} fill={mono ? 'none' : `url(#chrome${id})`} stroke={mono ? 'currentColor' : 'none'} strokeWidth="3.4" strokeLinejoin="round" />
        <path d={HEAD_PATH} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.1" strokeLinejoin="round" transform="translate(-0.4 -0.5)" opacity="0.7" />

        {/* eye discs */}
        <g>
          <circle cx="22" cy="29" r="11.4" fill={mono ? 'none' : `url(#navy${id})`} stroke={mono ? 'currentColor' : '#0c1322'} strokeWidth="2.6" />
          <circle cx="42" cy="29" r="11.4" fill={mono ? 'none' : `url(#navy${id})`} stroke={mono ? 'currentColor' : '#0c1322'} strokeWidth="2.6" />
          <circle cx="22" cy="29" r="8.4" fill={mono ? 'none' : `url(#amber${id})`} opacity={mono ? 1 : 0.95} />
          <circle cx="42" cy="29" r="8.4" fill={mono ? 'none' : `url(#amber${id})`} opacity={mono ? 1 : 0.95} />
          <circle cx="22" cy="29" r="4.6" fill={mono ? 'none' : '#08101e'} />
          <circle cx="42" cy="29" r="4.6" fill={mono ? 'none' : '#08101e'} />
          <circle cx="20.1" cy="27" r="1.7" fill="#fff" opacity="0.95" />
          <circle cx="40.1" cy="27" r="1.7" fill="#fff" opacity="0.95" />
        </g>

        {/* brow ridge + beak */}
        <path d="M11 18.5c6-3.4 16-4.6 21-1.2M31 17.3c5-3.4 15-2.2 21 1.2" fill="none" stroke={mono ? 'currentColor' : 'rgba(255,255,255,0.65)'} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
        <path d="M32 35.5l5.4 4.2-5.4 4.6-5.4-4.6z" fill={mono ? 'none' : `url(#amber${id})`} stroke={mono ? 'currentColor' : '#5c3a04'} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M32 36.4v7.4" stroke="rgba(90,52,4,0.55)" strokeWidth="0.9" />
        <path d="M22.5 47c3.4 3.6 15.6 3.6 19 0" fill="none" stroke={mono ? 'currentColor' : 'rgba(255,255,255,0.45)'} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      </g>
    </svg>
  );
}

const HEAD_PATH =
  'M32 11c-9.6 0-16.4 6.1-17.8 14.6-.6 3.6-.2 7 .5 10.3 1.2 5.4 4.6 10.2 9.2 13.2 2.5 1.6 5.3 2.6 8.1 2.6s5.6-1 8.1-2.6c4.6-3 8-7.8 9.2-13.2.7-3.3 1.1-6.7.5-10.3C48.4 17.1 41.6 11 32 11Z';

const EAR_PATH =
  'M17.6 21.4c-1.4-4.4-3.6-8-6.2-10.6 2.8-1.2 6.6-.4 9.6 1.6 2 1.3 3.6 3 4.8 5 1.4-3.6 3.4-5.7 6.2-6.4 3.6-1.4 7.6-1.2 10.6.6-2.4 2.6-4.4 6.2-5.8 10.4';

/** Compact wordmark: owl mark + OWL lettering with chrome gradient */
export function OwlWordmark({ size = 18 }: { size?: number }) {
  const id = React.useId().replace(/[:]/g, '');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3 }}>
      <OwlLogo size={size} />
      <svg width={size * 2.55} height={size * 0.62} viewBox="0 0 100 26" aria-hidden="true">
        <defs>
          <linearGradient id={`wm${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#dfe7f2" />
            <stop offset="100%" stopColor="#93a1b6" />
          </linearGradient>
        </defs>
        <text
          x="0"
          y="20"
          fill={`url(#wm${id})`}
          fontFamily="Rajdhani, Inter, sans-serif"
          fontWeight="700"
          fontSize="24"
          letterSpacing="4"
        >
          OWL
        </text>
      </svg>
    </span>
  );
}

export default OwlLogo;
