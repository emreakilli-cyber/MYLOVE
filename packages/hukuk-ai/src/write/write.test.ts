import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  checkDocumentConsistency,
  checkNumberingConsistency,
  generateOutline,
  generateSections,
  type ConsistencyBackend,
  type GeneratedSection,
  type OutlineBackend,
  type SectionBackend,
  type SectionSummary,
} from './draft'
import { estimateTokens, selectFewShotExamples, type FewShotCandidate } from './fewshot'
import { extractStructure } from './structure'
import { extractStyleProfile, mergeStyleProfiles } from './style'

describe('ağ erişimi yasağı (M8.1)', () => {
  it('write/ altında hiçbir dosyada ağ API çağrısı yok', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/
    const directory = fileURLToPath(new URL('.', import.meta.url))
    const files: string[] = []
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (statSync(path).isFile() && name.endsWith('.ts') && !name.endsWith('.test.ts')) {
        files.push(path)
      }
    }
    expect(files.length).toBeGreaterThan(0)
    const offenders = files.filter((file) => network.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})

describe('yapı/iskelet çıkarma (M8.2)', () => {
  const PETITION = `İZMİR NÖBETÇİ ASLİYE HUKUK MAHKEMESİ'NE

DAVACI: [KISI_1]
DAVALI: [KISI_2]
KONU: Alacak talebidir.

AÇIKLAMALAR

1. Olaylar
Taraflar arasında imzalanan sözleşme gereği ödeme yapılmamıştır.

2. Hukuki Sebepler
2.1. Zamanaşımı
Zamanaşımı süresi henüz dolmamıştır.
2.2. Temerrüt
Davalı temerrüde düşmüştür.

SONUÇ VE İSTEM
Yukarıda açıklanan nedenlerle davanın kabulüne karar verilmesini arz ve talep ederim.
`

  it('başlıkları, sırayı ve baskın şemayı çıkarır', () => {
    const structure = extractStructure(PETITION)

    expect(structure.sectionOrder).toEqual([
      "İZMİR NÖBETÇİ ASLİYE HUKUK MAHKEMESİ'NE",
      'AÇIKLAMALAR',
      'Olaylar',
      'Hukuki Sebepler',
      'Zamanaşımı',
      'Temerrüt',
      'SONUÇ VE İSTEM',
    ])
  })

  it('noktalı Arap rakamlı başlıkların seviyesini nokta sayısından çıkarır', () => {
    const structure = extractStructure(PETITION)
    const zamanasimi = structure.headings.find((heading) => heading.text === 'Zamanaşımı')
    const olaylar = structure.headings.find((heading) => heading.text === 'Olaylar')

    expect(olaylar?.level).toBe(1)
    expect(zamanasimi?.level).toBe(2)
    expect(zamanasimi?.numbering).toBe('2.1')
  })

  it('Romen rakamlı bölümleri tanır', () => {
    const structure = extractStructure('I. GİRİŞ\nMetin.\nII. SONUÇ\nMetin.')
    expect(structure.headings.map((heading) => heading.numbering)).toEqual(['I', 'II'])
    expect(structure.numberingScheme).toBe('roman')
  })

  it('tanınmayan biçimi uydurmaz — başlıksız metinde başlık listesi boş kalır', () => {
    const structure = extractStructure('bu sıradan bir paragraf metnidir.\nikinci satır da öyle.')
    expect(structure.headings).toEqual([])
    expect(structure.numberingScheme).toBe('none')
  })
})

describe('üslup profili (M8.3, M8.4)', () => {
  const DOC_A =
    'Taraflar arasındaki sözleşme feshedilmiştir. Bu nedenle zarar doğmuştur.\n\n' +
    'Yukarıda açıklanan nedenlerle davanın kabulüne karar verilmesini arz ve talep ederim.\n\n' +
    'Saygılarımla arz ve talep ederim.'

  const DOC_B =
    'Davalı, TBK m. 112 uyarınca sorumludur. Yargıtay 3. HD bu yönde karar vermiştir.\n\n' +
    'Saygılarımla.'

  it('tek belgeden şema alanlarının tamamını dolu üretir', () => {
    const profile = extractStyleProfile(DOC_A)

    expect(profile.documentCount).toBe(1)
    expect(profile.sentenceLength.count).toBeGreaterThan(0)
    expect(profile.stockPhrases.some((entry) => entry.phrase.includes('açıklanan nedenlerle'))).toBe(
      true,
    )
    expect(profile.closings.some((entry) => entry.phrase === 'saygılarımla arz ve talep ederim')).toBe(
      true,
    )
  })

  it('atıf biçimini yakalar', () => {
    const profile = extractStyleProfile(DOC_B)
    const citationPhrases = profile.citationPatterns.map((entry) => entry.phrase)
    expect(citationPhrases.some((phrase) => phrase.startsWith('TBK'))).toBe(true)
    expect(citationPhrases.some((phrase) => phrase.startsWith('Yargıtay'))).toBe(true)
  })

  it('belge belge birleştirme, tek seferde bütün korpusu işlemekle aynı sayıma ulaşır (M8.4)', () => {
    const incremental = mergeStyleProfiles([extractStyleProfile(DOC_A), extractStyleProfile(DOC_B)])
    const combined = extractStyleProfile(`${DOC_A}\n\n${DOC_B}`)

    expect(incremental.documentCount).toBe(2)
    expect(incremental.sentenceLength.count).toBe(combined.sentenceLength.count)
    expect(incremental.sentenceLength.sum).toBe(combined.sentenceLength.sum)
    expect(incremental.closings.reduce((sum, entry) => sum + entry.count, 0)).toBe(
      combined.closings.reduce((sum, entry) => sum + entry.count, 0),
    )
  })

  it('birleştirme belge sırasından bağımsızdır', () => {
    const forward = mergeStyleProfiles([extractStyleProfile(DOC_A), extractStyleProfile(DOC_B)])
    const backward = mergeStyleProfiles([extractStyleProfile(DOC_B), extractStyleProfile(DOC_A)])

    expect(forward.sentenceLength.mean).toBeCloseTo(backward.sentenceLength.mean, 10)
    expect(forward.documentCount).toBe(backward.documentCount)
  })
})

describe('few-shot seçimi (M8.5)', () => {
  const candidates: FewShotCandidate[] = [
    { id: 'benzer', text: 'Kira bedeli ödenmemiştir. Tahliye talep edilmektedir. Kira sözleşmesi feshedilmiştir.' },
    { id: 'uzak', text: 'Trafik kazası sonucu araç hasarı oluşmuştur. Sigorta şirketi ödeme yapmamıştır.' },
    { id: 'orta', text: 'Sözleşme feshedilmiş, tahliye süreci başlamıştır.' },
  ]

  it('en benzer adayları benzerliğe göre azalan sırada seçer', () => {
    const selection = selectFewShotExamples('Kira sözleşmesi feshedildi, tahliye isteniyor.', candidates)

    expect(selection.examples[0]?.id).toBe('benzer')
    expect(selection.examples.map((example) => example.similarity)).toEqual(
      [...selection.examples.map((example) => example.similarity)].sort((a, b) => b - a),
    )
  })

  it('varsayılan olarak en çok 3 örnek döner (A8.5)', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      id: `k${index}`,
      text: 'kira tahliye sözleşme fesih ödeme',
    }))
    const selection = selectFewShotExamples('kira tahliye sözleşme', many)
    expect(selection.examples.length).toBeLessThanOrEqual(3)
  })

  it('bütçeyi aşan aday atlanır, daha küçük bir sonraki denenir', () => {
    const long = 'kira '.repeat(2000)
    const short: FewShotCandidate = { id: 'kisa', text: 'kira tahliye sözleşme' }
    const selection = selectFewShotExamples('kira tahliye', [{ id: 'uzun', text: long }, short], {
      maxTokens: 100,
    })

    expect(selection.examples.map((example) => example.id)).toEqual(['kisa'])
    expect(selection.totalEstimatedTokens).toBeLessThanOrEqual(100)
    expect(selection.excludedCount).toBe(1)
  })

  it('estimateTokens sözcük sayısıyla monoton artar', () => {
    expect(estimateTokens('bir iki üç')).toBeGreaterThan(estimateTokens('bir iki'))
    expect(estimateTokens('')).toBe(0)
  })
})

describe('aşamalı üretim (M8.7)', () => {
  it('iskelet üretimi backend’e devredilir', async () => {
    const backend: OutlineBackend = {
      generateOutline: (input) => ({
        documentType: input.documentType,
        sections: [{ id: 's1', heading: '1. Olaylar', factRefs: ['f1'] }],
      }),
    }

    const outline = await generateOutline({ documentType: 'istinaf', facts: ['f1'] }, backend)
    expect(outline.sections).toHaveLength(1)
  })

  it('her bölüm bağımsız üretilir — her çağrı yalnız kendi bölümünü alır', async () => {
    const outline = {
      documentType: 'istinaf',
      sections: [
        { id: 's1', heading: '1. Olaylar', factRefs: [] },
        { id: 's2', heading: '2. Hukuki Sebepler', factRefs: [] },
      ],
    }
    const receivedSections: unknown[] = []

    const backend: SectionBackend = {
      generateSection: (input) => {
        receivedSections.push(input.section)
        return `metin:${input.section.id}`
      },
    }

    const sections = await generateSections(outline, {}, backend)

    // Her çağrı tam olarak KENDİ bölümünü aldı — başka bölümün üretilmiş
    // metnini taşıyan bir alan imzada hiç yok (tip düzeyinde de yok).
    expect(receivedSections).toEqual(outline.sections)
    expect(sections).toEqual([
      { sectionId: 's1', heading: '1. Olaylar', text: 'metin:s1' },
      { sectionId: 's2', heading: '2. Hukuki Sebepler', text: 'metin:s2' },
    ])
  })

  it('tutarlılık geçişi yalnız özetleri görür, tam metin imzada yer almaz', async () => {
    const summaries: SectionSummary[] = [
      { sectionId: 's1', heading: '1. Olaylar', summary: 'kısa özet 1' },
      { sectionId: 's2', heading: '2. Hukuki Sebepler', summary: 'kısa özet 2' },
    ]
    let receivedKeys: string[] = []
    const backend: ConsistencyBackend = {
      checkConsistency: (input) => {
        receivedKeys = Object.keys(input[0] ?? {})
        return []
      },
    }

    await checkDocumentConsistency(summaries, backend)
    expect(receivedKeys).toEqual(['sectionId', 'heading', 'summary'])
    expect(receivedKeys).not.toContain('text')
  })

  it('numaralandırma tutarlılığını deterministik denetler (model yok)', () => {
    const sections: GeneratedSection[] = [
      { sectionId: 's1', heading: '1. Olaylar', text: '' },
      { sectionId: 's2', heading: '3. Hukuki Sebepler', text: '' },
    ]
    const issues = checkNumberingConsistency(sections)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.sectionIds).toEqual(['s2'])
  })

  it('sıralı numaralandırmada sorun bulmaz', () => {
    const sections: GeneratedSection[] = [
      { sectionId: 's1', heading: '1. Olaylar', text: '' },
      { sectionId: 's2', heading: '2. Hukuki Sebepler', text: '' },
    ]
    expect(checkNumberingConsistency(sections)).toEqual([])
  })

  it('numarasız (Romen/harf) başlıklarda sessizce atlar, yanlış pozitif üretmez', () => {
    const sections: GeneratedSection[] = [
      { sectionId: 's1', heading: 'I. GİRİŞ', text: '' },
      { sectionId: 's2', heading: 'SONUÇ', text: '' },
    ]
    expect(checkNumberingConsistency(sections)).toEqual([])
  })
})
