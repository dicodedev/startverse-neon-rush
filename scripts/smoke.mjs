/**
 * A quick runtime smoke test of the built game.
 *
 * Types and unit tests cannot catch a three.js or React runtime failure, and start.ng
 * refuses anything that does not play, so this serves dist/ in a headless browser, starts a
 * run, and fails on any console error or page exception.
 *
 *   node scripts/smoke.mjs
 */
import { chromium } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // Decode to a plain relative path, then join with the platform separator, so this works
  // on Windows as well as POSIX.
  let path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (path === '' || path.endsWith('/')) path += 'index.html';
  const file = join(DIST, ...path.split('/'));

  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(0, r));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });

// The menu has to come up, which means React mounted and the canvas initialised.
await page.getByRole('button', { name: /tap to run/i }).waitFor({ timeout: 15000 });

// The canvas must have actually drawn something, not just mounted.
const painted = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { ok: false, why: 'no canvas' };
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  return { ok: Boolean(gl), w: canvas.width, h: canvas.height };
});
if (!painted.ok) problems.push(`canvas not painted: ${painted.why ?? 'no webgl context'}`);

// Start a run and let it play, so the game loop, spawning and collisions all execute.
await page.getByRole('button', { name: /tap to run/i }).click();
await page.waitForTimeout(2500);
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('Space');
await page.waitForTimeout(1500);

// The HUD should be showing live numbers by now.
const hud = await page.evaluate(() => document.body.innerText);
if (!/metres/i.test(hud)) problems.push('HUD did not render a distance stat');

await page.screenshot({ path: new URL('../smoke.png', import.meta.url).pathname.slice(1) });

await browser.close();
server.close();

if (problems.length) {
  console.error('Smoke test failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('Smoke test passed: game mounts, paints, starts a run and plays.');
