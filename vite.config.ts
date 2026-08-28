import { defineConfig } from 'vite'

export default defineConfig({
  // Cloudflare Pages serves this at the root of its own subdomain; GitHub Pages
  // serves it under /<repo>/. Hardcoding either one breaks the other, so the
  // path comes from the environment and defaults to root.
  base: process.env.BASE_PATH ?? '/',
  server: {
    // Bind to 0.0.0.0 so the dev server is reachable from a phone on the same
    // network. Testing this on a real device is not optional — the gesture
    // unlock, the wake lock and the GPU budget all behave differently there
    // than they do in a desktop browser's device emulation.
    host: true,
  },
  build: {
    target: 'es2022',
    // Everything here is one small module graph plus Three. Inlining the CSS
    // and shaders saves round trips on a cellular connection, which is the
    // realistic first-load case.
    assetsInlineLimit: 8192,
    rollupOptions: {
      output: {
        // Three is by far the largest dependency and never changes between
        // deploys; splitting it out keeps it cached across releases.
        manualChunks: { three: ['three'] },
      },
    },
  },
})
