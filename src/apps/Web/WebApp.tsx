import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { BrowserBookmark, BrowserHistory, BrowserTab } from '../../os/types';
import {
  commonsImages, fetchReader, normalizeUrl, owlSearch, wikipediaReader, SEARCH_ENGINES,
  type ReaderResult, type SearchResult,
} from '../../os/api';

type Phase = 'home' | 'results' | 'page' | 'reader';

const HOME_PAGE = 'owl://home';

export default function WebApp({ query: initialQuery }: { query?: string }) {
  const settings = useStore((s) => s.settings);
  const toast = useStore((s) => s.toast);
  const showDialog = useStore((s) => s.showDialog);
  const [tabs, setTabs] = useState<BrowserTab[]>([{ id: uid('tab'), title: 'New tab', url: HOME_PAGE, historyIndex: 0, history: [HOME_PAGE] }]);
  const [activeTab, setActiveTab] = useState(0);
  const [tabSwitcher, setTabSwitcher] = useState(false);
  const [phase, setPhase] = useState<Phase>('home');
  const [address, setAddress] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [images, setImages] = useState<{ title: string; url: string; page: string }[]>([]);
  const [loading, setLoading] = useState(0);
  const [reader, setReader] = useState<ReaderResult | null>(null);
  const [frameState, setFrameState] = useState<'ok' | 'blocked'>('ok');
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [zoom, setZoom] = useState(1);
  const [menuOpen, setMenuOpen] = useState<'none' | 'bookmarks' | 'history'>('none');
  const [fullscreen, setFullscreen] = useState(false);
  const [bookmarks, setBookmarks] = useCollection<BrowserBookmark>(DB_KEYS.bookmarks, [
    { id: 'bm-wiki', title: 'Wikipedia', url: 'https://en.wikipedia.org/', at: Date.now() },
    { id: 'bm-ddg', title: 'DuckDuckGo', url: 'https://duckduckgo.com/', at: Date.now() },
  ]);
  const [history, setHistory] = useCollection<BrowserHistory>(DB_KEYS.history);
  const frameTimer = useRef<number | undefined>(undefined);
  const tab = tabs[activeTab];
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQuery) {
      void runSearch(initialQuery);
    } else if (settings.homePage && settings.homePage !== HOME_PAGE && phase === 'home') {
      setAddress(settings.homePage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const setUrl = useCallback((url: string, title = url) => {
    setTabs((prev) => prev.map((t, i) => {
      if (i !== activeTab) return t;
      const hist = t.history.slice(0, t.historyIndex + 1);
      hist.push(url);
      return { ...t, url, title, history: hist, historyIndex: hist.length - 1 };
    }));
  }, [activeTab]);

  const pushHistory = (url: string, title: string) => {
    setHistory((prev) => [{ id: uid('h'), url, title, at: Date.now() }, ...prev.filter((h) => h.url !== url)].slice(0, 200));
  };

  const runSearch = async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setLoading((l) => l + 1);
    setPhase('results');
    setResults([]);
    setImages([]);
    setAddress(query);
    setUrl(`owl://search?q=${encodeURIComponent(query)}`, `Search: ${query}`);
    try {
      const found = await owlSearch(query);
      setResults(found);
      try {
        const pics = await commonsImages(query);
        setImages(pics);
      } catch { /* images optional */ }
    } finally {
      setLoading((l) => Math.max(0, l - 1));
    }
  };

  const openUrl = async (url: string, title?: string) => {
    const normalized = normalizeUrl(url) || url;
    setPhase('page');
    setFrameState('ok');
    setReader(null);
    setAddress(normalized);
    setUrl(normalized, title || normalized);
    setTabs((prev) => prev.map((t, i) => (i === activeTab ? { ...t, title: title || normalized } : t)));
    pushHistory(normalized, title || normalized);
    setLoading((l) => l + 1);

    // Wikipedia always works through the reader renderer (no iframe needed).
    if (/^https?:\/\/([a-z]{2}\.)?wikipedia\.org\/wiki\//.test(normalized)) {
      const slug = decodeURIComponent(normalized.split('/wiki/')[1] || '');
      const r = await wikipediaReader(slug);
      setLoading((l) => Math.max(0, l - 1));
      if (r) { setReader(r); setPhase('reader'); return; }
    }

    // Give the iframe 4.5s: if the blocked-fallback fires, switch to reader mode.
    window.clearTimeout(frameTimer.current);
    frameTimer.current = window.setTimeout(async () => {
      setLoading((l) => Math.max(0, l - 1));
      setFrameState('blocked');
      const r = await fetchReader(normalized);
      if (r) { setReader(r); setPhase('reader'); }
    }, 4500);
  };

  const submitAddress = () => {
    const raw = address.trim();
    if (!raw) return;
    const asUrl = normalizeUrl(raw);
    if (asUrl) { void openUrl(asUrl); return; }
    void runSearch(raw);
  };

  const onFrameLoad = () => {
    window.clearTimeout(frameTimer.current);
    setLoading((l) => Math.max(0, l - 1));
    setFrameState('ok');
  };

  const loadReader = async (url: string) => {
    setLoading((l) => l + 1);
    const r = /wikipedia\.org\/wiki\//.test(url)
      ? await wikipediaReader(decodeURIComponent(url.split('/wiki/')[1] || ''))
      : await fetchReader(url);
    setLoading((l) => Math.max(0, l - 1));
    if (r) { setReader(r); setPhase('reader'); } else { toast('Reader mode could not load that page'); }
  };

  const goBack = () => {
    if (tab.historyIndex > 0) {
      const nextIdx = tab.historyIndex - 1;
      const url = tab.history[nextIdx];
      setTabs((prev) => prev.map((t, i) => (i === activeTab ? { ...t, historyIndex: nextIdx, url } : t)));
      if (url.startsWith('owl://search')) { setPhase('results'); setAddress(decodeURIComponent(url.split('q=')[1] || '')); }
      else if (url === HOME_PAGE) setPhase('home');
      else { setPhase('page'); setAddress(url); setFrameState('ok'); }
    } else {
      setPhase('home');
    }
  };

  const isBookmarked = bookmarks.some((b) => b.url === tab.url);
  const toggleBookmark = () => {
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== tab.url));
      toast('Bookmark removed');
    } else {
      setBookmarks((prev) => [{ id: uid('bm'), title: tab.title, url: tab.url, at: Date.now() }, ...prev]);
      toast('Bookmarked');
    }
  };

  const newTab = () => {
    if (tabs.length >= 5) { toast('Maximum 5 tabs'); return; }
    setTabs((prev) => [...prev, { id: uid('tab'), title: 'New tab', url: HOME_PAGE, historyIndex: 0, history: [HOME_PAGE] }]);
    setActiveTab(tabs.length);
    setPhase('home');
    setAddress('');
  };

  const closeTab = (index: number) => {
    if (tabs.length === 1) { toast('Last tab cannot be closed'); return; }
    setTabs((prev) => prev.filter((_, i) => i !== index));
    setActiveTab((i) => (i >= index && i > 0 ? i - 1 : i));
    setPhase('home');
  };

  const voiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast('Voice search is not supported in this browser'); return; }
    const rec = new SR();
    rec.lang = settings.language === 'ar' ? 'ar-EG' : 'en-US';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setAddress(text);
      void runSearch(text);
    };
    rec.onerror = () => toast('Voice search failed — check microphone permission');
    try { rec.start(); toast('Listening…'); } catch { toast('Could not start voice search'); }
  };

  const downloadBlocked = () => toast('Downloads are disabled in this simulator.');

  const highlightMatch = (text: string) => {
    if (!findText.trim()) return text;
    const parts = text.split(new RegExp(`(${findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) => (p.toLowerCase() === findText.toLowerCase()
      ? <mark key={i} style={{ background: 'var(--hl)', color: 'var(--hl-text)' }}>{p}</mark>
      : p));
  };

  /* -------------------------------- chrome -------------------------------- */
  const header = (
    <>
      <button className="hbtn" onClick={goBack} aria-label="Back" disabled={tab.historyIndex === 0 && phase === 'home'}>
        <Icon name="arrowLeft" size={10} />
      </button>
      <button className="hbtn" onClick={isBookmarked ? toggleBookmark : toggleBookmark} aria-label="Bookmark">
        <Icon name="star" size={10} fill={isBookmarked} style={{ color: isBookmarked ? 'var(--hl)' : undefined }} />
      </button>
      <span className="title" style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, opacity: 0.9 }}>
        {tab.url === HOME_PAGE ? 'Owl Web' : tab.title.length > 30 ? `${tab.title.slice(0, 30)}…` : tab.title}
      </span>
      <button className="hbtn" onClick={() => setTabSwitcher(true)} aria-label="Tabs">{tabs.length}▤</button>
      <button className="hbtn" onClick={() => setMenuOpen(menuOpen === 'none' ? 'bookmarks' : 'none')} aria-label="Browser menu">☰</button>
    </>
  );

  return (
    <AppFrame
      title="Owl Web"
      icon="globe"
      actions={header}
      menu={[
        { id: 'tab', label: 'New tab', icon: 'plus', run: newTab },
        { id: 'bookmarks', label: 'Bookmarks', icon: 'star', run: () => setMenuOpen('bookmarks') },
        { id: 'history', label: 'History', icon: 'clock', run: () => setMenuOpen('history') },
        { id: 'find', label: 'Find in page', icon: 'search', run: () => setFindOpen((v) => !v) },
        { id: 'reader', label: 'Reader mode', icon: 'memo', run: () => { if (reader) { setReader(null); setPhase('page'); } else if (phase === 'results') toast('Open a result first'); else void loadReader(tab.url); } },
        { id: 'bookmark-add', label: 'Add bookmark', icon: 'check', run: toggleBookmark },
        { id: 'reload', label: 'Reload page', icon: 'repeat', run: submitAddress },
      ]}
    >
      {/* address bar */}
      <div style={{ display: 'flex', gap: 3, padding: '3px 5px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
        <div style={{ flex: 1 }} onClick={() => useStore.getState().focusField('web-address')}>
          <WebAddress value={address} onChange={setAddress} onSubmit={submitAddress} />
        </div>
        <button className="iconBtn" onClick={submitAddress} aria-label="Go" style={{ width: 18, height: 18 }}>
          <Icon name="arrowRight" size={9} />
        </button>
        <button className="iconBtn" onClick={voiceSearch} aria-label="Voice search" style={{ width: 18, height: 18 }}>
          <Icon name="mic" size={9} />
        </button>
      </div>
      {loading > 0 && <div className="progress" style={{ height: 2 }}><i style={{ width: '60%' }} /></div>}

      {menuOpen !== 'none' && (
        <div style={{ display: 'flex', gap: 3, padding: '3px 5px', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,.25)', flexWrap: 'wrap' }}>
          <button className="chip" onClick={() => setMenuOpen('bookmarks')}>Bookmarks</button>
          <button className="chip" onClick={() => setMenuOpen('history')}>History</button>
          <button className="chip" onClick={() => { setFindOpen((v) => !v); }}>Find</button>
          <button className="chip" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>A+</button>
          <button className="chip" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}>A−</button>
          <button className="chip" onClick={() => setFullscreen((v) => !v)}>{fullscreen ? 'Exit full' : 'Full screen'}</button>
          <button className="chip" onClick={() => void loadReader(tab.url)}>Reader</button>
          <button className="chip" onClick={downloadBlocked}>Downloads</button>
          <button className="chip" onClick={() => setMenuOpen('none')}>✕</button>
        </div>
      )}

      {findOpen && (
        <div style={{ display: 'flex', gap: 4, padding: '3px 5px', borderBottom: '1px solid var(--line)' }}>
          <input
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder="Find in page"
            style={{ flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
            inputMode="none"
          />
          <button className="btn" style={{ fontSize: 9 }} onClick={() => setFindOpen(false)}>Close</button>
        </div>
      )}

      <div className="appBody" ref={pageRef}>
        {/* ------------------------------ home ------------------------------ */}
        {phase === 'home' && (
          <div style={{ padding: 8, display: 'grid', gap: 7 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(150deg,#1f9cf0,#0b4f7d)', display: 'grid', placeItems: 'center' }}>
                <Icon name="globe" size={17} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em' }}>Owl Web</div>
                <div className="tiny">Search without APIs — Wikipedia + DuckDuckGo</div>
              </div>
            </div>
            <div className="fieldLabel">Quick search engines</div>
            <div className="btnRow">
              {SEARCH_ENGINES.map((e) => (
                <button key={e.id} className="btn" onClick={() => { if (e.id === 'wikipedia') void runSearch(address || 'Owl'); else void openUrl(e.url(address || 'owl'), e.name); }}>
                  {e.name}
                </button>
              ))}
            </div>
            <div className="fieldLabel">Bookmarks</div>
            {bookmarks.length === 0 && <div className="tiny">No bookmarks yet — tap the star while viewing a page.</div>}
            {bookmarks.slice(0, 5).map((b) => (
              <button key={b.id} className="rowBtn" onClick={() => void openUrl(b.url, b.title)}>
                <Icon name="star" size={11} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                <span className="meta">{b.url.replace(/^https?:\/\//, '').slice(0, 24)}</span>
              </button>
            ))}
            <div className="fieldLabel">Try these</div>
            <div className="btnRow">
              {['BlackBerry', 'Owl', 'QWERTY', 'Web Audio API', 'IndexedDB', 'Cairo'].map((q) => (
                <button key={q} className="chip" onClick={() => void runSearch(q)}>{q}</button>
              ))}
            </div>
            <div className="card tiny" style={{ lineHeight: 1.5 }}>
              Many sites refuse to be embedded. When that happens Owl Web automatically switches to
              Reader mode through a serverless proxy. Downloads are disabled in this simulator.
            </div>
          </div>
        )}

        {/* ----------------------------- results ----------------------------- */}
        {phase === 'results' && (
          <div>
            <div className="owlSection">Owl Search · {results.length} result{results.length === 1 ? '' : 's'}</div>
            {results.length === 0 && loading > 0 && (
              <div className="empty"><div className="spinner" /><div>Searching Wikipedia + DuckDuckGo…</div></div>
            )}
            {results.length === 0 && loading === 0 && (
              <div className="empty">
                <div className="big">🔍</div>
                <div>No results from the free sources.</div>
                <div className="btnRow" style={{ justifyContent: 'center', marginTop: 4 }}>
                  {SEARCH_ENGINES.map((e) => (
                    <button key={e.id} className="btn" onClick={() => void openUrl(e.url(address), e.name)}>{e.name}</button>
                  ))}
                </div>
              </div>
            )}
            {results.map((r, i) => (
              <button key={`${r.url}-${i}`} className="rowBtn" onClick={() => void openUrl(r.url, r.title)} style={{ alignItems: 'flex-start', paddingTop: 5, paddingBottom: 5 }}>
                {r.image ? (
                  <img src={r.image} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'cover', flex: 'none' }} loading="lazy" />
                ) : (
                  <Icon name={r.source === 'wikipedia' ? 'globe' : 'search'} size={12} style={{ marginTop: 2 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <span style={{ fontWeight: 600, color: 'var(--hl-2)' }}>{highlightMatch(r.title)}</span>
                  <span className="tiny" style={{ lineHeight: 1.35, maxWidth: 330 }}>{highlightMatch(r.snippet.slice(0, 150))}</span>
                  <span className="tiny" style={{ opacity: 0.6, fontSize: 8 }}>{r.domain}</span>
                </div>
              </button>
            ))}
            {images.length > 0 && (
              <>
                <div className="owlSection">Images · Wikimedia Commons</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: '0 5px 6px' }}>
                  {images.map((img) => (
                    <button
                      key={img.page}
                      onClick={() => void openUrl(img.page, img.title)}
                      style={{ padding: 0, border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden', height: 52, background: 'var(--panel-2)', cursor: 'pointer' }}
                      aria-label={img.title}
                    >
                      <img src={img.url} alt={img.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ------------------------------ page ------------------------------ */}
        {phase === 'page' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 4, padding: '2px 5px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
              <span className="tiny" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.url.replace(/^https?:\/\//, '')}
              </span>
              <button className="chip" onClick={() => void loadReader(tab.url)}>Reader</button>
              <button className="chip" onClick={() => { setFrameState('ok'); setPhase('page'); }}>Reload</button>
            </div>
            {frameState === 'blocked' ? (
              <div className="empty">
                <div className="big">🚫</div>
                <div>This site refuses to be embedded.</div>
                <div className="btnRow" style={{ justifyContent: 'center' }}>
                  <button className="btn primary" onClick={() => void loadReader(tab.url)}>Try Reader mode</button>
                  <button className="btn" onClick={() => void loadReader(tab.url)}>Open in Reader</button>
                </div>
              </div>
            ) : (
              <iframe
                key={tab.url}
                src={tab.url}
                title={tab.title}
                sandbox="allow-scripts allow-forms allow-same-origin"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={onFrameLoad}
                onError={() => { setFrameState('blocked'); void loadReader(tab.url); }}
                style={{
                  flex: 1, border: 0, background: '#fff', width: `${100 / zoom}%`, height: `${100 / zoom}%`,
                  transform: `scale(${zoom})`, transformOrigin: 'top left',
                }}
              />
            )}
          </div>
        )}

        {/* ----------------------------- reader ----------------------------- */}
        {phase === 'reader' && reader && (
          <div style={{ padding: '6px 9px', lineHeight: 1.55, fontSize: 11 }}>
            <div style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--hl)' }}>
              Reader mode · {reader.siteName || 'Web'}
            </div>
            <h2 style={{ margin: '3px 0 4px', fontSize: 16, fontFamily: 'var(--font-display)' }}>{highlightMatch(reader.title)}</h2>
            {reader.byline && <div className="tiny" style={{ marginBottom: 5 }}>{reader.byline}</div>}
            <div
              className="readerBody"
              style={{ zoom: zoom }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                const anchor = target.closest('a');
                if (anchor) {
                  e.preventDefault();
                  const href = anchor.getAttribute('href') || '';
                  if (href.startsWith('http')) void openUrl(href, anchor.textContent || href);
                  else if (href.startsWith('#')) { /* in-page anchors are harmless */ }
                  else if (href) void openUrl(`https://${reader.siteName || 'en.wikipedia.org'}/${href.replace(/^\//, '')}`, href);
                  return;
                }
                if (target.tagName === 'IMG') {
                  useStore.getState().focusField(null);
                }
              }}
              dangerouslySetInnerHTML={{ __html: sanitize(reader.content) }}
            />
            <div className="tiny" style={{ marginTop: 8, paddingTop: 5, borderTop: '1px solid var(--line)' }}>
              Sanitised by the OWL reader proxy · scripts removed
              <button className="chip" style={{ marginLeft: 6 }} onClick={() => void openUrl(reader.url, reader.title)}>Open original inside Owl Web</button>
            </div>
          </div>
        )}
      </div>

      {/* tab switcher */}
      {tabSwitcher && (
        <div className="dialogLayer" role="dialog" aria-label="Tabs" onClick={() => setTabSwitcher(false)}>
          <div className="dialog" style={{ maxWidth: 330 }} onClick={(e) => e.stopPropagation()}>
            <h3>Tabs · {tabs.length}/5</h3>
            <div style={{ padding: '0 8px 8px', display: 'grid', gap: 3 }}>
              {tabs.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    className="rowBtn"
                    style={{ border: i === activeTab ? '1px solid var(--hl)' : '1px solid var(--line)', borderRadius: 5 }}
                    onClick={() => { setActiveTab(i); setTabSwitcher(false); setAddress(t.url === HOME_PAGE ? '' : t.url); setPhase(t.url === HOME_PAGE ? 'home' : t.url.startsWith('owl://search') ? 'results' : 'page'); }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{t.title}</span>
                  </button>
                  <button className="iconBtn" onClick={() => closeTab(i)} aria-label="Close tab" style={{ width: 18, height: 18 }}>✕</button>
                </div>
              ))}
              <button className="btn primary" onClick={() => { newTab(); setTabSwitcher(false); }}>New tab</button>
            </div>
          </div>
        </div>
      )}
    </AppFrame>
  );
}

function WebAddress({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const active = useStore((s) => s.activeFieldId);
  React.useEffect(() => {
    let off: (() => void) | undefined;
    void import('../../os/focus').then(({ registerField }) => {
      off = registerField({
        id: 'web-address',
        kind: 'text',
        getValue: () => value,
        setValue: onChange,
        onSubmit,
      });
    });
    return () => off?.();
  });
  return (
    <div className="field" role="searchbox" aria-label="Address or search" style={{ minHeight: 20, fontSize: 10.5 }}>
      {active === 'web-address' && <span className="caret" />}
      {value || <span style={{ opacity: 0.55 }}>Search or type a URL</span>}
    </div>
  );
}

function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link, meta, style, form, input, button').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if (name === 'href' || name === 'src') {
        const v = attr.value.trim().toLowerCase();
        if (v.startsWith('javascript:') || v.startsWith('data:')) el.removeAttribute(attr.name);
      }
    });
    if (el.tagName === 'IMG') {
      el.setAttribute('loading', 'lazy');
      (el as HTMLElement).style.maxWidth = '100%';
      (el as HTMLElement).style.borderRadius = '4px';
      (el as HTMLElement).style.margin = '4px 0';
    }
  });
  return doc.body.innerHTML;
}
