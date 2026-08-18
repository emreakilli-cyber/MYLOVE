import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** M8.1 — bu modülde ağ çağrısı bulunmadığını doğrulayan test. */
describe('write katmanı ağa çıkmaz (M8.1)', () => {
  const writeRoot = fileURLToPath(new URL('.', import.meta.url))

  function walk(directory: string): string[] {
    const files: string[] = []
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) files.push(...walk(path))
      else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) files.push(path)
    }
    return files
  }

  it('src/write altında hiçbir dosyada ağ API çağrısı yok', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/
    const offenders = walk(writeRoot).filter((file) => network.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
