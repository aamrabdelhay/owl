import React, { useState } from 'react';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { useStore } from '../../os/store';

interface VideoItem {
  id: string;
  title: string;
  channel: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  provider?: string;
  views?: number;
}

type Tab = 'search' | 'searchHistory' | 'watchHistory';
type PlayerMode = 'youtube' | 'privacy';

const SEARCH_KEY = 'owl:youtube:search-history:v1';
const WATCH_KEY = 'owl:youtube:watch-history:v1';

// These are the public instances currently listed by the Invidious project.
// They are community-operated services, so OWL rotates through them if one is down.
const SEARCH_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com',
  'https://invidious.tiekoetter.com',
  'https://invidious.f5.si',
];

function readList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function videoIdFrom(input: string): string | null {
  const raw = input.trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else id = url.pathname.split('/').filter(Boolean).slice(-1)[0] || '';
    }
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function searchPublicYouTube(query: string): Promise<VideoItem[]> {
  let lastError = 'No public search service is available right now.';
  for (const instance of SEARCH_INSTANCES) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4200);
    try {
      const url = new URL(`${instance}/api/v1/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'video');
      url.searchParams.set('page', '1');
      url.searchParams.set('region', 'EG');
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        mode: 'cors',
        credentials: 'omit',
      });
      if (!response.ok) throw new Error(`Search server returned ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Search server returned an unexpected response.');
      const videos = data.filter((item: any) => item?.type === 'video' && item?.videoId).slice(0, 24);
      if (!videos.length) return [];
      return videos.map((item: any) => ({
        id: String(item.videoId),
        title: String(item.title || 'Untitled video'),
        channel: String(item.author || 'YouTube'),
        description: String(item.description || ''),
        thumbnail: String(item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url
          || item.videoThumbnails?.[0]?.url
          || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`),
        publishedAt: item.published ? new Date(Number(item.published) * 1000).toISOString() : '',
        provider: instance,
        views: Number(item.viewCount || 0),
      }));
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Search failed.';
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw new Error(`Free YouTube search is temporarily unavailable. ${lastError} You do not need an API key; try again shortly or paste a direct video link.`);
}

export default function YouTubeApp() {
  const openApp = useStore((s) => s.openApp);
  const toast = useStore((s) => s.toast);
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [results, setResults] = useState<VideoItem[]>([]);
  const [selected, setSelected] = useState<VideoItem | null>(null);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('youtube');
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readList(SEARCH_KEY, []));
  const [watchHistory, setWatchHistory] = useState<VideoItem[]>(() => readList(WATCH_KEY, []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const saveSearchHistory = (next: string[]) => {
    setSearchHistory(next);
    try { localStorage.setItem(SEARCH_KEY, JSON.stringify(next)); } catch { /* local storage may be full */ }
  };

  const saveWatchHistory = (video: VideoItem) => {
    const next = [video, ...watchHistory.filter((v) => v.id !== video.id)].slice(0, 80);
    setWatchHistory(next);
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)); } catch { /* local storage may be full */ }
  };

  const play = (video: VideoItem) => {
    setSelected(video);
    setPlayerMode('youtube');
    setTab('search');
    saveWatchHistory(video);
  };

  const playDirect = () => {
    const id = videoIdFrom(directUrl);
    if (!id) { toast('Paste a valid YouTube video link or 11-character video ID'); return; }
    play({
      id,
      title: 'YouTube video',
      channel: 'YouTube',
      description: 'Opened from a direct video link.',
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publishedAt: '',
    });
  };

  const search = async (raw = query) => {
    const q = raw.trim();
    if (!q || loading) return;
    setLoading(true);
    setError('');
    setSelected(null);
    setTab('search');
    setQuery(q);
    saveSearchHistory([q, ...searchHistory.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 40));
    try {
      const items = await searchPublicYouTube(q);
      setResults(items);
      if (!items.length) setError('No videos found for this search.');
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Could not search YouTube right now.');
    } finally {
      setLoading(false);
    }
  };

  const playerSrc = selected
    ? playerMode === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${selected.id}?playsinline=1&rel=0&modestbranding=1`
      : `${selected.provider || SEARCH_INSTANCES[0]}/embed/${selected.id}`
    : '';

  const title = selected?.title || 'YouTube';
  return (
    <AppFrame
      title={title.length > 24 ? `${title.slice(0, 24)}…` : title}
      icon="video"
      actions={selected ? <button className="hbtn" onClick={() => setSelected(null)}>Back</button> : undefined}
      menu={[
        { id: 'search', label: 'Search videos', icon: 'search', run: () => { setSelected(null); setTab('search'); } },
        { id: 'search-history', label: 'Search history', icon: 'clock', run: () => { setSelected(null); setTab('searchHistory'); } },
        { id: 'watch-history', label: 'Watch history', icon: 'video', run: () => { setSelected(null); setTab('watchHistory'); } },
      ]}
    >
      {selected ? (
        <div className="appBody" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ width: '100%', minHeight: 180, aspectRatio: '16 / 9', background: '#000', borderRadius: 6, overflow: 'hidden' }}>
            <iframe
              key={`${selected.id}-${playerMode}`}
              src={playerSrc}
              title={selected.title}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ display: 'block', width: '100%', height: '100%', minHeight: 180, border: 0 }}
            />
          </div>
          <div className="btnRow">
            <button className={`chip ${playerMode === 'youtube' ? 'on' : ''}`} onClick={() => setPlayerMode('youtube')}>YouTube player</button>
            <button className={`chip ${playerMode === 'privacy' ? 'on' : ''}`} onClick={() => setPlayerMode('privacy')}>Privacy player</button>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{selected.title}</div>
          <div className="tiny">{selected.channel}{selected.publishedAt ? ` · ${new Date(selected.publishedAt).toLocaleDateString()}` : ''}{selected.views ? ` · ${selected.views.toLocaleString()} views` : ''}</div>
          <div className="tiny" style={{ maxHeight: 44, overflow: 'auto', lineHeight: 1.4 }}>{selected.description}</div>
          <div className="btnRow">
            <button className="btn" onClick={() => openApp('web', { url: `https://www.youtube.com/watch?v=${selected.id}` })}>
              <Icon name="globe" size={10} /> Open inside Owl Web
            </button>
            <button className="btn" onClick={() => { setSelected(null); setTab('search'); }}>Back to results</button>
          </div>
          <div className="tiny">No YouTube sign-in or API key is used. Public videos can play in the embedded player; age-restricted, region-blocked or embedding-disabled videos may still be refused by their owner.</div>
        </div>
      ) : (
        <>
          <div className="owlTabBar">
            <button className={`owlTab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>Search</button>
            <button className={`owlTab ${tab === 'searchHistory' ? 'active' : ''}`} onClick={() => setTab('searchHistory')}>Search history</button>
            <button className={`owlTab ${tab === 'watchHistory' ? 'active' : ''}`} onClick={() => setTab('watchHistory')}>Watch history</button>
          </div>
          {tab === 'search' && (
            <>
              <div style={{ padding: 6, display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ flex: 1 }}><Field value={query} onChange={setQuery} placeholder="Search YouTube videos…" onSubmit={() => void search()} /></div>
                  <button className="btn primary" onClick={() => void search()} disabled={loading || !query.trim()}>
                    {loading ? '…' : <Icon name="search" size={11} />}
                  </button>
                </div>
                <div className="fieldLabel">Play a link directly (no API key needed)</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ flex: 1 }}><Field value={directUrl} onChange={setDirectUrl} placeholder="Paste YouTube link or video ID" onSubmit={playDirect} /></div>
                  <button className="btn" onClick={playDirect}>Play</button>
                </div>
                <div className="tiny">Search is key-free. OWL tries several public Invidious search servers automatically; videos play using the YouTube or privacy player.</div>
                {error && <div className="tiny" style={{ color: 'var(--red)' }}>{error}</div>}
              </div>
              <div className="appBody">
                {loading && <div className="empty"><div className="spinner" /><div>Searching YouTube…</div><div className="tiny">Trying available public search servers</div></div>}
                {!loading && results.map((video) => (
                  <button key={video.id} className="rowBtn" onClick={() => play(video)} style={{ alignItems: 'flex-start', gap: 6, padding: 5 }}>
                    {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" style={{ width: 92, height: 52, objectFit: 'cover', borderRadius: 4, flex: 'none' }} />}
                    <div style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
                      <span style={{ fontSize: 10, lineHeight: 1.25, fontWeight: 600 }}>{video.title}</span>
                      <span className="tiny">{video.channel}</span>
                      <span className="tiny" style={{ opacity: .7 }}>{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : ''}</span>
                    </div>
                  </button>
                ))}
                {!loading && !error && !results.length && <div className="empty"><div className="big">▶</div><div>Search YouTube or paste a video link.</div></div>}
              </div>
            </>
          )}
          {tab === 'searchHistory' && (
            <div className="appBody">
              {searchHistory.length === 0 && <div className="empty"><div>No searches yet.</div></div>}
              {searchHistory.map((term) => (
                <button className="rowBtn" key={term} onClick={() => { setQuery(term); void search(term); }}>
                  <Icon name="clock" size={12} /><span>{term}</span><span className="meta">Search</span>
                </button>
              ))}
              {!!searchHistory.length && <div style={{ padding: 6 }}><button className="btn" onClick={() => saveSearchHistory([])}>Clear search history</button></div>}
            </div>
          )}
          {tab === 'watchHistory' && (
            <div className="appBody">
              {watchHistory.length === 0 && <div className="empty"><div>No watched videos yet.</div></div>}
              {watchHistory.map((video) => (
                <button className="rowBtn" key={video.id} onClick={() => play(video)} style={{ alignItems: 'flex-start', gap: 6, padding: 5 }}>
                  {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" style={{ width: 76, height: 43, objectFit: 'cover', borderRadius: 4 }} />}
                  <div style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
                    <span style={{ fontSize: 10, fontWeight: 600 }}>{video.title}</span>
                    <span className="tiny">{video.channel}</span>
                  </div>
                </button>
              ))}
              {!!watchHistory.length && <div style={{ padding: 6 }}><button className="btn" onClick={() => { setWatchHistory([]); localStorage.removeItem(WATCH_KEY); }}>Clear watch history</button></div>}
            </div>
          )}
        </>
      )}
    </AppFrame>
  );
}
