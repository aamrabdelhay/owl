import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { APPS, APP_MAP, GAME_IDS, MEDIA_IDS, appName } from '../appRegistry';
import { AppIcon } from '../../components/AppIcon';
import { Icon } from '../../components/Icon';

const TABS = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'favorites', en: 'Favorites', ar: 'المفضلة' },
  { id: 'media', en: 'Media', ar: 'الوسائط' },
  { id: 'games', en: 'Games', ar: 'الألعاب' },
  { id: 'downloads', en: 'Downloads', ar: 'التنزيلات' },
  { id: 'frequent', en: 'Frequent', ar: 'الأكثر استخداماً' },
];

export function Drawer() {
  const open = useStore((s) => s.drawerOpen);
  const tab = useStore((s) => s.drawerTab);
  const setTab = useStore((s) => s.setDrawerTab);
  const closeDrawer = useStore((s) => s.closeDrawer);
  const openApp = useStore((s) => s.openApp);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const frequency = useStore((s) => s.frequency);
  const folder = useStore((s) => s.drawerFolder);
  const setFolder = useStore((s) => s.setDrawerFolder);
  const setSoftMenu = useStore((s) => s.setSoftMenu);
  const toast = useStore((s) => s.toast);
  const showDialog = useStore((s) => s.showDialog);
  const lang = settings.language;
  const [listView, setListView] = useState(true);

  const list = useMemo(() => {
    const base = APPS.filter((a) => !settings.hiddenApps.includes(a.id) && a.id !== 'snake' && a.id !== 'breaker'
      && a.id !== 'skyowl' && a.id !== 'pairs' && a.id !== 'mancala' && a.id !== 'sudoku'
      && a.id !== 'blocks' && a.id !== 'wordowl' && a.id !== 'solitaire' && a.id !== 'chess');
    const ordered = settings.appOrder.length
      ? [...base].sort((a, b) => {
        const ia = settings.appOrder.indexOf(a.id);
        const ib = settings.appOrder.indexOf(b.id);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      })
      : base;
    switch (tab) {
      case 'favorites':
        return ordered.filter((a) => settings.favorites.includes(a.id));
      case 'media':
        return ordered.filter((a) => a.category === 'media' || a.id === 'camera');
      case 'games':
        return APPS.filter((a) => GAME_IDS.includes(a.id) || a.id === 'games');
      case 'downloads':
        return [];
      case 'frequent':
        return [...ordered].sort((a, b) => (frequency[b.id] || 0) - (frequency[a.id] || 0)).slice(0, 12);
      default:
        return ordered;
    }
  }, [tab, settings.appOrder, settings.hiddenApps, settings.favorites, frequency]);

  if (!open) return null;

  const openMenuFor = (id: string) => {
    const fav = settings.favorites.includes(id);
    const isGame = GAME_IDS.includes(id);
    setSoftMenu({
      title: appName(id, lang),
      actions: [
        { id: 'open', label: 'Open', icon: 'play', run: () => openApp(id) },
        {
          id: 'fav', label: fav ? 'Remove from favorites' : 'Add to favorites', icon: 'star',
          run: () => {
            updateSettings({ favorites: fav ? settings.favorites.filter((f) => f !== id) : [...settings.favorites, id] });
            toast(fav ? 'Removed from favorites' : 'Added to favorites');
          },
        },
        {
          id: 'folder', label: 'Add to folder…', icon: 'folder',
          run: () => showDialog({
            title: 'New folder',
            body: `Create a folder for <strong>${appName(id, lang)}</strong> and other apps.`,
            input: { label: 'Folder name', value: '', placeholder: 'e.g. Daily' },
            confirmLabel: 'Create',
            onConfirm: (name) => {
              if (!name.trim()) return;
              updateSettings({ folders: [...settings.folders, { id: `f${Date.now()}`, name: name.trim(), apps: [id] }] });
              toast('Folder created');
            },
          }),
        },
        { id: 'hide', label: 'Hide application', icon: 'eyeOff', run: () => { updateSettings({ hiddenApps: [...settings.hiddenApps, id] }); toast('Hidden — unhide in Settings › Home screen'); } },
        isGame ? { id: 'score', label: 'High scores', icon: 'star', run: () => openApp('games', { view: 'scores', game: id }) } : null,
      ].filter(Boolean) as any,
    });
  };

  const moveApp = (id: string, dir: -1 | 1) => {
    const order = list.map((a) => a.id).filter((x) => x !== id);
    const currentIdx = list.findIndex((a) => a.id === id);
    const next = [...order];
    next.splice(Math.max(0, currentIdx + dir), 0, id);
    updateSettings({ appOrder: next });
    toast('Reordered');
  };

  return (
    <div className="drawerLayer" onClick={closeDrawer}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Applications">
        <div className="drawerHead">
          <span className="grab" />
        </div>
        <div className="drawerTabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`owlTab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              style={{ fontSize: 9 }}
            >
              {lang === 'ar' ? t.ar : t.en}
            </button>
          ))}
          <button className="iconBtn" onClick={() => setListView((v) => !v)} aria-label={listView ? 'Show icon grid' : 'Show application list'} title={listView ? 'Icon grid' : 'Application list'}>
            <Icon name={listView ? 'grid' : 'list'} size={12} />
          </button>
          <button className="iconBtn" style={{ marginLeft: 'auto' }} onClick={closeDrawer} aria-label="Close drawer">✕</button>
        </div>

        {folder ? (
          <>
            <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="iconBtn" onClick={() => setFolder(null)} aria-label="Back">‹</button>
              <strong style={{ fontSize: 11 }}>{settings.folders.find((f) => f.id === folder)?.name}</strong>
            </div>
            <div className="folderGrid">
              {(settings.folders.find((f) => f.id === folder)?.apps || []).map((id) => (
                <button key={id} className="drawerCell" onClick={() => openApp(id)}>
                  <AppIcon id={id} size={30} />
                  <span>{appName(id, lang)}</span>
                </button>
              ))}
              <button
                className="drawerCell"
                onClick={() => {
                  showDialog({
                    title: 'Remove folder',
                    body: 'Apps inside will stay installed, just ungrouped.',
                    confirmLabel: 'Remove',
                    danger: true,
                    onConfirm: () => { updateSettings({ folders: settings.folders.filter((f) => f.id !== folder) }); setFolder(null); },
                  });
                }}
                aria-label="Remove folder"
              >
                <span className="di" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center' }}><Icon name="trash" size={18} /></span>
                <span>Delete</span>
              </button>
            </div>
          </>
        ) : (
          <div className={`drawerGrid ${listView ? 'classicList' : ''}`}>
            {settings.folders.map((f) => (
              <button key={f.id} className="drawerCell" onClick={() => setFolder(f.id)}>
                <span
                  className="appIcon"
                  style={{ width: 30, height: 30, background: 'linear-gradient(160deg,#556a86,#26303f)', borderRadius: 8 }}
                >
                  <Icon name="folder" size={17} />
                </span>
                <span>{f.name}</span>
              </button>
            ))}
            {list.map((a) => (
              <button
                key={a.id}
                className="drawerCell"
                onClick={() => openApp(a.id)}
                onContextMenu={(e) => { e.preventDefault(); openMenuFor(a.id); }}
                onKeyDown={(e) => {
                  if (!e.shiftKey) return;
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.stopPropagation(); moveApp(a.id, -1); }
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.stopPropagation(); moveApp(a.id, 1); }
                }}
                title={`${a.name[lang] || a.name.en} · Menu key for options`}
                aria-label={`${a.name[lang] || a.name.en}. Press Menu for options.`}
              >
                <AppIcon id={a.id} size={30} />
                <span>{a.name[lang] || a.name.en}</span>
              </button>
            ))}
            {tab === 'downloads' && (
              <div className="empty" style={{ gridColumn: '1 / -1' }}>
                <div className="big">⬇</div>
                <div>Downloads are disabled in this simulator.</div>
                <div className="tiny">Everything else lives on your device in IndexedDB.</div>
              </div>
            )}
            {tab === 'frequent' && list.length === 0 && (
              <div className="empty" style={{ gridColumn: '1 / -1' }}><div className="big">🦉</div><div>Open a few apps and they'll show up here.</div></div>
            )}
          </div>
        )}
        <div style={{ padding: '3px 7px 5px', borderTop: '1px solid var(--line)', display: 'flex', gap: 5, alignItems: 'center' }}>
          <span className="tiny" style={{ flex: 1 }}>Menu on an icon → move · folder · hide · favorites</span>
          <button className="btn" style={{ fontSize: 9 }} onClick={() => { closeDrawer(); openApp('settings', { section: 'home' }); }}>
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default Drawer;
