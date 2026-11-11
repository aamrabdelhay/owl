/**
 * Browser-facing network helpers for Owl Web.
 * All requests are plain fetch() calls to free, CORS-enabled public APIs —
 * no keys, no tracking. The only project-owned endpoint is /api/reader, the
 * serverless reader-mode proxy.
 */

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  domain: string;
  image?: string;
  source: 'wikipedia' | 'ddg' | 'web';
}

export interface ReaderResult {
  title: string;
  byline: string;
  content: string;
  siteName: string;
  url: string;
  excerpt: string;
}

const WIKI_REST = 'https://en.wikipedia.org/w/api.php';
const DDG = 'https://api.duckduckgo.com/';

async function fetchJson<T>(url: string, timeoutMs = 7000): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(raw);
  if (!looksLikeUrl) return null;
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProto);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Combined Owl Search: Wikipedia search + summaries + DuckDuckGo instant answers. */
export async function owlSearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const wikiUrl = `${WIKI_REST}?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=6&prop=extracts|pageimages&exintro=1&explaintext=1&exsentences=2&piprop=thumbnail&pithumbsize=160`;
  const ddgUrl = `${DDG}?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1&t=owlphone`;

  const [wiki, ddg] = await Promise.all([
    fetchJson<any>(wikiUrl),
    fetchJson<any>(ddgUrl),
  ]);

  if (signal?.aborted) return [];
  const results: SearchResult[] = [];

  if (ddg && (ddg.AbstractText || (ddg.RelatedTopics && ddg.RelatedTopics.length))) {
    if (ddg.AbstractText) {
      results.push({
        title: ddg.Heading || q,
        snippet: ddg.AbstractText,
        url: ddg.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
        domain: ddg.AbstractSource ? `duckduckgo.com · ${ddg.AbstractSource}` : 'duckduckgo.com',
        image: ddg.Image ? `https://duckduckgo.com${ddg.Image}` : undefined,
        source: 'ddg',
      });
    }
    (ddg.RelatedTopics || []).slice(0, 4).forEach((topic: any) => {
      if (!topic.FirstURL || !topic.Text) return;
      results.push({
        title: topic.Text.split(' - ')[0].slice(0, 90),
        snippet: topic.Text,
        url: topic.FirstURL,
        domain: domainOf(topic.FirstURL),
        source: 'ddg',
      });
    });
  }

  const pages = wiki?.query?.pages ? Object.values(wiki.query.pages as Record<string, any>) : [];
  pages.forEach((page: any) => {
    if (!page.title) return;
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, '_'))}`;
    results.push({
      title: page.title,
      snippet: (page.extract || '').split('\n')[0].slice(0, 240),
      url,
      domain: 'en.wikipedia.org',
      image: page.thumbnail?.source,
      source: 'wikipedia',
    });
  });

  // de-duplicate by url
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

/** Wikimedia Commons image results for the search page. */
export async function commonsImages(query: string): Promise<{ title: string; url: string; page: string }[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=320`;
  const data = await fetchJson<any>(url);
  const pages = data?.query?.pages ? Object.values(data.query.pages as Record<string, any>) : [];
  return pages.map((p: any) => ({
    title: p.title?.replace(/^File:/, '') || 'Image',
    url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url || '',
    page: p.imageinfo?.[0]?.descriptionurl || '',
  })).filter((i) => i.url);
}

/** Reader-mode fetch through the project's serverless function. */
export async function fetchReader(url: string): Promise<ReaderResult | null> {
  try {
    const res = await fetch(`/api/reader?url=${encodeURIComponent(url)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.content) return null;
    return data as ReaderResult;
  } catch {
    return null;
  }
}

/** Wikipedia page rendered directly in reader mode (always CORS-safe). */
export async function wikipediaReader(title: string): Promise<ReaderResult | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'text/html' } });
    if (!res.ok) return null;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, .mw-editsection, sup.reference, table.navbox, .navbox, .metadata, .hatnote').forEach((el) => el.remove());
    doc.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('./')) a.setAttribute('href', `https://en.wikipedia.org/wiki/${href.slice(2)}`);
      else if (href.startsWith('/wiki/')) a.setAttribute('href', `https://en.wikipedia.org${href}`);
      a.setAttribute('data-external', '1');
    });
    doc.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('//')) img.setAttribute('src', `https:${src}`);
      else if (src.startsWith('/')) img.setAttribute('src', `https://en.wikipedia.org${src}`);
    });
    return {
      title: title.replace(/_/g, ' '),
      byline: 'Wikipedia',
      siteName: 'Wikipedia',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      excerpt: '',
      content: doc.body.innerHTML,
    };
  } catch {
    return null;
  }
}

export const SEARCH_ENGINES = [
  { id: 'google', name: 'Google', url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { id: 'bing', name: 'Bing', url: (q: string) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { id: 'ddg', name: 'DuckDuckGo', url: (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { id: 'wikipedia', name: 'Wikipedia', url: (q: string) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
];
