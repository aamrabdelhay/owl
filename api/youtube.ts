/**
 * Anonymous YouTube search for OWL via public Invidious instances.
 * Official YouTube embed remains the player; no YouTube Data API key or login.
 */
export const config = { maxDuration: 12 };
const INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com',
  'https://invidious.tiekoetter.com',
];
function send(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', status === 200 ? 'public, max-age=90' : 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('access-control-allow-origin', '*');
  res.end(JSON.stringify(body));
}
export default async function handler(req: any, res: any) {
  const q = String(req.query?.q || new URL(req.url || '/', 'https://owl.invalid').searchParams.get('q') || '').trim().slice(0, 160);
  if (!q) return send(res, 400, { error: 'Enter a search term.' });
  if (q.length < 2) return send(res, 400, { error: 'Search needs at least 2 characters.' });
  for (const host of INSTANCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const url = new URL('/api/v1/search', host);
      url.searchParams.set('q', q);
      url.searchParams.set('type', 'video');
      url.searchParams.set('region', 'EG');
      const upstream = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'OWLPhone/1.0' } });
      if (!upstream.ok) continue;
      const data: any = await upstream.json();
      if (!Array.isArray(data)) continue;
      const items = data.filter((v: any) => v?.type === 'video' && /^[\w-]{11}$/.test(String(v.videoId || ''))).slice(0, 18).map((v: any) => ({
        id: String(v.videoId),
        title: String(v.title || 'YouTube video').slice(0, 240),
        channel: String(v.author || 'YouTube').slice(0, 120),
        description: String(v.description || '').slice(0, 500),
        thumbnail: String(v.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || v.videoThumbnails?.[0]?.url || ''),
        publishedAt: v.published ? new Date(Number(v.published) * 1000).toISOString() : '',
      }));
      if (items.length) return send(res, 200, { items, provider: 'Invidious' });
    } catch { /* try next community instance */ }
    finally { clearTimeout(timer); }
  }
  return send(res, 502, { error: 'Free YouTube search services are temporarily unavailable. Try again shortly or paste a video link.' });
}
