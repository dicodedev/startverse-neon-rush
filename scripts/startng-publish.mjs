/**
 * Puts the game live, or updates it if it is already live.
 *
 * Docs: the first time a repo is published start.ng replies 202 with an `approve_url` that
 * the owner opens once, by hand, to put it on their account. After that, every push to the
 * published branch updates the game by itself.
 *
 * This script never approves anything itself. It stops and shows the link for a human to
 * open, which is the whole point of the approve step.
 *
 *   npm run startng:publish
 */
import { call, report, reportPublish, REPO_URL, GAME_NAME } from './startng-api.mjs';

console.log(`Publishing ${GAME_NAME}`);
console.log(`from ${REPO_URL}\n`);

const { status, payload } = await call('/games/publish');

// 422 and friends: something in the repo has to be fixed first.
if (status >= 400) {
  console.error(`start.ng replied ${status}.`);
  report(payload);
  process.exit(1);
}

// 202: a new game, waiting for a human to approve it.
if (status === 202 && payload?.approve_url) {
  reportPublish(payload);
  console.log('\n' + '='.repeat(64));
  console.log('  OPEN THIS LINK TO PUT THE GAME LIVE:');
  console.log('');
  console.log(`  ${payload.approve_url}`);
  console.log('');
  console.log(`  It works once and lasts until ${payload.expires_at}.`);
  console.log('  It signs you in to start.ng and asks "Put the game live?".');
  console.log('='.repeat(64) + '\n');
  process.exit(0);
}

// 200: an already-approved game, updated straight away.
if (status === 200) {
  reportPublish(payload);
  report(payload);
  console.log(`\n${payload.name} is live at ${payload.url}`);
  console.log('Later pushes to this branch update it automatically.');
  process.exit(0);
}

console.error(`Unexpected reply ${status}:`, payload);
process.exit(1);
