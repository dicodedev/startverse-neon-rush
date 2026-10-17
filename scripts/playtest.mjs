/**
 * Plays a whole run in a headless browser to confirm the loop still works end to end
 * after the direction fix: the menu starts, the run plays, hazards and shards are handled,
 * a collision ends the run, and the game can be restarted.
 *
 *   node scripts/playtest.mjs
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
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));

const distance = async () => {
  const text = await page.evaluate(() => document.body.innerText);
  const m = text.match(/([\d,]+)\s*\n?\s*METRES/i);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });

// 1. The menu offers a way in.
await page.getByRole('button', { name: /tap to run/i }).waitFor({ timeout: 15000 });

// 2. Starting a run shows the live HUD.
await page.getByRole('button', { name: /tap to run/i }).click();
await page.waitForTimeout(700);
if (!(await page.evaluate(() => /METRES/i.test(document.body.innerText)))) {
  problems.push('the HUD did not appear after starting a run');
}

// 3. Lane switching and jumping must work without throwing or ending the run instantly.
//    Pressed once each, then released, so the run continues normally afterwards.
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(100);
await page.keyboard.press('Space');
await page.waitForTimeout(150);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(100);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(300);

const hudAfterInput = await page.evaluate(() => /METRES/i.test(document.body.innerText));
if (!hudAfterInput) {
  problems.push('the run ended while changing lanes and jumping');
}

// 4. Distance must actually increase, which proves the world is scrolling.
const first = await distance();
await page.waitForTimeout(1500);
const second = await distance();
if (first === null || second === null) {
  problems.push('could not read the distance readout');
} else if (!(second > first)) {
  problems.push(
    `distance did not increase (${first} -> ${second}); the world is not scrolling forward`,
  );
}

// 5. A run must end on a collision and offer a restart. The controls are left alone so
//    the run ends by hitting a hazard rather than by luck.
await page.getByRole('button', { name: /run again/i }).waitFor({ timeout: 60000 });
if ((await distance()) === null) problems.push('no final distance on the game-over card');

// 6. Restarting must produce a playable run again.
await page.getByRole('button', { name: /run again/i }).click();
await page.waitForTimeout(700);
if (!(await page.evaluate(() => /METRES/i.test(document.body.innerText)))) {
  problems.push('the HUD did not come back after restarting');
}
await page.keyboard.press('Space');
await page.waitForTimeout(400);

await browser.close();
server.close();

if (problems.length) {
  console.error('Playtest FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('Playtest passed: menu -> run -> lane/jump -> collision -> restart.');
