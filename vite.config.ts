import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

// A monotonic build marker for the on-screen version HUD (src/version.ts).
// The commit count, not a hand-maintained number, because a number nobody has
// to remember to bump is a number that can't fall out of sync with what
// actually shipped. And the commit count, not a build timestamp, because a
// timestamp would differ between Cloudflare Pages (built locally) and GitHub
// Pages (built in CI) for the exact same commit — breaking the "all three
// deploy targets serve an identical bundle" check this project is built
// around. Needs full git history, which is why both GitHub Actions workflows'
// checkout steps are configured with fetch-depth: 0 rather than the default
// shallow clone.
const buildNumber = execSync('git rev-list --count HEAD').toString().trim()

export default defineConfig({
  // Cloudflare Pages serves this at the root of its own subdomain; GitHub Pages
  // serves it under /<repo>/. Hardcoding either one breaks the other, so the
  // path comes from the environment and defaults to root.
  base: process.env.BASE_PATH ?? '/',
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
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
