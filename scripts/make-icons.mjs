/**
 * Renders the OWL logo SVGs into the PNG icons the web manifest needs.
 * Run with `npm run icons` after changing public/owl.svg.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

for (const size of [192, 512]) {
  const svg = readFileSync(new URL(`../public/owl-icon-${size}.svg`, import.meta.url));
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(`../public/pwa-${size}.png`, import.meta.url), png);
  console.log(`public/pwa-${size}.png (${png.length} bytes)`);
}
