/**
 * Checks the sign-in UI of the production build in a real browser.
 *
 * The build is served from a *.start.localhost origin, which is the only kind of address
 * start.ng answers from (see src/startng/env.ts), with a local stand-in for the connect page
 * that speaks the documented postMessage protocol. The stubbed reply is a signed-in player,
 * so this asserts the state a player sees after completing the sign-in flow: their name, their
 * @account, a signed-in tick, and no leftover Sign in button.
 *
 * The unauthenticated, cancelled and unreachable states are covered by the unit and
 * integration tests in src/startng/usePlayer.test.tsx, which drive the same adapter directly.
 *
 *   node scripts/signin-ui-test.mjs
 */
import { chromium } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const GAME_ORIGIN = 'http://neon-rush.start.localhost:5173';

const USER = {
  id: 42,
  name: 'Runner Tee',
  account: 'Hamzat',
  style: { body: 'female', primaryColor: '#39ff88', hair: 'bun', hat: 'crown' },
  face: 'data:image/png;base64,BBBB',
};

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

/** The stand-in for start.ng/connect, answering with a signed-in player. */
const CONNECT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>connect</title></head>
<body><script>
  addEventListener('message', function (e) {
    var data = e.data || {};
    if (data.type !== 'startng:whoami') return;
    e.source.postMessage(
      { type: 'startng:user', user: ${JSON.stringify(USER)}, guest: null, requestId: data.requestId },
      e.origin,
    );
  });
</script></body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://start.localhost');
  let path = decodeURIComponent(url.pathname).replace(/^\/+/, '');

  if (path === 'connect') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(CONNECT_HTML);
    return;
  }

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

await new Promise((r) => server.listen(5173, '127.0.0.1', r));

const problems = [];
const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${GAME_ORIGIN}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(8000);

const body = await page.evaluate(() => document.body.innerText);
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).map((b) => (b.textContent ?? '').trim()),
);

if (!/Runner Tee/.test(body)) {
  problems.push(`the player name was not shown. Body: ${body.slice(0, 160)}`);
}
if (!/@Hamzat/.test(body)) problems.push('the account name was not shown');
if (!/\u2713/.test(body)) problems.push('the signed-in tick was not shown');
// The Sign in button is what the bug was about, so assert on the buttons themselves.
if (buttons.some((t) => /^sign in$/i.test(t))) {
  problems.push(`the Sign in button was still offered. Buttons: ${JSON.stringify(buttons)}`);
}

await page.screenshot({
  path: fileURLToPath(new URL('../signin-authenticated.png', import.meta.url)),
});

await browser.close();
server.close();

if (problems.length) {
  console.error('Sign-in UI test FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `Sign-in UI test passed: "Runner Tee" @Hamzat with a tick, buttons ${JSON.stringify(buttons)}`,
);