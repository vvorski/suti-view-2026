/**
 * A QR encoder, small enough to be worth having instead of a dependency.
 *
 * Deliberately narrow: byte mode, error-correction level L, versions 1-4 only.
 * That covers 78 bytes, which is every URL this page will ever be served from
 * and then some, and it means every version here is a single error-correction
 * block — so the interleaving step that makes general encoders long collapses
 * to "data, then check bytes". The whole thing is under 200 lines because of
 * what it refuses to do.
 *
 * Encoding at runtime rather than baking in a matrix, because the QR then
 * always points at wherever the page is actually being served: github.io
 * today, a phone on the LAN during development, whatever comes later. A
 * hardcoded bitmap would be a second copy of the URL, and second copies go
 * stale silently.
 */

/** Total data codewords for versions 1-4 at ECC level L. */
const DATA_CODEWORDS = [19, 34, 55, 80]
/** Error-correction codewords for the same. One block each, which is why. */
const EC_CODEWORDS = [7, 10, 15, 20]
/** Alignment-pattern centre coordinates per version. v1 has none. */
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26]]

// ---- GF(256), the field QR's Reed-Solomon lives in ------------------------

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    // 0x11d is the primitive polynomial QR specifies.
    x = x << 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}

const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

/**
 * The generator polynomial for `n` error-correction codewords.
 *
 * Coefficients run highest degree first, so g[0] is always 1 — which is the
 * convention ecBytes() below relies on when it skips g[0] and divides by the
 * rest. Writing the two updates the other way round builds the same polynomial
 * reversed: it still looks like a plausible list of bytes, still has the right
 * length, and produces check bytes that are simply wrong.
 */
function generator(n: number): number[] {
  let g = [1]
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j] // multiply by x
      next[j + 1] ^= mul(g[j], EXP[i]) // ... and by the root
    }
    g = next
  }
  return g
}

/** Reed-Solomon check bytes for `data`. */
function ecBytes(data: number[], n: number): number[] {
  const g = generator(n)
  const rem = new Array<number>(n).fill(0)
  for (const byte of data) {
    const factor = byte ^ rem[0]
    rem.shift()
    rem.push(0)
    for (let i = 0; i < n; i++) rem[i] ^= mul(g[i + 1], factor)
  }
  return rem
}

// ---- bit stream -----------------------------------------------------------

function codewords(bytes: number[], version: number): number[] {
  const capacity = DATA_CODEWORDS[version - 1]
  const bits: number[] = []
  const push = (value: number, len: number): void => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }

  push(0b0100, 4) // byte mode
  push(bytes.length, 8) // versions 1-9 use an 8-bit length in byte mode
  for (const b of bytes) push(b, 8)

  // Terminator, then pad to a byte boundary, then the two alternating pad
  // bytes the spec names.
  for (let i = 0; i < 4 && bits.length < capacity * 8; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const out: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]
    out.push(v)
  }
  for (let i = 0; out.length < capacity; i++) out.push(i % 2 === 0 ? 0xec : 0x11)
  return out
}

// ---- matrix ---------------------------------------------------------------

type Grid = (0 | 1 | null)[][]

function blank(size: number): Grid {
  return Array.from({ length: size }, () => new Array<0 | 1 | null>(size).fill(null))
}

/**
 * A finder pattern and the light separator that must surround it.
 *
 * The -1..7 sweep covers both, and they are genuinely different things: inside
 * the 7×7 the ring and core are dark, while every module *outside* it is light
 * regardless. Folding the separator into the same edge test makes column 7 dark
 * — a QR of the right size with a finder that no scanner will lock onto.
 */
function finder(m: Grid, row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r
      const cc = col + c
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6
      if (!inside) {
        m[rr][cc] = 0 // separator
        continue
      }
      const ring = r === 0 || r === 6 || c === 0 || c === 6
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4
      m[rr][cc] = ring || core ? 1 : 0
    }
  }
}

/** The fixed patterns, plus the modules reserved for format information. */
function skeleton(version: number): Grid {
  const size = 17 + 4 * version
  const m = blank(size)

  finder(m, 0, 0)
  finder(m, 0, size - 7)
  finder(m, size - 7, 0)

  // Timing.
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0
    m[6][i] = bit
    m[i][6] = bit
  }

  // Alignment, skipping the three that would sit on a finder.
  const centres = ALIGN[version - 1]
  for (const r of centres) {
    for (const c of centres) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) {
        continue
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc))
          m[r + dr][c + dc] = ring === 1 ? 0 : 1
        }
      }
    }
  }

  m[size - 8][8] = 1 // the always-dark module

  // Reserve the format areas so data placement skips them.
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = 0
    if (m[i][8] === null) m[i][8] = 0
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 0
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 0
  }
  return m
}

/** True where the skeleton has already claimed a module. */
function reservedMap(version: number): boolean[][] {
  const m = skeleton(version)
  return m.map((row) => row.map((v) => v !== null))
}

function placeData(m: Grid, reserved: boolean[][], data: number[]): void {
  const size = m.length
  let bit = 0
  const next = (): number => {
    const i = bit++
    return i < data.length * 8 ? (data[i >> 3] >> (7 - (i & 7))) & 1 : 0
  }
  let upward = true
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right-- // the vertical timing column is not a data column
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue
        m[row][col] = next() as 0 | 1
      }
    }
    upward = !upward
  }
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

/**
 * Format information: 5 bits of (ECC level, mask), BCH(15,5)-encoded, then
 * XORed with the spec's fixed mask so an all-zero format is never valid.
 *
 * Returned as an integer and read LSB-first below, because every published
 * description of the placement indexes it that way. Building a nice MSB-first
 * array instead is how the first version of this went wrong.
 */
function formatValue(mask: number): number {
  const data = (0b01 << 3) | mask // 01 = level L
  let value = data << 10
  for (let i = 4; i >= 0; i--) {
    if ((value >> (i + 10)) & 1) value ^= 0b10100110111 << i
  }
  return ((data << 10) | value) ^ 0b101010000010010
}

/**
 * Write both copies of the format information.
 *
 * The coordinates below are the single most error-prone part of a QR encoder,
 * because the references state them as (x, y) — column then row — while the
 * matrix here is m[row][column]. Transposing them produces a QR of exactly the
 * right size, with correct-looking finders and timing, that no scanner will
 * read. That is precisely what the first version of this did, and only a
 * decoder caught it.
 */
function writeFormat(m: Grid, mask: number): void {
  const size = m.length
  const full = formatValue(mask)
  const bit = (i: number): 0 | 1 => ((full >> i) & 1) as 0 | 1

  // Copy one, around the top-left finder: down column 8, then left along row 8.
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i)
  m[7][8] = bit(6)
  m[8][8] = bit(7)
  m[8][7] = bit(8)
  for (let i = 9; i <= 14; i++) m[8][14 - i] = bit(i)

  // Copy two, split: along row 8 by the top-right finder, then down column 8
  // by the bottom-left one.
  for (let i = 0; i <= 7; i++) m[8][size - 1 - i] = bit(i)
  for (let i = 8; i <= 14; i++) m[size - 15 + i][8] = bit(i)

  // Last, because the loop above runs through this module and would otherwise
  // leave a format bit sitting where the always-dark module belongs.
  m[size - 8][8] = 1
}

/** The spec's four penalty rules, used to pick the least-bad mask. */
function penalty(m: Grid): number {
  const size = m.length
  const at = (r: number, c: number): number => (m[r][c] ? 1 : 0)
  let score = 0

  // Rule 1: runs of five or more.
  for (let i = 0; i < size; i++) {
    for (const line of [
      Array.from({ length: size }, (_, j) => at(i, j)),
      Array.from({ length: size }, (_, j) => at(j, i)),
    ]) {
      let run = 1
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) run++
        else {
          if (run >= 5) score += run - 2
          run = 1
        }
      }
      if (run >= 5) score += run - 2
    }
  }
  // Rule 2: 2x2 blocks of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = at(r, c)
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3
    }
  }
  // Rule 3: the finder-like 1:1:3:1:1 sequence.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
  const matches = (line: number[], pat: number[], at0: number): boolean =>
    pat.every((p, k) => line[at0 + k] === p)
  for (let i = 0; i < size; i++) {
    const row = Array.from({ length: size }, (_, j) => at(i, j))
    const col = Array.from({ length: size }, (_, j) => at(j, i))
    for (let j = 0; j + 11 <= size; j++) {
      for (const line of [row, col]) {
        if (matches(line, A, j) || matches(line, B, j)) score += 40
      }
    }
  }
  // Rule 4: deviation from an even split of dark and light.
  let dark = 0
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += at(r, c)
  const pct = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(pct - 50) / 5) * 10
  return score
}

/**
 * Encode `text` as a QR matrix — true is a dark module.
 *
 * Throws if the text will not fit in version 4 at level L (78 bytes), which no
 * URL this is used for comes close to. A caller that might exceed it should
 * catch rather than assume.
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))
  const version = DATA_CODEWORDS.findIndex((cap) => bytes.length + 2 <= cap) + 1
  if (version === 0) throw new Error(`too long for QR version 4-L: ${bytes.length} bytes`)

  const data = codewords(bytes, version)
  const full = [...data, ...ecBytes(data, EC_CODEWORDS[version - 1])]
  const reserved = reservedMap(version)

  let best: Grid | null = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const m = skeleton(version)
    placeData(m, reserved, full)
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m.length; c++) {
        if (!reserved[r][c] && MASKS[mask](r, c)) m[r][c] = (m[r][c] ? 0 : 1) as 0 | 1
      }
    }
    writeFormat(m, mask)
    const score = penalty(m)
    if (score < bestScore) {
      bestScore = score
      best = m
    }
  }
  return best!.map((row) => row.map((v) => v === 1))
}

/** The matrix as an SVG path, one rect per dark module, in a `size`-unit box. */
export function qrPath(matrix: boolean[][]): string {
  const n = matrix.length
  let d = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) d += `M${c} ${r}h1v1h-1z`
    }
  }
  return d
}
