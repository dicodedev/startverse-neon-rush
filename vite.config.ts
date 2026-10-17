import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// start.ng serves the built game from <name>.start.ng and requires every path in the
// built HTML to be relative, so the game also works from a subdirectory or a local file.
// See docs/start-platform.md, "Rules for the files" -> Paths.
//
// The source entry lives in src/ rather than at the repo root on purpose. start.ng looks
// for index.html "at the top of the repo or in dist/, build/, docs/ or out/", top first, so
// a root index.html loading /src/main.tsx would be refused with `needs_build` before the
// built folder was ever considered.
//
// So Vite's root is src/, which makes src/index.html the page and puts the built copy
// straight at dist/index.html. With no index.html at the repo root, start.ng falls through
// to dist/ and finds a game that is already built.
export default defineConfig({
  root: 'src',
  publicDir: '../public',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    // start.ng checks files for hidden code in encoded strings and reports anything it
    // cannot read as `obfuscated_code`. A plain esbuild minify is fine; keep it that way.
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Keep three.js in its own chunk so game code stays small and readable.
        manualChunks: { three: ['three'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // root is src/, so the glob is relative to that rather than to the repo.
    include: ['**/*.test.{ts,tsx}'],
    environmentOptions: {
      jsdom: {
        // The game is served from <name>.start.ng in production, and the connect page only
        // answers such an address. Pointing jsdom at <name>.start.localhost makes the
        // Start.ng adapter actually switch on in tests instead of short-circuiting to
        // guest-only. See src/startng/env.ts.
        url: 'http://neon-rush.start.localhost:5173/',
      },
    },
  },
});