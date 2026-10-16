# Neon Rush

An endless neon runner for [start.ng](https://start.ng). You play as your own start.ng
character: sign in on start.ng and the runner wears your colours, hair, hat and accessory.

Play it: **https://startverse-neon-rush.start.ng**

## start.ng handles sign-in

The game never sees a password, an email, or your real start.ng sign-in. It asks start.ng
who is playing through a hidden page at `start.ng/connect` using `postMessage`, and only
trusts a reply that comes from start.ng, from its own frame, with a matching request id.

`src/startng/connect.ts` is that whole conversation. `src/startng/usePlayer.ts` keeps it up
to date, because a player can sign in or out on start.ng while the game is open.

Every reply is checked three ways before it is believed:

```js
if (e.origin !== origin) return;              // only start.ng can answer
if (e.source !== el.contentWindow) return;    // only our own frame
if (data.requestId !== requestId) return;     // only an answer to this request
```

### The character rule

start.ng games show the player's start.ng character, which is what makes start.ng one place
instead of many separate games. `src/character/style.ts` turns whatever start.ng sent into a
style the renderer can rely on, falling back per field, because start.ng may add a hair or a
hat this build has never seen. `src/character/createCharacter.ts` draws the runner from it
and re-skins in place when the player signs in or out.

Guests get start.ng's shared guest look and a sign-in button.

Away from start.ng — a local dev server, or the built folder opened directly — there is no
player, so the game still runs and scores into this browser's own board.

## Leaderboard

`startng.json` declares the columns, and the game sends exactly those:

| Stat | Column | Order |
| --- | --- | --- |
| `distance` | Metres run | highest |
| `shards` | Shards | highest |
| `survived` | Survived | lowest, as `m:ss` |

Players are ranked by the first stat, then the next ones break ties. Only each player's best
run is kept.

## Running it

```bash
npm install
npm run dev      # guest only, sign-in needs start.ng
npm run validate # typecheck, lint, test, build
```

Controls: `←` `→` to change lane, `Space` to jump. On a phone, swipe left, right and up.
A block cannot be jumped, only gone around; a barrier can be jumped.

Sign-in, scores and the shared board only work once the game is served from
`<name>.start.ng`, because that is the only place start.ng answers from.

## Publishing

start.ng serves a built, static site and never runs a build of its own, so `dist/` is
committed and `base` is set to `./` so every path is relative.

```bash
npm run build        # writes dist/
npm run startng:check    # every rule start.ng enforces, without publishing
npm run startng:publish  # 202 + approve_url the first time, 200 updates after
```

The first publish replies with a one-time `approve_url`. Open it, sign in to start.ng, and
the game goes live on your account. After that, every push to the published branch updates
the game by itself.

`cover.png` is the card picture on start.ng. It is generated:

```bash
node scripts/make-cover.mjs
```

## Layout

| Path | Role |
| --- | --- |
| `src/startng/connect.ts` | The postMessage conversation with start.ng |
| `src/startng/types.ts` | The shapes start.ng sends |
| `src/startng/usePlayer.ts` | Who is playing, kept up to date |
| `src/startng/local.ts` | A local board for when start.ng is not reachable |
| `src/character/style.ts` | Validates and defaults a start.ng style |
| `src/character/createCharacter.ts` | Draws the runner from that style |
| `src/game/world.ts` | The rules, with no three.js so they can be tested |
| `src/game/NeonScene.tsx` | The 3D world |
| `docs/start-platform.md` | start.ng's platform docs |

## Credits

The character structure and the connect-page protocol follow start.ng's documented reference
runner, [Lane Dash](https://github.com/Blackburn0/HNG-Game). That repo carries no licence,
so nothing was copied from it: the TypeScript here is written against
[docs/start-platform.md](docs/start-platform.md), with Lane Dash used only to confirm the
documented behaviour.