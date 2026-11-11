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

export default function YouTubeApp() {
  const settings = useStore((s) => s.settings);
  const toast = useStore((s) => s.toast);
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [results, setResults] = useState<VideoItem[]>([]);
  const [selected, setSelected] = useState<VideoItem | null>(null);
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
    if (!settings.youtubeApiKey) {
      setError('Add a YouTube Data API v3 key in Settings → AI & online services, or paste a video link above.');
      setTab('search');
      return;
    }
    setLoading(true);
    setError('');
    setSelected(null);
    setTab('search');
    saveSearchHistory([q, ...searchHistory.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 30));
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('videoEmbeddable', 'true');
      url.searchParams.set('maxResults', '18');
      url.searchParams.set('q', q);
      url.searchParams.set('key', settings.youtubeApiKey);
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || `YouTube search failed (${response.status})`);
      const items: VideoItem[] = (data.items || []).flatMap((item: any) => {
        const id = item?.id?.videoId;
        const snippet = item?.snippet;
        if (!id || !snippet) return [];
        return [{
          id,
          title: String(snippet.title || 'Untitled video'),
          channel: String(snippet.channelTitle || 'YouTube'),
          description: String(snippet.description || ''),
          thumbnail: String(snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || ''),
          publishedAt: String(snippet.publishedAt || ''),
        }];
      });
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
              key={selected.id}
              src={`https://www.youtube-nocookie.com/embed/${selected.id}?playsinline=1&rel=0&modestbranding=1`}
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
            <button className="btn primary" onClick={() => window.open(`https://www.youtube.com/watch?v=${selected.id}`, '_blank', 'noopener,noreferrer')}>
              <Icon name="external-link" size={10} /> Open on YouTube
            </button>
            <button className="btn" onClick={() => { setSelected(null); setTab('search'); }}>Back to results</button>
          </div>
          <div className="tiny">Public embedded playback. Videos blocked by their owner, age restrictions, or YouTube's regional rules may need to open on YouTube.</div>
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
                {!settings.youtubeApiKey && <div className="tiny">In-app search needs a YouTube Data API v3 key. Playback from a public video link does not need a key or sign-in.</div>}
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
                      <span className="tiny" style={{ opacity: .7 }}>{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : ''}</span>
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
