import React, { useEffect, useState } from 'react';
import { useStore } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { OwlLogo } from '../../components/OwlLogo';
import type { ThemeId } from '../../os/types';

const THEMES: { id: ThemeId; name: string; blurb: string; swatch: string[]; font: string }[] = [
  { id: 'owl-night', name: 'Owl Night', blurb: 'Default dark navy with amber eyes', swatch: ['#0b1729', '#f6b93f', '#17304f'], font: 'Inter' },
  { id: 'classic-silver', name: 'Classic Silver', blurb: 'Bright chrome, blue highlights', swatch: ['#eef1f6', '#2a6fdb', '#b6c2d3'], font: 'Inter' },
  { id: 'forest', name: 'Forest Green', blurb: 'Deep evergreen, mint accents', swatch: ['#0b2a1d', '#63d29b', '#14543a'], font: 'Inter' },
  { id: 'ruby', name: 'Ruby', blurb: 'Crimson body, rose highlights', swatch: ['#2a0b17', '#ff5e7d', '#571630'], font: 'Rajdhani' },
  { id: 'ocean', name: 'Ocean Blue', blurb: 'Midnight sea, cyan glow', swatch: ['#072033', '#45c8ff', '#0f456b'], font: 'Rajdhani' },
  { id: 'lcd', name: 'Retro LCD', blurb: 'Monochrome green pixel display', swatch: ['#b9c9a4', '#33471f', '#93a17f'], font: 'Press Start 2P' },
];

export default function ThemesApp() {
  const current = useStore((s) => s.settings.theme);
  const setSetting = useStore((s) => s.setSetting);
  const togglePreview = useStore((s) => s.toggleThemePreview);
  const toast = useStore((s) => s.toast);
  const preview = useStore((s) => s.themePreview);
  const [selected, setSelected] = useState<ThemeId | null>(null);

  useEffect(() => () => togglePreview(null), [togglePreview]);

  return (
    <AppFrame
      menu={[
        { id: 'reset', label: 'Cancel preview', icon: 'repeat', run: () => { togglePreview(null); setSelected(null); } },
        { id: 'apply', label: 'Apply selected theme', icon: 'check', run: () => { if (selected) { setSetting('theme', selected); togglePreview(null); toast('Theme applied'); } } },
        { id: 'exit', label: 'Exit', icon: 'close', run: () => useStore.getState().closeApp() },
      ]}
      title="Themes"
      icon="palette"
      actions={<span className="tiny">preview → apply</span>}
    >
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div className="card" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <OwlLogo size={28} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700 }}>Make it yours</div>
            <div className="tiny">A theme recolours the OS, icons, menus and fonts. The phone body stays chrome and graphite.</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {THEMES.map((t) => (
            <div
              key={t.id}
              className="card"
              style={{
                padding: 5, display: 'grid', gap: 3,
                borderColor: current === t.id ? 'var(--hl)' : undefined,
                outline: preview === t.id ? '1px dashed var(--hl)' : undefined,
              }}
            >
              <div style={{ display: 'flex', height: 26, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)' }}>
                {t.swatch.map((c) => <span key={c} style={{ flex: 1, background: c }} />)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <strong style={{ fontSize: 10.5, fontFamily: t.font === 'Press Start 2P' ? 'Press Start 2P' : undefined }}>{t.name}</strong>
                {current === t.id && <span className="pill amber">active</span>}
              </div>
              <div className="tiny" style={{ lineHeight: 1.35 }}>{t.blurb}</div>
              <div style={{ display: 'flex', gap: 3, marginTop: 1 }}>
                <button
                  className="btn"
                  style={{ fontSize: 8.5, padding: '1px 5px' }}
                  onClick={() => { togglePreview(preview === t.id ? null : t.id); setSelected(t.id); }}
                >
                  {preview === t.id ? 'Stop' : 'Preview'}
                </button>
                <button
                  className="btn primary"
                  style={{ fontSize: 8.5, padding: '1px 5px' }}
                  onClick={() => { setSetting('theme', t.id); togglePreview(null); toast(`${t.name} applied`); }}
                >
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="tiny">
          Themes persist with your settings. High contrast is available in Settings › Accessibility.
        </div>
      </div>
    </AppFrame>
  );
}
