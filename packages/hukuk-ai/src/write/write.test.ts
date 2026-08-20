import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * M8.1 — Yazma katmanında ağ erişimi yasağı.
 *
 * `CAPABILITIES.md` A8/A9/A13'ün tamamı cihaz içi modelle çalışır; internete
 * çıkan TEK modül araştırma katmanıdır (M7). Bu test yazma katmanının o
 * kuralı ihlal etmediğini, `src/research/research.test.ts`'teki genel
 * taramadan bağımsız olarak, doğrudan bu klasörde de doğrular.
 */
describe('yazma katmanında ağ erişimi yok (M8.1)', () => {
  const writeDir = fileURLToPath(new URL('.', import.meta.url))

  function sourceFiles(directory: string): string[] {
    const files: string[] = []
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) files.push(...sourceFiles(path))
      else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) files.push(path)
    }
    return files
  }

  it('hiçbir dosyada ağ API çağrısı yok', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/
    const offenders = sourceFiles(writeDir).filter((file) => network.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('backend arayüzleri `runsLocally: true` ile ağsızlığı tip düzeyinde işaretler', () => {
    const staged = readFileSync(join(writeDir, 'staged.ts'), 'utf8')
    expect(staged).toMatch(/readonly runsLocally: true/)
  })
})
