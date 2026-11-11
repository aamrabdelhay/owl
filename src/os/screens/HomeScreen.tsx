import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, dockIds, profileLabel } from '../store';
import { APP_MAP, appName, searchApps } from '../appRegistry';
import { Icon } from '../../components/Icon';
import { formatDate, formatTime } from '../i18n';
import { useWallpaperUrl } from '../../hooks/useWallpaper';
import { AppIcon } from '../../components/AppIcon';

export function HomeScreen() {
  const settings = useStore((s) => s.settings);
  const counters = useStore((s) => s.counters);
  const openApp = useStore((s) => s.openApp);
  const searchOpen = useStore((s) => s.searchOpen);
  const searchQuery = useStore((s) => s.searchQuery);
  const openSearch = useStore((s) => s.openSearch);
  const closeSearch = useStore((s) => s.closeSearch);
  const activeFieldId = useStore((s) => s.activeFieldId);
  const openDrawer = useStore((s) => s.openDrawer);
  const [now, setNow] = useState(() => new Date());
  const [activeCounter, setActiveCounter] = useState<'messages' | 'calls' | 'calendar' | null>(null);
  const wp = useWallpaperUrl(settings.wallpaperId);
  const lang = settings.language;
  const dock = useMemo(() => dockIds(settings), [settings.appOrder]);
  const isRTL = lang === 'ar';

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const caption = activeCounter === 'messages'
    ? `(${counters.messages}) Messages`
    : activeCounter === 'calls'
      ? `(${counters.missedCalls}) Missed Calls`
      : activeCounter === 'calendar'
        ? `(${counters.reminders}) Calendar`
        : '';

  return (
    <div className="home" dir={isRTL ? 'rtl' : 'ltr'}>
      <div
        className="homeBg"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: wp || undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,.4), rgba(0,0,0,.02) 34%, rgba(0,0,0,.55))',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      <div className="homeTop">
        <div className="homeClock">
          <div className="time" aria-label="Current time">
            {formatTime(lang, now, settings.clock24)}
          </div>
          <div className="date">{formatDate(lang, now, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          <div className="homeCounters">
            <button
              className={`counter ${activeCounter === 'messages' ? 'active' : ''}`}
              onClick={() => { setActiveCounter('messages'); openApp('messages'); }}
              aria-label={`${counters.messages} unread messages`}
            >
              <span className="cicon">✉</span>{counters.messages}
            </button>
            <button
              className={`counter ${activeCounter === 'calls' ? 'active' : ''}`}
              onClick={() => { setActiveCounter('calls'); openApp('phone', { tab: 'log' }); }}
              aria-label={`${counters.missedCalls} missed calls`}
            >
              <span className="cicon">☎</span>{counters.missedCalls}
            </button>
            <button
              className={`counter ${activeCounter === 'calendar' ? 'active' : ''}`}
              onClick={() => { setActiveCounter('calendar'); openApp('calendar'); }}
              aria-label={`${counters.reminders} calendar reminders`}
            >
              <span className="cicon">▦</span>{counters.reminders}
            </button>
          </div>
        </div>
        <div className="homeRight">
          <div className="profileChip">{profileLabel(settings.profile, lang)}</div>
          {settings.userName && (
            <div style={{ fontSize: 9, color: '#fff', opacity: 0.85, textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>
              {settings.userName}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, opacity: 0.8 }}>
            <Icon name={settings.bluetooth ? 'bluetooth' : 'wifi'} size={10} />
            <Icon name="battery" size={10} />
          </div>
        </div>
      </div>

      <div className="homeMid">
        {caption && <div className="homeCaption">{(caption)}</div>}
        {!caption && (
          <div className="homeCaption" style={{ opacity: 0.62, fontWeight: 500 }}>
            {isRTL ? 'اضغط القائمة لفتح التطبيقات' : 'Press MENU for all applications'}
          </div>
        )}
      </div>

      {searchOpen && (
        <div className="homeSearchWrap">
          <div className="homeSearch">
            <Icon name="search" size={11} />
            <SearchField />
            <button
              className="iconBtn"
              aria-label="Close search"
              onClick={closeSearch}
              style={{ width: 16, height: 16, fontSize: 9 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {searchOpen && (
        <SearchResults
          query={searchQuery}
          onPick={(id) => { closeSearch(); openApp(id); }}
          onWeb={(q) => { closeSearch(); openApp('web', { query: q }); }}
          onCounter={setActiveCounter}
        />
      )}

      <div
        className={`dock ${settings.dockRows === 'two' ? 'twoRows' : ''} ${settings.dockRows === 'hidden' ? 'hidden' : ''}`}
        role="toolbar"
        aria-label="Shortcuts"
      >
        <span className="dockGrab" aria-hidden="true" />
        {dock.map((id) => {
          const meta = APP_MAP[id];
          if (!meta) return null;
          return (
            <button
              key={id}
              className="dockItem"
              onClick={() => openApp(id)}
              onContextMenu={(e) => {
                e.preventDefault();
                openDrawer();
              }}
              title={appName(id, lang)}
              aria-label={appName(id, lang)}
            >
              <span className="di"><AppIcon id={id} size={26} /></span>
              <span className="dl">{appName(id, lang)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchField() {
  const query = useStore((s) => s.searchQuery);
  const setQuery = useStore((s) => s.setSearchQuery);
  const active = useStore((s) => s.activeFieldId);
  const focusField = useStore((s) => s.focusField);
  // Local mirror so a keystroke is visible to the kernel immediately; the
  // store remains the source of truth for everything else.
  const valueRef = useRef(query);
  valueRef.current = query;

  useEffect(() => {
    let off: (() => void) | undefined;
    void import('../focus').then(({ registerField }) => {
      off = registerField({
        id: 'home-search',
        kind: 'text',
        getValue: () => {
          const value = valueRef.current;
          return useStore.getState().activeFieldId === 'home-search' ? value + '\u0001' : value;
        },
        setValue: (raw) => {
          const clean = raw.replace('\u0001', '');
          valueRef.current = clean;
          setQuery(clean);
        },
        onSubmit: () => {
          const st = useStore.getState();
          const first = document.querySelector<HTMLElement>('[data-search-result]');
          if (first) first.click();
          else if (st.searchQuery.trim()) {
            st.openApp('web', { query: st.searchQuery.trim() });
            st.closeSearch();
          }
        },
      });
    });
    return () => off?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="field"
      role="searchbox"
      aria-label="Search"
      onClick={() => focusField('home-search')}
      style={{ fontSize: 11 }}
    >
      {active === 'home-search' && <span className="caret" />}
      {query || <span style={{ opacity: 0.55 }}>Search apps, contacts, notes…</span>}
    </div>
  );
}

function SearchResults({
  query, onPick, onWeb, onCounter,
}: {
  query: string;
  onPick: (id: string) => void;
  onWeb: (q: string) => void;
  onCounter: (c: 'messages' | 'calls' | 'calendar' | null) => void;
}) {
  const settings = useStore((s) => s.settings);
  const openApp = useStore((s) => s.openApp);
  const [extras, setExtras] = useState<{ id: string; label: string; sub: string; app: string }[]>([]);
  const apps = useMemo(() => searchApps(query, settings.language).slice(0, 5), [query, settings.language]);

  useEffect(() => {
    if (!query.trim()) { setExtras([]); return; }
    let alive = true;
    void (async () => {
      const { collectionGet, DB_KEYS } = await import('../db');
      const [contacts, notes, messages] = await Promise.all([
        collectionGet<any>(DB_KEYS.contacts),
        collectionGet<any>(DB_KEYS.notes),
        collectionGet<any>(DB_KEYS.smsMessages),
      ]);
      if (!alive) return;
      const q = query.toLowerCase();
      const found: { id: string; label: string; sub: string; app: string }[] = [];
      contacts.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((c) => found.push({ id: `c-${c.id}`, label: `${c.firstName} ${c.lastName}`, sub: c.phone || 'Contact', app: 'contacts' }));
      notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((n) => found.push({ id: `n-${n.id}`, label: n.title || n.body.slice(0, 28), sub: 'Memo', app: 'memo' }));
      messages.filter((m) => String(m.body).toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((m) => found.push({ id: `m-${m.id}`, label: m.address, sub: 'Message', app: 'messages' }));
      setExtras(found);
    })();
    return () => { alive = false; };
  }, [query]);

  const hasQuery = query.trim().length > 0;

  return (
    <div className="searchResults" role="listbox" aria-label="Search results">
      {!hasQuery && (
        <div className="owlSection" style={{ padding: '6px 8px' }}>Type to search · try “notes”, “snake”, “cafe”</div>
      )}
      {apps.map((a) => (
        <button key={a.id} data-search-result className="rowBtn" onClick={() => onPick(a.id)} role="option">
          <AppIcon id={a.id} size={18} />
          <span>{a.name[settings.language] || a.name.en}</span>
          <span className="meta">App</span>
        </button>
      ))}
      {extras.map((e) => (
        <button key={e.id} data-search-result className="rowBtn" onClick={() => { onCounter(null); openApp(e.app); }} role="option">
          <Icon name={APP_MAP[e.app]?.icon || 'info'} size={13} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{e.label}</span>
          <span className="meta">{e.sub}</span>
        </button>
      ))}
      {hasQuery && (
        <button data-search-result className="rowBtn" onClick={() => onWeb(query)} role="option" style={{ borderBottom: 0 }}>
          <Icon name="globe" size={13} />
          <span>Search “{query}” with Owl Web</span>
        </button>
      )}
      {hasQuery && apps.length === 0 && extras.length === 0 && (
        <div className="tiny" style={{ padding: '2px 8px 6px' }}>No local matches — web search is ready above.</div>
      )}
    </div>
  );
}

export default HomeScreen;
