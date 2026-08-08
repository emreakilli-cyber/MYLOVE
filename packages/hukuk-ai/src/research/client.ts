/**
 * Araştırma katmanı — plan M7.
 *
 * `CAPABILITIES.md` A6: Yargıtay kararı ve mevzuat sorgulama. Bu, internete
 * çıkan TEK modüldür — ve çıkışı `MaskGuard` bekler (M7.2).
 *
 * Ağın kendisi burada uygulanmaz: `ResearchTransport` dışarıdan verilir.
 * Böylece paket ağ API'sine hiç dokunmaz, taşıma katmanı test edilebilir olur
 * ve "hangi modül ağa çıkabilir" sorusunun cevabı tek satırda görünür kalır.
 */

import { assertMasked, type GuardOptions } from './guard'

export type ResearchKind = 'yargitay' | 'mevzuat'

export interface ResearchQuery {
  /** MASKELENMİŞ sorgu metni. Ham metin verilirse kapı fırlatır. */
  readonly text: string
  readonly kind: ResearchKind
  readonly limit?: number
}

export interface ResearchDocument {
  readonly id: string
  readonly title: string
  readonly court?: string
  readonly date?: string
  readonly excerpt: string
}

/** Sonucun nereden geldiği — kullanıcıya gösterilir, gizlenmez. */
export type ResearchSource = 'network' | 'local' | 'unavailable'

export interface ResearchResponse {
  readonly documents: readonly ResearchDocument[]
  readonly source: ResearchSource
  /** Ağ denendi ve olmadıysa sebebi; kullanıcıya bilgi olarak gösterilir. */
  readonly note?: string
}

/** Ağa çıkan taşıma. Paketin dışında uygulanır. */
export interface ResearchTransport {
  search(query: ResearchQuery): Promise<readonly ResearchDocument[]>
}

/** Cihazdaki gömülü karar/mevzuat dizini — çevrimdışı cevabın kaynağı. */
export interface LocalResearchIndex {
  search(query: ResearchQuery): readonly ResearchDocument[] | Promise<readonly ResearchDocument[]>
}

export interface ResearchClientOptions extends GuardOptions {
  readonly transport?: ResearchTransport
  readonly localIndex?: LocalResearchIndex
}

export class ResearchClient {
  readonly #transport: ResearchTransport | undefined
  readonly #localIndex: LocalResearchIndex | undefined
  readonly #guard: GuardOptions

  constructor(options: ResearchClientOptions = {}) {
    this.#transport = options.transport
    this.#localIndex = options.localIndex
    this.#guard = options.ner ? { ner: options.ner } : {}
  }

  /**
   * Sorguyu çalıştırır.
   *
   * İLK İŞ kapıdır — taşıma katmanına, yerel dizine, hatta günlüğe hiçbir şey
   * gitmeden önce. Kapı fırlatırsa bu fonksiyondan hiçbir yan etki çıkmaz.
   */
  async search(query: ResearchQuery): Promise<ResearchResponse> {
    assertMasked(query.text, this.#guard)

    if (this.#transport) {
      try {
        const documents = await this.#transport.search(query)
        return { documents, source: 'network' }
      } catch (error) {
        const note = error instanceof Error ? error.message : 'Ağ hatası'
        return this.#fallback(query, note)
      }
    }

    return this.#fallback(query, 'Ağ taşıması tanımlı değil')
  }

  /** M7.7 — ağ yoksa yerel dizinden cevap; hata değil. */
  async #fallback(query: ResearchQuery, note: string): Promise<ResearchResponse> {
    if (!this.#localIndex) {
      return { documents: [], source: 'unavailable', note }
    }
    return {
      documents: await this.#localIndex.search(query),
      source: 'local',
      note,
    }
  }
}
