import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * M8.1 — yazma katmanı ağa hiç çıkmaz. `research.test.ts` içindeki M7.5
 * taraması paket genelini (research hariç) zaten kapsıyor; bu test yalnız
 * `src/write` için aynı garantiyi ayrıca ve açıkça belgeler.
 */
describe('yazma katmanının ağ erişimi yasağı (M8.1)', () => {
  it('src/write altında hiçbir dosyada ağ API çağrısı yok', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url))
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/

    const offenders = readdirSync(dir)
      .map((name) => join(dir, name))
      .filter((path) => statSync(path).isFile() && path.endsWith('.ts') && !path.endsWith('.test.ts'))
      .filter((path) => network.test(readFileSync(path, 'utf8')))

    expect(offenders).toEqual([])
  })
})
