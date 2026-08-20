import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  type FewShotOptions,
  type PetitionExample,
  selectFewShot,
} from './fewShot'
import { extractSkeleton } from './skeleton'
import {
  type ConsistencyReviewBackend,
  type SectionResult,
  type SectionSpec,
  checkConsistency,
  reviewSectionConsistency,
  TokenBudgetExceededError,
  writeSection,
  writeStaged,
} from './staged'
import { addDocument, createEmptyProfile, stdDev } from './styleProfile'
import { estimateTokens, type WriteBackend } from './types'

describe('ağ erişimi yasağı (M8.1)', () => {
  it('yazma katmanında hiçbir ağ API çağrısı yok', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/
    const root = fileURLToPath(new URL('.', import.meta.url))
    const files = readdirSync(root)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => join(root, name))

    const offenders = files.filter((file) => network.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})

describe('extractSkeleton (M8.2)', () => {
  it('roma numaralı üst başlıkları ve numarasız SONUÇ başlığını bulur', () => {
    const text = [
      'I. OLAYLAR',
      'Bir şeyler oldu.',
      '',
      'II. HUKUKİ SEBEPLER',
      'Devam ediyor.',
      '',
      'SONUÇ VE İSTEM',
      'Kabulüne karar verilmesini arz ederim.',
    ].join('\n')

    const skeleton = extractSkeleton(text)

    expect(skeleton.numberingScheme).toBe('roman')
    expect(skeleton.sections.map((s) => s.heading)).toEqual([
      'OLAYLAR',
      'HUKUKİ SEBEPLER',
      'SONUÇ VE İSTEM',
    ])
    expect(skeleton.sections[0]?.numbering).toBe('I')
    expect(skeleton.sections[2]?.numbering).toBeUndefined()
  })

  it('iç içe arabik numaralandırmada seviyeyi doğru hesaplar', () => {
    const text = ['1. Giriş', '1.1. Alt başlık', '2. Sonuç'].join('\n')

    const skeleton = extractSkeleton(text)

    expect(skeleton.numberingScheme).toBe('arabic')
    expect(skeleton.sections.map((s) => s.level)).toEqual([0, 1, 0])
  })

  it('numarasız düz metinde boş iskelet döner', () => {
    const skeleton = extractSkeleton('Bugün hava güzel. Dava açılmayacak.')
    expect(skeleton.sections).toEqual([])
    expect(skeleton.numberingScheme).toBe('none')
  })
})

describe('üslup profili (M8.3, M8.4)', () => {
  it('boş profil sıfır belge ile başlar', () => {
    const profile = createEmptyProfile()
    expect(profile.documentCount).toBe(0)
    expect(profile.sentenceLength.count).toBe(0)
  })

  it('belge belge artımlı birleşir; N belge aynı anda gerekmez', () => {
    const docA = 'Sayın Hakimliğe. Bu bir cümledir. Bu da başka bir cümle.\n\nSaygılarımla.'
    const docB = 'Sayın Hakimliğe. Kısa cümle.\n\nSaygılarımla.'

    let profile = createEmptyProfile()
    profile = addDocument(profile, docA)
    const afterFirst = profile
    profile = addDocument(profile, docB)

    expect(afterFirst.documentCount).toBe(1)
    expect(profile.documentCount).toBe(2)
    // Birinci belgenin istatistiği ikinciyle BİRLEŞTİ, sıfırlanmadı.
    expect(profile.sentenceLength.count).toBeGreaterThan(afterFirst.sentenceLength.count)
  })

  it('kalıp ifadeleri ve tercih edilen terimleri sayar', () => {
    const text =
      'Sayın Hakimliğe. Davacı taraf vekâlet ücreti talep etmektedir. ' +
      'Yukarıda arz ve izah edilen nedenlerle kabulüne karar verilmesini arz ederim.\n\nSaygılarımla.'

    const profile = addDocument(createEmptyProfile(), text)

    expect(profile.preferredTerms.some((p) => p.phrase === 'vekâlet ücreti')).toBe(true)
    expect(profile.stockPhrases.some((p) => p.phrase === 'saygılarımla')).toBe(true)
  })

  it('kimlik verisi içeren metinde profile giren örnek paragraflar maskelenmiş olur (değişmez kural)', () => {
    const text =
      'Sayın Hakimliğe.\n\n' +
      'Müvekkilim 10000000146 TC kimlik numaralı Ahmet Yılmaz, 0532 111 22 33 ' +
      'numaralı telefonundan ulaşılabilir ve talebi aşağıdaki gibidir.\n\nSaygılarımla.'

    const profile = addDocument(createEmptyProfile(), text)
    const stored = profile.sampleParagraphs.join('\n')

    expect(stored).not.toContain('10000000146')
    expect(stored).not.toContain('0532 111 22 33')
  })

  it('stdDev sıfır belgede 0 döner, çökmez', () => {
    expect(stdDev(createEmptyProfile().sentenceLength)).toBe(0)
  })
})

describe('selectFewShot (M8.5)', () => {
  const target = 'Kira sözleşmesi feshi nedeniyle tahliye talebi.'

  it('en benzer adayları benzerliğe göre sıralar', () => {
    const candidates: PetitionExample[] = [
      { id: 'kira', text: 'Kira sözleşmesi feshi ve tahliye talebi hakkında dilekçe.' },
      { id: 'boşanma', text: 'Anlaşmalı boşanma protokolü ve velayet talebi.' },
    ]

    const { examples } = selectFewShot(target, candidates)

    expect(examples[0]?.id).toBe('kira')
    expect(examples[0]?.similarity).toBeGreaterThan(examples[1]?.similarity ?? 0)
  })

  it('limit sayısını aşmaz', () => {
    const candidates: PetitionExample[] = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`,
      text: `Dilekçe metni ${i} kira tahliye`,
    }))

    const { examples } = selectFewShot(target, candidates, { limit: 2 })
    expect(examples).toHaveLength(2)
  })

  it('bağlam bütçesini (≤ 2.000 token) aşan adayı eler, küçük adaya devam eder', () => {
    const huge = 'kira '.repeat(3000) // ~15.000 karakter ≈ 3.750 token, bütçeyi aşar
    const small = 'Kira sözleşmesi feshi tahliye talebi kısa metin.'
    const candidates: PetitionExample[] = [
      { id: 'huge', text: huge },
      { id: 'small', text: small },
    ]

    const options: FewShotOptions = { tokenBudget: 2000, limit: 2 }
    const { examples, note, usedTokens } = selectFewShot(target, candidates, options)

    expect(examples.map((e) => e.id)).not.toContain('huge')
    expect(examples.map((e) => e.id)).toContain('small')
    expect(usedTokens).toBeLessThanOrEqual(2000)
    expect(note).toBeDefined()
  })

  it('aday yoksa boş sonuç döner', () => {
    const { examples, note } = selectFewShot(target, [])
    expect(examples).toEqual([])
    expect(note).toBeUndefined()
  })
})

describe('bölüm bölüm üretim (M8.7)', () => {
  const backend: WriteBackend = {
    id: 'test',
    runsLocally: true,
    generate: (prompt) => `ÜRETİLDİ: ${prompt.slice(0, 20)}`,
  }

  it('her bölüm bağımsız çağrıda yazılır, önceki bölümün metni prompt’a girmez', async () => {
    const prompts: string[] = []
    const spyBackend: WriteBackend = {
      id: 'spy',
      runsLocally: true,
      generate: (prompt) => {
        prompts.push(prompt)
        return `içerik-${prompts.length}`
      },
    }

    const sections: SectionSpec[] = [
      { heading: 'OLAYLAR', numbering: '1', facts: ['olgu-1'] },
      { heading: 'SONUÇ', numbering: '2', facts: ['olgu-2'] },
    ]

    const results = await writeStaged(sections, {}, spyBackend)

    expect(results.map((r) => r.content)).toEqual(['içerik-1', 'içerik-2'])
    // İkinci bölümün prompt'u birinci bölümün ürettiği içeriği TAŞIMAZ.
    expect(prompts[1]).not.toContain('içerik-1')
    expect(prompts[1]).toContain('olgu-2')
  })

  it('bağlam bütçesini aşan bölüm için hata fırlatır, sessizce kırpmaz', async () => {
    const spec: SectionSpec = {
      heading: 'DEV BÖLÜM',
      facts: Array.from({ length: 2000 }, (_, i) => `olgu-${i} çok uzun bir metin parçası`),
    }

    await expect(writeSection(spec, {}, backend)).rejects.toThrow(TokenBudgetExceededError)
  })
})

describe('checkConsistency (M8.7) — deterministik', () => {
  it('numaralandırma sırası bozulmuşsa yakalar', () => {
    const sections: SectionResult[] = [
      { heading: 'Giriş', numbering: '1', content: 'metin' },
      { heading: 'Atlanan', numbering: '3', content: 'metin' },
    ]

    const issues = checkConsistency(sections, { numberingScheme: 'arabic' })
    expect(issues.some((i) => i.kind === 'numbering')).toBe(true)
  })

  it('sıra doğruysa numbering hatası üretmez', () => {
    const sections: SectionResult[] = [
      { heading: 'Giriş', numbering: '1', content: 'metin' },
      { heading: 'Devam', numbering: '2', content: 'metin' },
    ]

    expect(checkConsistency(sections, { numberingScheme: 'arabic' })).toEqual([])
  })

  it('karışık atıf biçimini yakalar', () => {
    const sections: SectionResult[] = [
      { heading: 'Gerekçe', content: 'Yargıtay 2024/123 E. sayılı kararında...' },
      { heading: 'Devam', content: 'E. 2023/45 sayılı başka kararda...' },
    ]

    const issues = checkConsistency(sections)
    expect(issues.some((i) => i.kind === 'citation')).toBe(true)
  })

  it('üslup profilinin tercih ettiği terimden sapmayı yakalar', () => {
    let profile = createEmptyProfile()
    profile = addDocument(
      profile,
      'Davacı vekâlet ücreti talep etmektedir. Vekâlet ücreti yeniden hesaplanmalıdır.',
    )

    const sections: SectionResult[] = [
      { heading: 'Talep', content: 'Karşı taraf vekalet ücreti ödemekle yükümlüdür.' },
    ]

    const issues = checkConsistency(sections, { styleProfile: profile })
    expect(issues.some((i) => i.kind === 'terim')).toBe(true)
  })
})

describe('reviewSectionConsistency (M8.7) — bölüm özetleri tek pencerede', () => {
  it('tüm bölüm özetlerini TEK çağrıda backend’e verir', async () => {
    let receivedCount = 0
    const backend: ConsistencyReviewBackend = {
      id: 'test',
      runsLocally: true,
      review: (summaries) => {
        receivedCount = summaries.length
        return 'çelişki bulunamadı'
      },
    }

    const sections: SectionResult[] = [
      { heading: 'A', content: 'Birinci bölüm içeriği.' },
      { heading: 'B', content: 'İkinci bölüm içeriği.' },
    ]

    const review = await reviewSectionConsistency(sections, backend)

    expect(receivedCount).toBe(2)
    expect(review.report).toBe('çelişki bulunamadı')
  })

  it('özet bütçesini aşarsa hata fırlatır', async () => {
    const backend: ConsistencyReviewBackend = {
      id: 'test',
      runsLocally: true,
      review: () => 'ok',
    }
    const sections: SectionResult[] = Array.from({ length: 50 }, (_, i) => ({
      heading: `Bölüm ${i}`,
      content: 'x'.repeat(500),
    }))

    await expect(reviewSectionConsistency(sections, backend)).rejects.toThrow(
      TokenBudgetExceededError,
    )
  })
})

describe('estimateTokens', () => {
  it('boş metin için 0 döner', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('karakter sayısıyla orantılı büyür', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100)
  })
})
