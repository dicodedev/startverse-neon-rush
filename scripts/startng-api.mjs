/**
 * Shared helpers for the start.ng publishing API.
 *
 * Docs: https://start.ng/docs.md — "Put your game live" and "Checks before anything goes
 * live". The API needs no key, so these run from anywhere.
 */

export const API = 'https://api.start.ng';

/** Overridable so a fork can point at its own repo or address. */
export const REPO_URL =
  process.env.STARTNG_REPO_URL ?? 'https://github.com/dicodedev/startverse-neon-rush';
export const GAME_NAME = process.env.STARTNG_GAME_NAME ?? 'startverse-neon-rush';

export function body() {
  return { repo_url: REPO_URL, name: GAME_NAME };
}

/** start.ng reports every problem at once, each with a code, so scripts can act on it. */
export async function call(path) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body()),
  });

  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  return { status: res.status, payload };
}

/** Prints the `errors` and `warnings` arrays the API returns. */
export function report(payload, { showWarnings = true } = {}) {
  const errors = payload?.errors ?? [];
  const warnings = payload?.warnings ?? [];

  if (errors.length) {
    console.error(`\n${errors.length} error(s) stop this going live:`);
    for (const e of errors) {
      console.error(`  [${e.code}] ${e.message}${e.file ? `  (${e.file})` : ''}`);
    }
  }

  if (warnings.length && showWarnings) {
    console.warn(`\n${warnings.length} warning(s), which do not block publishing:`);
    for (const w of warnings) {
      console.warn(`  [${w.code}] ${w.message}${w.file ? `  (${w.file})` : ''}`);
    }
  }

  if (!errors.length && !warnings.length) {
    console.log('No problems reported.');
  }
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

export function reportPublish(payload) {
  console.log(`\nname:    ${payload.name}`);
  console.log(`folder:  ${payload.folder ?? '(repo root)'}`);
  console.log(`files:   ${payload.files ?? '?'}   size: ${kb(payload.size_bytes ?? 0)}`);
  if (payload.skipped?.length) {
    console.log(`skipped: ${payload.skipped.join(', ')}  (not served types)`);
  }
}
