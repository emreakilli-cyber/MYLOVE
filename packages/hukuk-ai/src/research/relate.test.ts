import { describe, expect, it } from 'vitest'
import { ContextBudgetError, estimateTokens, type LocalModel } from '../llm/types'
import type { ResearchDocument } from './client'
import { relateToCase, splitForBudget, summarizeDocument } from './relate'

/*
 * M7.6'nın asıl iddiası mimari: her aday karar KENDİ kısa geçişinde
 * değerlendirilir, tek bir uzun bağlam kurulmaz. Testler bunu çağrı sayısı ve
 * çağrı başına istem uzunluğu üzerinden doğruluyor.
 */

function fakeModel(
  reply: (prompt: string) => string,
  contextTokens = 4000,
): LocalModel & { prompts: string[] } {
  const prompts: string[] = []
  return {
    id: 'test',
    runsLocally: true,
    contextTokens,
    prompts,
    async generate({ prompt }) {
      prompts.push(prompt)
      return reply(prompt)
    },
  }
}

const facts = { summary: 'Kiracı tahliye taahhüdü verdi, sonra taahhüdü inkâr etti.' }

function doc(id: string, excerpt: string): ResearchDocument {
  return { id, title: `Karar ${id}`, excerpt }
}

const goodReply = JSON.stringify({
  ilgili: true,
  puan: 0.8,
  benzesen: ['tahliye taahhüdü'],
  ayrisan: ['kira bedeli'],
  not: 'Benzer olgu.',
})

describe('K bağımsız kısa geçiş (M7.6, A6)', () => {
  it('her karar için ayrı çağrı yapar, hepsini tek bağlama koymaz', async () => {
    const model = fakeModel(() => goodReply)
    const documents = [doc('1', 'kısa metin bir'), doc('2', 'kısa metin iki'), doc('3', 'üç')]

    const verdicts = await relateToCase(facts, documents, model)

    expect(verdicts).toHaveLength(3)
    expect(model.prompts).toHaveLength(3)
    // Hiçbir istem birden çok kararın metnini taşımıyor.
    for (const prompt of model.prompts) {
      const hits = ['kısa metin bir', 'kısa metin iki', 'üç'].filter((body) =>
        prompt.includes(body),
      )
      expect(hits).toHaveLength(1)
    }
  })

  it('ilerlemeyi bildirir', async () => {
    const model = fakeModel(() => goodReply)
    const seen: number[] = []

    await relateToCase(facts, [doc('1', 'a'), doc('2', 'b')], model, {
      onProgress: (done) => seen.push(done),
    })

    expect(seen).toEqual([1, 2])
  })

  it('bütçeyi aşan uzun kararı parçalar, hiçbir geçiş pencereyi aşmaz', async () => {
    const model = fakeModel(() => goodReply, 1200)
    const uzun = 'Karar metni. '.repeat(800)

    const verdicts = await relateToCase(facts, [doc('1', uzun)], model)

    expect(verdicts[0]?.passes).toBeGreaterThan(1)
    for (const prompt of model.prompts) {
      expect(estimateTokens(prompt) + 256).toBeLessThanOrEqual(1200)
    }
  })
})

describe('model çıktısı güvenilmez girdidir', () => {
  it('bozuk JSON çökertmez ve "ilgisiz" sayılmaz — karar verilemedi olur', async () => {
    const model = fakeModel(() => 'Tabii ki! İşte cevabım: ilgili olabilir.')
    const [verdict] = await relateToCase(facts, [doc('1', 'metin')], model)

    expect(verdict?.relevant).toBeUndefined()
    expect(verdict?.score).toBeUndefined()
    expect(verdict?.note).toContain('ayrıştırılamadı')
  })

  it('JSON etrafındaki fazladan metni tolere eder', async () => {
    const model = fakeModel(() => `İşte sonuç:\n${goodReply}\nUmarım yardımcı olur.`)
    const [verdict] = await relateToCase(facts, [doc('1', 'metin')], model)

    expect(verdict?.relevant).toBe(true)
    expect(verdict?.score).toBeCloseTo(0.8)
  })

  it('aralık dışı puanı sıkıştırır ve yanlış tipli alanı yok sayar', async () => {
    const model = fakeModel(() =>
      JSON.stringify({ ilgili: true, puan: 7, benzesen: 'dizi değil', not: 42 }),
    )
    const [verdict] = await relateToCase(facts, [doc('1', 'metin')], model)

    expect(verdict?.score).toBe(1)
    expect(verdict?.matching).toEqual([])
    expect(verdict?.note).toBe('')
  })

  it('parçalardan biri ilgili derse karar ilgilidir', async () => {
    let call = 0
    const model = fakeModel(() => {
      call += 1
      return JSON.stringify({ ilgili: call === 2, puan: call === 2 ? 0.9 : 0.1 })
    }, 1200)

    const [verdict] = await relateToCase(facts, [doc('1', 'Karar metni. '.repeat(800))], model)
    expect(verdict?.relevant).toBe(true)
    expect(verdict?.score).toBeCloseTo(0.9)
  })
})

describe('bütçe zorlaması (ContextBudgetError)', () => {
  it('olay özeti sınırı aşarsa sessizce kırpmaz, hata verir', async () => {
    const model = fakeModel(() => goodReply)
    const uzunOlay = { summary: 'a'.repeat(5000) }

    await expect(relateToCase(uzunOlay, [doc('1', 'metin')], model)).rejects.toThrow(RangeError)
  })

  it('pencere olay özeti için yetersizse hata verir', async () => {
    const model = fakeModel(() => goodReply, 100)
    await expect(relateToCase(facts, [doc('1', 'metin')], model)).rejects.toThrow(RangeError)
  })

  it('assertWithinBudget doğrudan aşımda fırlatır', async () => {
    const model = fakeModel(() => 'özet', 200)
    await expect(summarizeDocument(doc('1', 'x'.repeat(10_000)), model)).rejects.toThrow(
      ContextBudgetError,
    )
  })
})

describe('splitForBudget', () => {
  it('sığan metni bölmez', () => {
    expect(splitForBudget('kısa', 100)).toEqual(['kısa'])
  })

  it('böldüğü her parça bütçeye sığar', () => {
    const parts = splitForBudget('Cümle bir. Cümle iki. '.repeat(200), 60)
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(estimateTokens(part)).toBeLessThanOrEqual(60)
  })

  it('cümle sınırını tercih eder', () => {
    const parts = splitForBudget('Birinci cümle. İkinci cümle. Üçüncü cümle. '.repeat(20), 40)
    expect(parts[0]?.endsWith('.')).toBe(true)
  })
})

describe('özetleme (A5 kalıbı)', () => {
  it('sığan kararı tek geçişte özetler', async () => {
    const model = fakeModel(() => 'Kısa özet.')
    const summary = await summarizeDocument(doc('1', 'kısa karar metni'), model)

    expect(summary).toBe('Kısa özet.')
    expect(model.prompts).toHaveLength(1)
  })

  it('uzun kararda parça özetlerini ikinci geçişte birleştirir', async () => {
    const model = fakeModel((prompt) => (prompt.includes('Parça özeti') ? 'Nihai özet.' : 'Parça özeti.'), 1200)
    const summary = await summarizeDocument(doc('1', 'Karar metni. '.repeat(800)), model)

    expect(summary).toBe('Nihai özet.')
    expect(model.prompts.length).toBeGreaterThan(2)
  })
})
