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
  source?: string;
}

type Tab = 'search' | 'searchHistory' | 'watchHistory';

const SEARCH_KEY = 'owl:youtube:search-history:v1';
const WATCH_KEY = 'owl:youtube:watch-history:v1';

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

const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com',
  'https://invidious.tiekoetter.com',
  'https://inv.nadeko.net',
];

async function searchWithoutKey(query: string): Promise<VideoItem[]> {
  const results = await Promise.all(INVIDIOUS_INSTANCES.map(async (instance) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5500);
    try {
      const url = `${instance}/api/v1/search?type=video&page=1&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`Search provider returned ${response.status}`);
      const data = await response.json();
      const videos: VideoItem[] = (Array.isArray(data) ? data : [])
        .filter((item: any) => item?.type === 'video' && /^[\\w-]{11}$/.test(String(item.videoId || '')))
        .slice(0, 20)
        .map((item: any) => ({
          id: String(item.videoId),
          title: String(item.title || 'YouTube video'),
          channel: String(item.author || 'YouTube'),
          description: String(item.description || ''),
          thumbnail: String(item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`),
          publishedAt: item.published ? new Date(Number(item.published) * 1000).toISOString() : String(item.publishedText || ''),
          source: instance,
        }));
      return videos;
    } finally {
      window.clearTimeout(timeout);
    }
  }));
  const found = results.find((items) => items.length > 0);
  if (!found) throw new Error('The public YouTube search mirrors are temporarily unavailable. Try again in a moment, or paste a video link.');
  return found;
}

export default function YouTubeApp() {
  const toast = useStore((s) => s.toast);
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [results, setResults] = useState<VideoItem[]>([]);
  const [selected, setSelected] = useState<VideoItem | null>(null);
  const [proxyPlayer, setProxyPlayer] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readList(SEARCH_KEY, []));
  const [watchHistory, setWatchHistory] = useState<VideoItem[]>(() => readList(WATCH_KEY, []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const saveSearchHistory = (next: string[]) => {
    setSearchHistory(next);
    try { localStorage.setItem(SEARCH_KEY, JSON.stringify(next)); } catch { /* storage may be full */ }
  };

  const saveWatchHistory = (video: VideoItem) => {
    const next = [video, ...watchHistory.filter((v) => v.id !== video.id)].slice(0, 60);
    setWatchHistory(next);
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)); } catch { /* storage may be full */ }
  };

  const play = (video: VideoItem) => {
    setSelected(video);
    setProxyPlayer(false);
    setTab('search');
    saveWatchHistory(video);
  };

  const playDirect = () => {
    const id = videoIdFrom(directUrl);
    if (!id) { toast('Paste a valid YouTube video link or 11-character video ID'); return; }
    const video: VideoItem = {
      id,
      title: 'YouTube video',
      channel: 'YouTube',
      description: 'Opened from a direct link',
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publishedAt: new Date().toISOString(),
    };
    play(video);
  };

  const search = async (raw = query) => {
    const q = raw.trim();
    if (!q || loading) return;
    setLoading(true);
    setError('');
    setSelected(null);
    setTab('search');
    saveSearchHistory([q, ...searchHistory.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 30));
    try {
      const items = await searchWithoutKey(q);
      setResults(items);
      if (!items.length) setError('No embeddable videos were found for that search.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search YouTube.');
    } finally {
      setLoading(false);
    }
  };

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
          <div style={{ width: '100%', minHeight: 200, aspectRatio: '16 / 9', background: '#000', borderRadius: 6, overflow: 'hidden' }}>
            <iframe
              key={`${selected.id}-${proxyPlayer ? 'proxy' : 'youtube'}`}
              src={proxyPlayer && selected.source
                ? `${selected.source}/embed/${selected.id}`
                : `https://www.youtube-nocookie.com/embed/${selected.id}?playsinline=1&rel=0&modestbranding=1`}
              title={selected.title}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ display: 'block', width: '100%', height: '100%', minHeight: 200, border: 0 }}
            />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{selected.title}</div>
          <div className="tiny">{selected.channel}{selected.publishedAt ? ` · ${new Date(selected.publishedAt).toLocaleDateString()}` : ''}</div>
          <div className="tiny" style={{ maxHeight: 44, overflow: 'auto', lineHeight: 1.4 }}>{selected.description}</div>
          <div className="btnRow">

            <button className="btn" onClick={() => {
              if (!selected.source) { toast('This direct link has no available privacy mirror.'); return; }
              setProxyPlayer((value) => !value);
            }} disabled={!selected.source}>
              {proxyPlayer ? 'Use YouTube player' : 'Try privacy player'}
            </button>
            <button className="btn" onClick={() => { setSelected(null); setTab('search'); }}>Back to results</button>
          </div>
          <div className="tiny">No sign-in or YouTube API key. Public videos play in the built-in player; some age-restricted, region-blocked or embedding-disabled videos may still be refused by YouTube.</div>
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
                <div className="fieldLabel">Or play a link without setting up search</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ flex: 1 }}><Field value={directUrl} onChange={setDirectUrl} placeholder="Paste YouTube link or video ID" onSubmit={playDirect} /></div>
                  <button className="btn" onClick={playDirect}>Play</button>
                </div>
                <div className="tiny">Anonymous search · no Google account · no YouTube API key</div>
                {error && <div className="tiny" style={{ color: 'var(--red)' }}>{error}</div>}
              </div>
              <div className="appBody">
                {loading && <div className="empty"><div className="spinner" /><div>Searching YouTube…</div></div>}
                {!loading && results.map((video) => (
                  <button key={video.id} className="rowBtn" onClick={() => play(video)} style={{ alignItems: 'flex-start', gap: 6, padding: 5 }}>
                    {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" style={{ width: 92, height: 52, objectFit: 'cover', borderRadius: 4, flex: 'none' }} />}
                    <div style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
                      <span style={{ fontSize: 10, lineHeight: 1.25, fontWeight: 600 }}>{video.title}</span>
                      <span className="tiny">{video.channel}</span>
                      <span className="tiny" style={{ opacity: .7 }}>{video.publishedAt ? (/^\\d{4}-/.test(video.publishedAt) ? new Date(video.publishedAt).toLocaleDateString() : video.publishedAt) : ''}</span>
                    </div>
                  </button>
                ))}
                {!loading && !error && !results.length && <div className="empty"><div className="big">▶</div><div>Search for a video or paste a YouTube link.</div></div>}
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
