import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Ağ erişimi yasağı — plan M8.1.
 *
 * `research.test.ts`'teki genel tarama (M7.5) zaten TÜM pakette `research/`
 * dışında ağ API çağrısı olmadığını doğruluyor; bu test yazma katmanına
 * özgü, tek başına okunabilir bir kanıt olarak ayrıca durur.
 */
describe('write/ katmanında ağ erişimi yok (M8.1)', () => {
  it('hiçbir dosyada fetch/XHR/WebSocket/EventSource çağrısı yok', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/
    const directory = fileURLToPath(new URL('.', import.meta.url))

    const files: string[] = []
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) continue
      if (name.endsWith('.ts') && !name.endsWith('.test.ts')) files.push(path)
    }

    expect(files.length).toBeGreaterThan(0)
    const offenders = files.filter((file) => network.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
