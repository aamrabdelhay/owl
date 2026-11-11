import handler, { fallbackExtract, sanitizeContent } from '/home/user/owl/api/reader.ts';

const makeReq = (url) => ({ url: '/api/reader?url=' + encodeURIComponent(url), headers: { host: 'localhost', 'x-forwarded-for': '203.0.113.9' } });
const makeRes = () => {
  const out = { statusCode: 0, headers: {}, body: '' };
  out.setHeader = (k, v) => { out.headers[k.toLowerCase()] = v; };
  out.end = (b) => { out.body = b; };
  return out;
};
const call = async (url) => {
  const res = makeRes();
  await handler(makeReq(url), res);
  return res;
};

for (const bad of ['http://127.0.0.1:8080/x', 'http://localhost/', 'file:///etc/passwd', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.5/', 'http://user:pass@example.com/']) {
  const r = await call(bad);
  console.log(String(r.statusCode).padEnd(4), bad.padEnd(46), r.body.slice(0, 70));
}
const good = await call('https://example.com/');
console.log(String(good.statusCode).padEnd(4), 'https://example.com/'.padEnd(46), good.body.slice(0, 110));
console.log('headers:', good.headers['content-security-policy'], '|', good.headers['x-content-type-options'], '|', good.headers['referrer-policy']);

// extraction + sanitising work without any network
const html = `<html><head><title>Owl &amp; the Night</title></head><body>
  <article><h1>Night flight</h1>
  <p>Owls fly almost silently because their flight feathers have a comb-like leading edge that breaks up turbulence.</p>
  <p>Their eyes are fixed in their sockets, so they turn their heads instead — up to 270 degrees.</p>
  <script>alert('xss')</script><a href="javascript:alert(1)" onclick="alert(2)">bad link</a>
  </article></body></html>`;
const extracted = fallbackExtract(html);
const clean = sanitizeContent(extracted.content);
const checks = [
  ['title decoded', extracted.title === 'Owl & the Night'],
  ['paragraphs found', /flight feathers/.test(extracted.content)],
  ['script removed', !/alert\('xss'\)/.test(clean)],
  ['inline handler removed', !/onclick/i.test(clean)],
  ['javascript: href removed', !/javascript:/i.test(clean)],
];
for (const [name, ok] of checks) console.log(ok ? 'PASS' : 'FAIL', name);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
