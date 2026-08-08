import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mask } from './mask/mask'

/*
 * Paket yalıtımı (plan M0.3) ve başarım bütçesi (M2.10).
 *
 * Yalıtım kuralı bir yorum satırı değil, testtir: bu paket ana uygulamadan
 * hiçbir şey import etmez ve sıfır çalışma-zamanı bağımlılığı taşır. Kural
 * bozulduğunda derleme değil, test kırmızıya döner.
 */

const packageRoot = fileURLToPath(new URL('.', import.meta.url))

function sourceFiles(directory: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path))
    } else if (name.endsWith('.ts')) {
      found.push(path)
    }
  }
  return found
}

const IMPORT_PATTERN = /(?:from|import)\s+['"]([^'"]+)['"]/g

describe('paket yalıtımı (M0.3)', () => {
  const files = sourceFiles(packageRoot)

  it('kaynak dosya bulur', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('paket dışına çıkan göreli import yok', () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      IMPORT_PATTERN.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = IMPORT_PATTERN.exec(source)) !== null) {
        const specifier = match[1]
        if (specifier === undefined || !specifier.startsWith('.')) continue

        const resolved = join(file, '..', specifier)
        if (!resolved.startsWith(packageRoot)) {
          offenders.push(`${file} → ${specifier}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('çalışma zamanı kodunda paket dışı bağımlılık yok', () => {
    const allowedInTests = new Set(['vitest', 'node:fs', 'node:path', 'node:url'])
    const offenders: string[] = []

    for (const file of files) {
      const isTest = file.endsWith('.test.ts')
      const source = readFileSync(file, 'utf8')
      IMPORT_PATTERN.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = IMPORT_PATTERN.exec(source)) !== null) {
        const specifier = match[1]
        if (specifier === undefined || specifier.startsWith('.')) continue
        if (isTest && allowedInTests.has(specifier)) continue
        offenders.push(`${file} → ${specifier}`)
      }
    }

    expect(offenders).toEqual([])
  })
})

describe('kural katmanı başarım bütçesi (M2.10)', () => {
  it('150.000 karakterlik metni 250 ms altında maskeler', () => {
    const paragraph =
      'Müvekkil TC 10000000146 numaralı kişi, 0532 111 22 33 telefonundan arandı; ' +
      'TR33 0006 1005 1978 6457 8413 26 hesabına 12.03.2024 tarihinde ödeme yapıldı. ' +
      'Dosya 2024/1234 E. sayılıdır ve 34 ABC 123 plakalı araç konu edilmiştir. '

    let text = ''
    while (text.length < 150_000) text += paragraph
    text = text.slice(0, 150_000)

    const started = performance.now()
    const result = mask(text)
    const elapsed = performance.now() - started

    expect(result.spans.length).toBeGreaterThan(100)
    expect(elapsed).toBeLessThan(250)
  })
})
