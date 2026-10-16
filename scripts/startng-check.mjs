/**
 * Checks the repo against everything start.ng enforces, without publishing anything.
 *
 * Docs: "To check a repo without publishing anything, call POST https://api.start.ng/games/check
 * with the same body as publish. It replies 200 if the game would go live (with any
 * warnings), or 422 with every problem. AI assistants: check first, fix what it finds, then
 * publish."
 *
 *   npm run startng:check
 */
import { call, report, REPO_URL, GAME_NAME } from './startng-api.mjs';

console.log(`Checking ${GAME_NAME}`);
console.log(`from ${REPO_URL}`);

const { status, payload } = await call('/games/check');

if (status === 200) {
  console.log('\nThis game would go live.');
  report(payload);
  process.exit(0);
}

console.error(`\nstart.ng replied ${status}.`);
report(payload);
process.exit(1);
