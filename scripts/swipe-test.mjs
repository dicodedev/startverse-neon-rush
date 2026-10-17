/**
 * Drives the real touch handler with synthetic touch events on a mobile device profile, so
 * the swipe path a player actually uses is exercised.
 *
 * This verifies the swipes are dispatched without errors and captures screenshots of the
 * result. The direction itself is asserted by the unit tests in src/game/lanes.test.ts,
 * which project the lanes through the game's real camera; reading pixels back out of the
 * WebGL canvas is not possible here because the drawing buffer is not preserved.
 *
 *   node scripts/swipe-test.mjs
 */
import { chromium, devices } from '@playwright/test';
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
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();

const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
});

/** Dispatches a real multi-step swipe with touch events. */
async function swipe(dx, dy = 0) {
  const cx = 200;
  const cy = 420;
  const client = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });

  await touch('touchStart', cx, cy);
  await page.waitForTimeout(60);
  for (let i = 1; i <= 4; i += 1) {
    await touch('touchMove', cx + (dx * i) / 4, cy + (dy * i) / 4);
    await page.waitForTimeout(25);
  }
  await touch('touchEnd', cx + dx, cy + dy);
  await client.detach();
}

const start = async () => {
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /tap to run/i }).click();
  await page.waitForTimeout(600);
};

// Right swipe: from the middle lane this should land on the rightmost lane.
await start();
await swipe(90);
await page.waitForTimeout(300);
await page.screenshot({ path: new URL('../swipe-right.png', import.meta.url).pathname.slice(1) });
console.log('Captured swipe-right.png (one rightward swipe from the middle lane)');

// Left swipe: back to the middle, then again to the leftmost lane.
await swipe(-90);
await page.waitForTimeout(200);
await swipe(-90);
await page.waitForTimeout(300);
await page.screenshot({ path: new URL('../swipe-left.png', import.meta.url).pathname.slice(1) });
console.log('Captured swipe-left.png (two leftward swipes, ending on the leftmost lane)');

// Repeated swipes must stop at the edge rather than wrap or error.
await start();
for (let i = 0; i < 6; i += 1) {
  await swipe(-90);
  await page.waitForTimeout(80);
}
await page.screenshot({
  path: new URL('../swipe-clamped-left.png', import.meta.url).pathname.slice(1),
});
console.log('Captured swipe-clamped-left.png (six leftward swipes, clamped at the edge)');

// A tap must not move the player.
await start();
await swipe(5, 5);
await page.waitForTimeout(200);
await page.screenshot({ path: new URL('../swipe-tap.png', import.meta.url).pathname.slice(1) });
console.log('Captured swipe-tap.png (a tap, which must not change lane)');

// Keyboard still works alongside the touch controls.
await start();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
await page.screenshot({
  path: new URL('../keyboard-right.png', import.meta.url).pathname.slice(1),
});
console.log('Captured keyboard-right.png (ArrowRight from the middle lane)');

await browser.close();
server.close();

if (problems.length) {
  console.error('\nSwipe test FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nSwipe test passed: touch swipes dispatched with no console or page errors.');
