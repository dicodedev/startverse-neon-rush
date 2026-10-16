import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// start.ng serves the built game from <name>.start.ng and requires every path in the
// built HTML to be relative, so the game also works from a subdirectory or a local file.
// See docs/start-platform.md, "Rules for the files" -> Paths.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
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
    include: ['src/**/*.test.{ts,tsx}'],
  },
});