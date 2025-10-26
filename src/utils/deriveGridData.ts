// src/utils/deriveGridData.ts

// Utility: derive a tabular grid (rows + columns) from arbitrary JSON text.
// - Picks the "best" array of records anywhere in the JSON (root or nested).
// - Tolerant parsing (JSON5 + JSONL detection).
// - Returns column metadata and a JSONPath-like path to the chosen array.

import JSON5 from 'json5'

export type GridColumn = {
  key: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'null' | 'undefined'
}

export type GridRow = Record<string, unknown>

export type DeriveResult = {
  rows: GridRow[]
  columns: GridColumn[]
  /** JSONPath-like path (e.g., $.data.items) to the array used */
  path: string
  /** free-form notes (why this array was selected) */
  note?: string
}

/**
 * ✅ FIX: New return type for the main function to include potential errors.
 */
export type DerivationOutput = {
  data: DeriveResult | null
  error: string | null
}

/**
 * @name parseTolerant
 * @description Tries to parse a string using JSON5, then falls back to JSON, then to JSONL.
 * @returns {[unknown, null] | [null, Error]} A tuple of [data, error].
 */
function parseTolerant(text: string): [unknown, null] | [null, Error] {
  try {
    // First, try the most lenient parser.
    return [JSON5.parse(text), null]
  } catch (e1) {
    try {
      // If that fails, try the stricter, standard JSON parser.
      return [JSON.parse(text), null]
    } catch (e2) {
      // ✅ FIX: As a last resort, try to parse as JSONL (JSON Lines).
      // This is useful for logs or data streams.
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length > 1) {
        const objs: unknown[] = []
        let lastError: Error | null = null
        for (const l of lines) {
          try {
            objs.push(JSON5.parse(l))
          } catch (e) {
            // Keep track of the last error in case the whole file is invalid.
            lastError = e instanceof Error ? e : new Error(String(e))
          }
        }
        if (objs.length > 0) {
          return [objs, null] // Successfully parsed at least one line.
        }
        if (lastError) {
          return [null, new Error(`Failed to parse as JSON or JSONL. Last line error: ${lastError.message}`)]
        }
      }
      // If all attempts fail, return the most likely root cause (the first error from JSON5).
      return [null, e1 instanceof Error ? e1 : new Error(String(e1))]
    }
  }
}


/** Walk object graph and collect candidate arrays of records */
function* walkForArrays(node: unknown, path: string[]): Generator<{ path: string[]; arr: unknown[] }> {
  if (Array.isArray(node)) {
    yield { path, arr: node }
    // also inspect elements
    for (let i = 0; i < node.length; i++) {
      yield* walkForArrays((node as unknown[])[i], path.concat(`[${i}]`))
    }
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      yield* walkForArrays(v, path.concat(k))
    }
  }
}

/** Score arrays to choose the best tabular candidate */
function scoreArray(arr: unknown[]): { score: number; reason: string; keys: string[] } {
  if (arr.length === 0) return { score: 0, reason: 'empty', keys: [] }
  const sampleCount = Math.min(arr.length, 50)
  let objectCount = 0
  const keyFreq = new Map<string, number>()

  for (let i = 0; i < sampleCount; i++) {
    const el = arr[i]
    if (el && typeof el === 'object' && !Array.isArray(el)) {
      objectCount++
      for (const k of Object.keys(el as Record<string, unknown>)) {
        keyFreq.set(k, (keyFreq.get(k) ?? 0) + 1)
      }
    }
  }

  // If primitives: still allow by mapping to { value: ... }
  if (objectCount === 0) {
    return { score: 1 + Math.log10(arr.length + 1), reason: 'primitive-array', keys: ['value'] }
  }

  const keys = Array.from(keyFreq.entries())
      .filter(([, n]) => n >= Math.ceil(sampleCount * 0.4)) // present in >= 40% of samples
      .map(([k]) => k)

  // Score combines: objects ratio, number of stable keys, and length
  const ratio = objectCount / sampleCount
  const score = ratio * 70 + keys.length * 5 + Math.log10(arr.length + 1) * 10
  const reason = `objects=${objectCount}/${sampleCount}, keys=${keys.length}, len=${arr.length}`
  return { score, reason, keys: keys.length ? keys : Array.from(keyFreq.keys()) }
}

function buildColumns(rows: GridRow[]): GridColumn[] {
  const keys = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k)
  return Array.from(keys).map((k) => {
    // infer type from first non-undefined value
    let t: GridColumn['type'] = 'undefined'
    for (const r of rows) {
      if (r[k] !== undefined) { t = inferType(r[k]); break }
    }
    return { key: k, type: t }
  })
}

/** Heuristic: determine scalar-ish type for grid presentation */
function inferType(v: unknown): GridColumn['type'] {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  const t = typeof v
  if (t === 'string') {
    // Try date-like
    const s = v as string
    // quick ISO-ish or epoch test
    if (/^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}:\d{2}(\.\d{1,3})?([+-]\d{2}:\d{2}|Z)?)?$/.test(s)) return 'date'
    return 'string'
  }
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  if (Array.isArray(v)) return 'array'
  return 'object'
}

/** Convert nested structures to short printable strings for grid cells */
function toCell(v: unknown): unknown {
  const t = inferType(v)
  if (t === 'object' || t === 'array') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return v as never
}

function normalizeRows(arr: unknown[], keys: string[]): GridRow[] {
  if (keys.length === 1 && keys[0] === 'value') {
    // primitives → { value }
    return arr.map((v) => ({ value: toCell(v) }))
  }
  return arr.map((v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      const row: GridRow = {}
      for (const k of keys) row[k] = toCell(obj[k])
      // also include occasional extra keys to avoid losing info
      for (const k of Object.keys(obj)) {
        if (!(k in row)) row[k] = toCell(obj[k])
      }
      return row
    }
    // non-object element → put under "value"
    return { value: toCell(v) }
  })
}

/**
 * @name deriveGridData
 * @description The main function to process JSON text into grid data.
 * @param {string} text The raw JSON/JSON5/JSONL string.
 * @returns {DerivationOutput} An object containing either the derived grid data or an error message.
 */
export function deriveGridData(text: string): DerivationOutput {
  if (!text.trim()) {
    return { data: null, error: null }
  }

  // ✅ FIX: Capture the error from the tolerant parser.
  const [root, err] = parseTolerant(text)
  if (err) {
    return { data: null, error: err.message }
  }

  // Gather all arrays in the graph
  const candidates: { path: string[]; arr: unknown[]; score: number; reason: string; keys: string[] }[] = []
  for (const { path, arr } of walkForArrays(root, ['$'])) {
    const { score, reason, keys } = scoreArray(arr)
    if (score > 0) candidates.push({ path, arr, score, reason, keys })
  }
  if (candidates.length === 0) {
    // No error, but no data. GridView will show its default message.
    return { data: null, error: null }
  }

  // Pick best scoring candidate
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  const rows = normalizeRows(best.arr, best.keys)
  const columns = buildColumns(rows)
  const pathStr = best.path.join('.').replace(/\.\[/g, '[') // prettify $.data[0].items → $.data[0].items

  const data: DeriveResult = {
    rows,
    columns,
    path: pathStr,
    note: `Selected array at ${pathStr}; ${best.reason}`,
  }

  return { data, error: null }
}