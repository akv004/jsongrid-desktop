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

// ✅ FIX: GridRow can now have sub-rows for hierarchical data.
export type GridRow = {
  subRows?: GridRow[]
  isSubRow?: boolean
  [key: string]: unknown
}

export type DeriveResult = {
  rows: GridRow[]
  columns: GridColumn[]
  /** JSONPath-like path (e.g., $.data.items) to the array used */
  path: string
  /** free-form notes (why this array was selected) */
  note?: string
}

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
    return [JSON5.parse(text), null]
  } catch (e1) {
    try {
      return [JSON.parse(text), null]
    } catch (e2) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length > 1) {
        const objs: unknown[] = []
        let lastError: Error | null = null
        for (const l of lines) {
          try {
            objs.push(JSON5.parse(l))
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e))
          }
        }
        if (objs.length > 0) {
          return [objs, null]
        }
        if (lastError) {
          return [null, new Error(`Failed to parse as JSON or JSONL. Last line error: ${lastError.message}`)]
        }
      }
      return [null, e1 instanceof Error ? e1 : new Error(String(e1))]
    }
  }
}


/** Walk object graph and collect candidate arrays of records */
function* walkForArrays(node: unknown, path: string[]): Generator<{ path: string[]; arr: unknown[] }> {
  if (Array.isArray(node)) {
    yield { path, arr: node }
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

  if (objectCount === 0) {
    return { score: 1 + Math.log10(arr.length + 1), reason: 'primitive-array', keys: ['value'] }
  }

  const keys = Array.from(keyFreq.entries())
      .filter(([, n]) => n >= Math.ceil(sampleCount * 0.4))
      .map(([k]) => k)

  const ratio = objectCount / sampleCount
  const score = ratio * 70 + keys.length * 5 + Math.log10(arr.length + 1) * 10
  const reason = `objects=${objectCount}/${sampleCount}, keys=${keys.length}, len=${arr.length}`
  return { score, reason, keys: keys.length ? keys : Array.from(keyFreq.keys()) }
}

function buildColumns(rows: GridRow[]): GridColumn[] {
  const keys = new Set<string>()
  for (const r of rows) {
    if (r.isSubRow) continue // Don't use sub-rows to determine columns
    for (const k of Object.keys(r)) keys.add(k)
  }
  keys.delete('subRows')
  keys.delete('isSubRow')

  return Array.from(keys).map((k) => {
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
    if (/^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}:\d{2}(\.\d{1,3})?([+-]\d{2}:\d{2}|Z)?)?$/.test(v as string)) return 'date'
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
  if (t === 'object') {
    return v ? 'Object' : 'null'
  }
  if (t === 'array') {
    return `Array(${(v as any[]).length})`
  }
  return v
}

/**
 * @name generateSubRows
 * @description Recursively generates a hierarchy of sub-rows from a nested object or array.
 * @param data The nested data to process.
 * @returns An array of GridRow objects representing the hierarchy.
 */
function generateSubRows(data: object): GridRow[] {
  return Object.entries(data).map(([key, value]) => {
    const subRow: GridRow = {
      key,
      value: toCell(value),
      isSubRow: true,
    }
    if (value && typeof value === 'object') {
      subRow.subRows = generateSubRows(value)
    }
    return subRow
  })
}

/**
 * @name normalizeRows
 * @description Converts the best-candidate array into a hierarchical structure for the grid.
 * @param arr The array of records to process.
 * @param keys The primary keys to use for the main table columns.
 * @returns An array of GridRow objects with potential `subRows`.
 */
function normalizeRows(arr: unknown[], keys: string[]): GridRow[] {
  if (keys.length === 1 && keys[0] === 'value') {
    return arr.map((v) => ({ value: toCell(v) }))
  }

  return arr.map((v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      const row: GridRow = {}
      const subRows: GridRow[] = []

      const allObjKeys = new Set([...keys, ...Object.keys(obj)])

      for (const k of allObjKeys) {
        const val = obj[k]
        if (val && typeof val === 'object') {
          row[k] = toCell(val)
          subRows.push(...generateSubRows({ [k]: val }))
        } else {
          row[k] = val
        }
      }

      if (subRows.length > 0) {
        row.subRows = subRows
      }
      return row
    }
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

  const [root, err] = parseTolerant(text)
  if (err) {
    return { data: null, error: err.message }
  }

  const candidates: { path: string[]; arr: unknown[]; score: number; reason: string; keys: string[] }[] = []
  for (const { path, arr } of walkForArrays(root, ['$'])) {
    const { score, reason, keys } = scoreArray(arr)
    if (score > 0) candidates.push({ path, arr, score, reason, keys })
  }
  if (candidates.length === 0) {
    return { data: null, error: null }
  }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  const rows = normalizeRows(best.arr, best.keys)
  const columns = buildColumns(rows)
  const pathStr = best.path.join('.').replace(/\.\[/g, '[')

  const data: DeriveResult = {
    rows,
    columns,
    path: pathStr,
    note: `Selected array at ${pathStr}; ${best.reason}`,
  }

  return { data, error: null }
}