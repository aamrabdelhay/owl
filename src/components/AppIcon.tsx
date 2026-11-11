import React from 'react';
import { APP_MAP } from '../os/appRegistry';
import { Icon } from './Icon';

const THEME_ICON_STYLES: Record<string, { radius: string; gradient?: string; filter?: string; flat?: boolean }> = {
  'owl-night': { radius: '7px', gradient: 'linear-gradient(155deg, rgba(255,255,255,.38), rgba(255,255,255,.03) 52%, rgba(0,0,0,.35))' },
  'classic-silver': { radius: '5px', gradient: 'linear-gradient(160deg, rgba(255,255,255,.85), rgba(255,255,255,.2) 50%, rgba(0,0,0,.25))' },
  'forest': { radius: '7px', gradient: 'linear-gradient(155deg, rgba(255,255,255,.3), rgba(0,0,0,.3))' },
  'ruby': { radius: '50%', gradient: 'linear-gradient(155deg, rgba(255,255,255,.35), rgba(0,0,0,.35))' },
  'ocean': { radius: '10px', gradient: 'linear-gradient(155deg, rgba(255,255,255,.32), rgba(0,0,0,.3))' },
  'lcd': { radius: '0px', gradient: 'none', filter: 'grayscale(.85) contrast(1.15)' },
};

export function AppIcon({ id, size = 24 }: { id: string; size?: number }) {
  const meta = APP_MAP[id];
  const theme = typeof document !== 'undefined' ? document.documentElement.dataset.theme || 'owl-night' : 'owl-night';
  const style = THEME_ICON_STYLES[theme] || THEME_ICON_STYLES['owl-night'];
  const color = meta?.color || '#4a5568';
  const iconSize = Math.round(size * 0.56);
  return (
    <span
      className="appIcon"
      style={{
        width: size,
        height: size,
        borderRadius: style.radius,
        background: style.flat ? 'transparent' : `linear-gradient(160deg, ${color}, ${shade(color, -38)})`,
        filter: style.filter,
        boxShadow: theme === 'lcd' ? '0 0 0 1.5px #33471f' : undefined,
      }}
      aria-hidden="true"
    >
      <span style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center' }}>
        <Icon name={meta?.icon || 'info'} size={iconSize} strokeWidth={1.9} />
      </span>
      {!style.flat && (
        <span
          style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', background: style.gradient, pointerEvents: 'none',
          }}
        />
      )}
    </span>
  );
}

function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0xff) + amount;
  let b = (num & 0xff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default AppIcon;
