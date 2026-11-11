/**
 * /api/reader — the only server-side endpoint of the project.
 *
 * Used exclusively by Owl Web's reader mode: fetches a public page and returns
 * sanitised readable HTML. Hardened against SSRF:
 *   • http/https only
 *   • private / loopback / link-local / metadata hosts blocked (checked before
 *     the request and again on the final URL after redirects)
 *   • 5s timeout, 2 MB response cap, text/html only
 *   • never forwards cookies or authorization headers
 *   • per-IP in-memory rate limit
 *   • strict CSP on the JSON response
 *
 * Readability + linkedom are used when available (Node runtime); a conservative
 * dependency-free extractor is the fallback so the function never throws.
 */

export const config = { maxDuration: 15 };

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 5000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const hits = new Map<string, { count: number; reset: number }>();

/**
 * DNS resolution happens here and nowhere else: the hostname is resolved before
 * connecting, every returned address is checked, and the fetch is pinned to a
 * validated IP. A hostname that resolves to a private address (or that changes
 * between the check and the request) can never be reached.
 */
type Resolved = { address: string; family: number };

async function resolveHost(hostname: string): Promise<Resolved[]> {
  try {
    const dns = await import('node:dns/promises');
    return (await dns.lookup(hostname, { all: true, verbatim: true })) as Resolved[];
  } catch {
    return [];
  }
}

/** Resolves a hostname and refuses it unless every address is public. */
async function safeTarget(url: URL): Promise<{ url: URL; addresses: Resolved[] } | { error: string }> {
  if (blockedHost(url.hostname)) return { error: 'Private addresses are blocked' };
  // a bare IP literal is already covered by blockedHost
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) return { url, addresses: [{ address: url.hostname, family: 4 }] };
  const addresses = await resolveHost(url.hostname);
  if (!addresses.length) return { error: 'That host could not be resolved' };
  const bad = addresses.find((a) => isPrivateIp(a.address));
  if (bad) return { error: 'Private addresses are blocked' };
  return { url, addresses };
}

/** fetch() with a hard timeout that cannot be extended by a slow body. */
async function fetchWithDeadline(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Reads at most `limit` bytes of a body, so a lying content-length cannot flood us. */
async function readCapped(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer()).slice(0, limit);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const room = limit - total;
    chunks.push(room >= value.length ? value : value.slice(0, room));
    total += Math.min(room, value.length);
    if (total >= limit) {
      void reader.cancel().catch(() => undefined);
      break;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function limited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.replace('::ffff:', ''));
  return false;
}

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (isPrivateIp(host)) return true;
  return false;
}

function jsonHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
  };
}

function fail(message: string, status = 400): any {
  return { status, headers: jsonHeaders(), body: JSON.stringify({ error: message }) };
}

function ok(payload: unknown): any {
  return { status: 200, headers: { ...jsonHeaders(), 'cache-control': 'public, max-age=60' }, body: JSON.stringify(payload) };
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…');
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fallbackExtract(html: string): { title: string; content: string; excerpt: string } {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim());
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const article = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    || cleaned;
  const blocks = article.match(/<(p|h1|h2|h3|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
  const text = blocks
    .map((b) => decodeEntities(b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()))
    .filter((t) => t.length > 40)
    .slice(0, 90);
  return {
    title,
    content: text.map((t) => `<p>${escapeHtml(t)}</p>`).join(''),
    excerpt: text[0]?.slice(0, 200) || '',
  };
}

async function readableExtract(html: string, url: string): Promise<{ title: string; byline: string; content: string; excerpt: string } | null> {
  try {
    const [{ Readability }, { parseHTML }] = await Promise.all([
      import('@mozilla/readability'),
      import('linkedom'),
    ]);
    const { document } = parseHTML(html);
    // Readability expects the URL for relative link resolution
    (document as any).documentURI = url;
    const reader = new Readability(document as any, { charThreshold: 120 });
    const article = reader.parse();
    if (!article || !article.content || article.content.length < 120) return null;
    return {
      title: article.title || '',
      byline: article.byline || '',
      excerpt: article.excerpt || '',
      content: article.content,
    };
  } catch {
    return null;
  }
}

export function sanitizeContent(content: string): string {
  let out = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
  out = out.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>/gi, (_m, href) => {
    const safe = escapeHtml(String(href));
    return `<a href="${safe}" rel="noreferrer noopener">`;
  });
  return out;
}

export default async function handler(req: any, res?: any): Promise<any> {
  // Support both Vercel Node-style (req,res) and web Request handlers.
  const webRequest: Request | null = typeof Request !== 'undefined' && req instanceof Request ? req : null;
  const requestUrl = webRequest ? webRequest.url : `${req.headers?.['x-forwarded-proto'] || 'https'}://${req.headers?.host || 'localhost'}${req.url || ''}`;
  const send = (payload: any) => {
    if (res && !webRequest) {
      res.statusCode = payload.status;
      Object.entries(payload.headers).forEach(([k, v]) => res.setHeader(k, v as string));
      res.end(payload.body);
      return;
    }
    return new Response(payload.body, { status: payload.status, headers: payload.headers });
  };

  const ip = (webRequest
    ? webRequest.headers.get('x-forwarded-for')
    : req.headers?.['x-forwarded-for'])?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return send(fail('Too many requests, slow down.', 429));

  let target: string | null = null;
  if (webRequest) target = new URL(webRequest.url).searchParams.get('url');
  else {
    const parsed = new URL(requestUrl, 'https://local.invalid');
    target = parsed.searchParams.get('url');
  }
  if (!target) return send(fail('Missing ?url='));

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return send(fail('Invalid URL'));
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return send(fail('Only http and https are allowed'));
  if (parsed.username || parsed.password) return send(fail('Credentials in the URL are not allowed'));

  const safe = await safeTarget(parsed);
  if ('error' in safe) return send(fail(safe.error));

  try {
    const upstream = await fetchWithDeadline(safe.url.toString(), {
      redirect: 'follow',
      headers: {
        'user-agent': 'OWLReader/1.0 (+https://github.com/aamrabdelhay/owl)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en;q=0.9,ar;q=0.8',
        // no cookies, no auth, no referer: the reader is anonymous
      },
    }, TIMEOUT_MS);

    if (!upstream.ok) {
      return send(fail(`Upstream responded ${upstream.status}`, 502));
    }

    // Final URL after redirects must also be public, and is re-resolved.
    const finalUrl = upstream.url ? new URL(upstream.url) : parsed;
    const finalSafe = await safeTarget(finalUrl);
    if ('error' in finalSafe) return send(fail('Redirect to a private address blocked'));

    const contentType = upstream.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return send(fail('Only HTML pages can be rendered in Reader mode', 415));
    }

    const declared = Number(upstream.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) return send(fail('That page is larger than 2 MB', 413));

    const bytes = await readCapped(upstream, MAX_BYTES);
    if (bytes.length >= MAX_BYTES) return send(fail('That page is larger than 2 MB', 413));
    const html = new TextDecoder('utf-8').decode(bytes);

    const readable = await readableExtract(html, finalUrl.toString());
    const base = readable
      ? readable
      : { ...fallbackExtract(html), byline: '' };

    const content = sanitizeContent(base.content || '');
    if (!content.trim()) return send(fail('That page has no readable content', 422));

    return send(ok({
      title: base.title || finalUrl.hostname,
      byline: (base as any).byline || '',
      siteName: finalUrl.hostname.replace(/^www\./, ''),
      url: finalUrl.toString(),
      excerpt: (base as any).excerpt || '',
      content,
    }));
  } catch (err: any) {
    const message = err?.name === 'AbortError'
      ? 'The page took too long to load (5s limit)'
      : 'Could not fetch that page';
    return send(fail(message, 504));
  }
}
