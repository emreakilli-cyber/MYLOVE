import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * M8.1 — yazma katmanı ağa hiç çıkmaz. Bu, `research.test.ts`'teki genel
 * taramadan bağımsız, modülün KENDİ SÖZLEŞMESİNİ kendi başına doğrulayan bir
 * testtir: `src/write/` tek başına okunsa bile ağ yasağı burada görülür.
 */
describe('yazma katmanında ağ erişimi yok (M8.1)', () => {
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

  it('src/write/ altında hiçbir dosya ağ API çağırmıyor', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/
    const offenders = walk(writeRoot).filter((file) => network.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('src/write/ altında hiçbir dosya ağ ile ilgili node modülü import etmiyor', () => {
    const networkModules = /from\s+['"](?:node:https?|node:net|node:dgram|node:dns)['"]/
    const offenders = walk(writeRoot).filter((file) =>
      networkModules.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
