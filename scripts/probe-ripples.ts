/**
 * Asserts the ripple constants match, across ripples.ts and every geometric
 * shader — docs/todo.md entry 59.
 *
 * `MAX_RIPPLES` and `AUDIO_RIPPLES` are declared once in `ripples.ts` and
 * copied by hand into every geometric shader, which has no way to import a
 * JS constant. Fourteen declarations of two facts, kept in step only by a
 * comment asking nicely. If `ripples.ts` disagrees with a shader in either
 * direction, one view silently misbehaves: an array uploaded larger than
 * the shader's own `uniform vec4[N]` gets truncated by the driver, or a
 * shader reading past what was actually written reads garbage — five views
 * look right and the sixth reads as an unrelated quirk, which is exactly
 * the failure that survives ordinary testing.
 *
 * Reads the shaders as text and matches a regex rather than compiling
 * them, so this runs under plain Node beside every other probe here — no
 * GL context, no browser.
 *
 *   node --experimental-strip-types scripts/probe-ripples.ts
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_RIPPLES, AUDIO_RIPPLES } from '../src/engine/ripples.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

check(
  'ripples.ts itself is coherent: AUDIO_RIPPLES < MAX_RIPPLES with a non-empty touch band',
  AUDIO_RIPPLES > 0 && AUDIO_RIPPLES < MAX_RIPPLES,
  `AUDIO_RIPPLES=${AUDIO_RIPPLES} MAX_RIPPLES=${MAX_RIPPLES}`,
)

// Discovered by grep rather than a hardcoded list, so which *files* to check
// never needs updating by hand as views are added. The *count* below still
// does — `views.ts` imports every shader through Vite's `?raw` suffix, which
// plain Node has no loader for, so this file cannot import GEOMETRIC_VIEWS
// itself to derive the number automatically and has to be told it.
const SHADER_DIR = new URL('../src/shaders/', import.meta.url).pathname
const shaderFiles = readdirSync(SHADER_DIR).filter((f) => f.endsWith('.frag.glsl'))

const MAX_RE = /const\s+int\s+MAX_RIPPLES\s*=\s*(\d+)\s*;/
const AUDIO_RE = /const\s+int\s+AUDIO_RIPPLES\s*=\s*(\d+)\s*;/

let matched = 0
for (const file of shaderFiles) {
  const text = readFileSync(join(SHADER_DIR, file), 'utf8')
  const maxMatch = MAX_RE.exec(text)
  const audioMatch = AUDIO_RE.exec(text)
  // Not every shader declares these — only the six geometric ones that
  // actually spawn ripples. A shader with neither declaration is simply out
  // of scope, not a failure; one with only one of the two is a real defect
  // (a partial edit), so that case still gets checked and can fail.
  if (!maxMatch && !audioMatch) continue
  matched++

  check(
    `${file}: MAX_RIPPLES matches ripples.ts (${MAX_RIPPLES})`,
    maxMatch !== null && Number(maxMatch[1]) === MAX_RIPPLES,
    maxMatch ? `found ${maxMatch[1]}` : 'MAX_RIPPLES not declared',
  )
  check(
    `${file}: AUDIO_RIPPLES matches ripples.ts (${AUDIO_RIPPLES})`,
    audioMatch !== null && Number(audioMatch[1]) === AUDIO_RIPPLES,
    audioMatch ? `found ${audioMatch[1]}` : 'AUDIO_RIPPLES not declared',
  )
}

// A probe that only ever passes cannot be trusted — confirm it actually
// found the seven geometric shaders it is meant to be checking (docs/todo.md
// entry 101 added Rose, the seventh), so a future rename or a shader moved
// out of src/shaders/ doesn't silently make this check vacuous. Bump this
// number by hand, same as GEOMETRIC_VIEWS in views.ts, whenever the registry
// gains or loses a geometric view.
check('found the seven geometric shaders that declare these constants', matched === 7, `found ${matched}`)

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
