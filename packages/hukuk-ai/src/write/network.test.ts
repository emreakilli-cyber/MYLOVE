/**
 * Ağ erişimi yasağı — plan M8.1.
 *
 * `CAPABILITIES.md` A8/A9/A13: yazma katmanı cihaz içi modelle çalışır,
 * internete çıkmaz. İnternete çıkan TEK modül araştırma katmanıdır (M7.5).
 * Bu test o iddiayı `src/write/` için ayrıca ve bağımsız olarak doğrular —
 * `research/research.test.ts`daki tarama testine bağımlı kalmadan.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function walk(directory: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) files.push(path)
  }
  return files
}

describe('src/write ağ erişimi yasağı (M8.1)', () => {
  const writeRoot = fileURLToPath(new URL('.', import.meta.url))

  it('hiçbir kaynak dosyada ağ API çağrısı yok', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/
    const offenders = walk(writeRoot).filter((file) => network.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('backend arayüzleri runsLocally: true taşır (ağ yasağının tip düzeyi)', () => {
    const files = walk(writeRoot)
    const declaresBackendInterface = /interface\s+\w*(Planner|Writer|Reviewer|Backend)\b/
    const offenders = files.filter((file) => {
      const content = readFileSync(file, 'utf8')
      const interfaceBlocks = content.match(/export interface\s+\w+\s*\{[^}]*\}/gs) ?? []
      return interfaceBlocks.some(
        (block) => declaresBackendInterface.test(block) && !block.includes('runsLocally: true'),
      )
    })
    expect(offenders).toEqual([])
  })
})
