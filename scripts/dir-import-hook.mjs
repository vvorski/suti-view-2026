/**
 * Let Node resolve the imports Vite resolves for free.
 *
 * The app writes `from './engine'` and `from './shake'`; Vite finds
 * `engine/index.ts` and `shake.ts`. Node's ESM resolver does neither — it
 * throws ERR_UNSUPPORTED_DIR_IMPORT for the first and ERR_MODULE_NOT_FOUND for
 * the second — so any probe that imports a module which in turn imports either
 * shape fails before it runs a line of the code it meant to test.
 *
 * The existing probes never hit this because they import leaf modules only.
 * probe-fullscreen does, because permission-gate.ts imports `./engine`, and the
 * alternative to this hook is either not testing that file in Node at all or
 * restructuring the app's imports to suit the test harness. Neither is worth it
 * for twenty lines.
 *
 * Register with: node --import ./scripts/dir-import-hook.mjs
 */

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { existsSync } from 'node:fs'
    import { fileURLToPath } from 'node:url'

    // Directory imports resolve to an index; extensionless ones get an
    // extension. Order matters only in that .ts is what this project writes.
    const SUFFIXES = ['/index.ts', '/index.js', '.ts', '.js', '.mjs']

    export async function resolve(specifier, context, next) {
      try {
        return await next(specifier, context)
      } catch (err) {
        // Only rescue the two failure modes this exists for. Anything else is
        // a genuine unresolved import and must stay an error.
        if (err?.code !== 'ERR_UNSUPPORTED_DIR_IMPORT' && err?.code !== 'ERR_MODULE_NOT_FOUND') {
          throw err
        }
        if (!err.url) throw err
        const base = fileURLToPath(err.url)
        for (const suffix of SUFFIXES) {
          if (existsSync(base + suffix)) return next(base + suffix, context)
        }
        throw err
      }
    }
`),
  pathToFileURL('./'),
)
