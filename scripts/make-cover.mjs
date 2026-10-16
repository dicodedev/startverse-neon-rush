/**
 * Renders cover.png, the picture on the game's card on start.ng.
 *
 * Docs: "Put cover.png (or cover.jpg / cover.webp) next to your index.html or at the top of
 * your repo: start.ng picks it up automatically. 16:10, at least 640 x 400 (1600 x 1000
 * looks sharp). PNG, JPEG or WebP, under 2 MB. Make it look like the game, with its title
 * on it."
 *
 * Drawn with a headless browser so the cover matches the game's own look without
 * shipping a font or an image library into the project.
 *
 *   node scripts/make-cover.mjs
 */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const WIDTH = 1600;
const HEIGHT = 1000;

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: 'x'; src: local('Impact'), local('Arial Black'); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
        background: #07030f;
        font-family: 'Segoe UI', system-ui, sans-serif;
        display: grid; place-items: center;
      }
      .scene { position: relative; width: 100%; height: 100%; }

      /* Perspective grid, like the track in the game. */
      .grid {
        position: absolute; left: -20%; right: -20%; bottom: -10%; height: 78%;
        background-image:
          linear-gradient(rgba(57,255,136,.85) 3px, transparent 3px),
          linear-gradient(90deg, rgba(57,255,136,.55) 2px, transparent 2px);
        background-size: 100% 58px, 130px 100%;
        transform: perspective(520px) rotateX(66deg);
        transform-origin: bottom center;
        mask-image: linear-gradient(to top, #000 8%, transparent 78%);
        -webkit-mask-image: linear-gradient(to top, #000 8%, transparent 78%);
        opacity: .75;
      }
      .rail {
        position: absolute; bottom: 6%; width: 7px; height: 62%;
        background: #39ff88; box-shadow: 0 0 34px 8px rgba(57,255,136,.75);
        border-radius: 4px;
      }
      .rail.l { left: 12%; } .rail.r { right: 12%; }

      .glow {
        position: absolute; left: 50%; top: 46%; width: 1100px; height: 620px;
        transform: translate(-50%,-50%);
        background: radial-gradient(ellipse at center, rgba(57,255,136,.30), transparent 62%);
      }

      /* The runner: a blocky figure in the start.ng primary green. */
      .runner { position: absolute; left: 50%; bottom: 15%; width: 190px; height: 400px;
                transform: translateX(-50%); filter: drop-shadow(0 0 26px rgba(57,255,136,.55)); }
      .runner div { position: absolute; background: #39ff88; border-radius: 4px; }
      .r-head  { left: 62px; top: 0;    width: 66px; height: 72px; background: #8d5524 !important; }
      .r-hair  { left: 58px; top: -8px;  width: 74px; height: 26px; }
      .r-torso { left: 52px; top: 84px;  width: 86px; height: 130px; }
      .r-armL  { left: 22px; top: 88px;  width: 24px; height: 108px; transform: rotate(18deg); }
      .r-armR  { left: 144px;top: 88px;  width: 24px; height: 108px; transform: rotate(-18deg); }
      .r-legL  { left: 56px; top: 222px; width: 30px; height: 150px; background: #0c6e5a !important;
                 transform: rotate(10deg); }
      .r-legR  { left: 104px;top: 222px; width: 30px; height: 150px; background: #0c6e5a !important;
                 transform: rotate(-10deg); }

      .shard { position: absolute; width: 34px; height: 34px; background: #39ff88;
               box-shadow: 0 0 26px 6px rgba(57,255,136,.8);
               clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }

      .title { position: absolute; left: 50%; top: 15%; transform: translateX(-50%);
               text-align: center; white-space: nowrap; }
      h1 {
        font-size: 168px; font-weight: 900; letter-spacing: -4px; line-height: .92;
        color: #39ff88;
        text-shadow: 0 0 22px rgba(57,255,136,.95), 0 0 70px rgba(57,255,136,.6),
                     0 0 130px rgba(57,255,136,.35);
      }
      .tag { margin-top: 20px; font-size: 40px; font-weight: 700; letter-spacing: 11px;
             color: #ff2d95; text-shadow: 0 0 26px rgba(255,45,149,.8); }
    </style>
  </head>
  <body>
    <div class="scene">
      <div class="glow"></div>
      <div class="grid"></div>
      <div class="rail l"></div>
      <div class="rail r"></div>

      <div class="runner">
        <div class="r-head"></div>
        <div class="r-hair"></div>
        <div class="r-torso"></div>
        <div class="r-armL"></div>
        <div class="r-armR"></div>
        <div class="r-legL"></div>
        <div class="r-legR"></div>
      </div>

      <div class="shard" style="left:27%; bottom:34%;"></div>
      <div class="shard" style="left:37%; bottom:46%; transform:scale(.72)"></div>
      <div class="shard" style="left:63%; bottom:41%; transform:scale(.85)"></div>
      <div class="shard" style="left:72%; bottom:29%; transform:scale(.62)"></div>

      <div class="title">
        <h1>NEON RUSH</h1>
        <div class="tag">ENDLESS RUNNER</div>
      </div>
    </div>
  </body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: 'load' });
const buffer = await page.screenshot({ type: 'png' });
await browser.close();

await writeFile(new URL('../cover.png', import.meta.url), buffer);
console.log(`cover.png written: ${WIDTH}x${HEIGHT}, ${(buffer.length / 1024).toFixed(0)} KB`);
