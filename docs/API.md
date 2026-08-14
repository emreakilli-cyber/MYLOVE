# API — `packages/hukuk-ai` genel yüzeyi

Plan M13.2–M13.5. Kaynak: `src/index.ts`. Bu dosyanın dışa açtığı her şey
buradadır; iç modüller (`overlap.ts`, `caseNo.ts`/`date.ts`/… tekil dedektör
dosyaları, `ner/index.ts`'in iç yardımcıları) buraya bilerek girmez — M13.1
gereği tek kapıdan geçilir.

Her bölüm ilgili SPEC/PROTOCOL/CAPABILITIES maddesine atıfla başlar. Örnekler
çalıştırılabilir TypeScript'tir, paket sıfır bağımlı olduğu için başka bir
import gerektirmezler (aksi belirtilmedikçe).

---

## 0. Kararlılık sözü (M13.5)

| Durum | Anlamı |
|---|---|
| **Kararlı** | `SPEC.md`/`PROTOCOL.md` ile bağlı; imza değişikliği o belgelerin `MAJOR` sürüm usulüne tabidir |
| **Deneysel** | Çalışır ve test edilir, ama imza plan ilerledikçe değişebilir (önce bu pakette `MINOR` sürüm notu düşülmeden de) |

| Modül | Durum | Gerekçe |
|---|---|---|
| `mask` / `unmask` / `MaskTable` / token / kural katmanı | **Kararlı** | SPEC S1–S7, `maskContractVersion` |
| `ResearchClient` / `MaskGuard` / `preflightCheck` | **Kararlı** | SPEC S3, PROTOCOL G2; M11 güvenlik davranışı |
| `MaskReview` | **Kararlı** | M6 API'si, `docs/SPEC.md` ile dolaylı bağlı (aynı değişmezler) |
| `shouldOfferHandoff` / `THRESHOLDS` | **Kararlı** | `CAPABILITIES.md` §C ile birebir |
| `summarizeDocuments` / `correlateWithCase` | Deneysel | M7.6 yeni tamamlandı; backend arayüzü gerçek bir model bağlanınca değişebilir |
| `write/*` (structure, style, fewshot, draft) | Deneysel | M8 yeni tamamlandı; üslup profili şeması ve backend arayüzleri ilk kullanımdan sonra ayarlanabilir |

---

## 1. Maskeleme — `docs/SPEC.md`

### `mask(input, options?) → MaskResult`

```ts
function mask(input: string, options?: MaskOptions): MaskResult

interface MaskOptions {
  table?: MaskTable        // var olan tabloya ekler (SPEC §4.2)
  maskDates?: boolean      // false ise TARIH maskelenmez (SPEC §7/8)
  ner?: NerBackend         // verilmezse yalnız kural katmanı çalışır
}

interface MaskResult {
  text: string
  table: MaskTable
  spans: readonly EntitySpan[]      // konumlar KAÇIŞLANMIŞ metne göre
  suspects: readonly SuspectSpan[]  // doğrulamadan geçemeyen adaylar (SPEC §7/3)
}
```

Fırlatmaz. Kural + (varsa) senkron NER katmanını sırayla koşar (S5), çakışmaları
çözer (§6.1), tabloyu doldurur. `maskContractVersion: 1.0.0`.

```ts
const { text, table } = mask('TC 10000000146 ile Ahmet Yılmaz başvurdu.')
// text  → "TC [TCKN_1] ile [KISI_1] başvurdu." (NER verilmediyse KISI yakalanmaz)
```

### `maskAsync(input, options?) → Promise<MaskResult>`

Aynı sözleşme, `ner` alanı `AsyncNerBackend`'i de kabul eder (cihaz içi model
çıkarımı eşzamansızdır, `MODEL.md` §3.1). Fırlatmaz.

### `unmask(text, table) → UnmaskResult`

```ts
function unmask(text: string, table: MaskTable): UnmaskResult
interface UnmaskResult {
  text: string
  unresolved: readonly string[]  // tabloda karşılığı olmayan token'lar (SPEC §5.1)
}
```

Fırlatmaz — bilinmeyen/bozuk token aynen bırakılır, `unresolved`'a yazılır.
`unresolved` boş değilse çağıran taraf kullanıcıyı uyarmalıdır (model token
uydurmuş olabilir).

```ts
const back = unmask(text, table)
back.text          // "TC 10000000146 ile [KISI_1] başvurdu." (KISI_1 hiç maskelenmediyse)
back.unresolved    // []
```

**Değişmez (S1):** `unmask(mask(x).text, mask(x).table).text === x`, istisnasız.

---

## 2. NER katmanı — `docs/SPEC.md` §5/6, `MODEL.md` §3.1

### `createDictionaryNerBackend(options?) → NerBackend`

```ts
function createDictionaryNerBackend(options?: DictionaryNerOptions): NerBackend
interface DictionaryNerOptions {
  people?: readonly string[]
  organizations?: readonly string[]
  workplaces?: readonly string[]
}
```

Model gerektirmeyen varsayılan uygulama (M3.3): cihazdaki kayıtlardan gelen
adlarla birebir eşleşme + unvan/kurum/işyeri/adres ipuçları (`Av.`, `A.Ş.`,
`Mah.` …). `NerBackend.runsLocally` her zaman `true`; ağ çağrısı **yapmaz**
(M3.6, testle doğrulanır). Fırlatmaz.

```ts
const ner = createDictionaryNerBackend({ people: ['Ahmet Yılmaz'] })
mask('Ahmet Yılmaz beyanda bulundu.', { ner }).text
// → "[KISI_1] beyanda bulundu."
```

### `freeRegions(textLength, taken) → readonly FreeRegion[]`

Kural katmanının dokunmadığı boşlukları hesaplar; kendi NER backend'inizi
yazarken `runNer`'ın bu adımı zaten yaptığını unutmayın — doğrudan çağırmak
nadiren gerekir. Fırlatmaz.

**Tip:** `NerBackend { id: string; runsLocally: true; detect(text, regions): readonly NerCandidate[] }`.
`AsyncNerBackend` aynısı, `detect` `Promise` döner.

---

## 3. Onay ekranı — `docs/SPEC.md` §6, plan M6

### `class MaskReview`

Saf veri API'si (arayüz bileşeni içermez, M6.7). Her müdahalede tabloyu
sıfırdan yeniden hesaplar (M6.6 tutarlılığı bu yüzden tanım gereği sağlanır).

```ts
new MaskReview(originalText: string, options?: MaskOptions)
```

| Üye | İmza | Fırlatır mı |
|---|---|---|
| `.sourceText` | `string` (getter) | — |
| `.maskedText` | `string` (getter) | — |
| `.table` | `MaskTable` (getter) | — |
| `.result` | `MaskResult` (getter) | — |
| `.listMasks()` | `→ readonly ReviewMask[]` | Hayır |
| `.addMask(range, type)` | `→ string` (token) | `MaskReviewError` — geçersiz aralık |
| `.linkToExisting(range, token)` | `→ void` | `MaskReviewError` — bilinmeyen token/geçersiz aralık |
| `.removeMask(token)` | `→ void` | `MaskReviewError` — bilinmeyen token |
| `.applyToAll(range, type)` | `→ string` (token) | `MaskReviewError` — geçersiz aralık |

`TextRange = { start: number; end: number }` — konumlar **`sourceText`**
(kaçışlanmış kaynak) üzerindedir; müdahaleler konumları kaydırmaz.

```ts
const review = new MaskReview('Ahmet Yılmaz geldi.')
const token = review.addMask({ start: 0, end: 12 }, 'KISI')
review.maskedText  // "[KISI_1] geldi."
review.removeMask(token)
review.maskedText  // "Ahmet Yılmaz geldi."
```

---

## 4. Maske tablosu — `docs/SPEC.md` §4/9, PROTOCOL §5.3

### `class MaskTable`

```ts
new MaskTable()
```

| Üye | İmza | Fırlatır mı |
|---|---|---|
| `.size` | `number` (getter) | — |
| `.tokenFor(type, key, surface, index)` | `→ string` | Hayır |
| `.surfaceAt(token, nth)` | `→ string \| undefined` | Hayır |
| `.lookup(token)` | `→ MaskEntry \| undefined` | Hayır |
| `.hasKey(type, key)` | `→ boolean` | Hayır |
| `.tokenOf(type, key)` | `→ string \| undefined` | Hayır |
| `.markAmbiguous(token, candidates?)` | `→ void` | Hayır |
| `.entries()` | `→ readonly MaskEntry[]` | Hayır |
| `.remove(token)` | `→ boolean` | Hayır |
| `.clear()` | `→ void` | Hayır |
| `.digest()` | `→ Promise<string>` (`sha256:…`) | Hayır |
| `.toJSON()` | `→ never` | **`MaskTableSerializationError`** — HER ZAMAN (SPEC S2) |
| `.exportEncrypted(passphrase, iterations?)` | `→ Promise<EncryptedMaskTable>` | `MaskTableSerializationError` — parola < 8 karakter |
| `MaskTable.importEncrypted(blob, passphrase)` *(static)* | `→ Promise<MaskTable>` | `MaskTableDecryptError` — biçim uyuşmuyor / parola yanlış / veri bozuk |

**KIRMIZI ÇİZGİ:** `JSON.stringify(table)` sessizce boş nesne üretmez —
`toJSON()` fırlatır. Tablonun ağa çıkabilen tek biçimi `digest()`.
`exportEncrypted`/`importEncrypted` çıktısı **cihazda saklanmak** içindir,
ağa gönderilmek için değildir (§9).

```ts
try {
  JSON.stringify(table)
} catch (error) {
  error instanceof MaskTableSerializationError  // true
}

const blob = await table.exportEncrypted('en-az-8-karakter')
const restored = await MaskTable.importEncrypted(blob, 'en-az-8-karakter')
```

### Token yardımcıları

| Fonksiyon | İmza | Fırlatır mı |
|---|---|---|
| `isMaskToken(candidate)` | `(string) → boolean` | Hayır |

---

## 5. Kural katmanı — `docs/SPEC.md` §2/6, plan M2

### `runRuleLayer(text, options?) → RuleResult`

```ts
function runRuleLayer(text: string, options?: RuleLayerOptions): RuleResult
interface RuleLayerOptions { maskDates?: boolean }
interface RuleResult {
  spans: readonly EntitySpan[]
  suspects: readonly SuspectSpan[]
}
```

Yedi dedektörü (TCKN, IBAN, TEL, EPOSTA, PLAKA, ESAS, TARIH) çalıştırır;
çakışma çözümü yapmaz — bu `mask()`'in işidir. Fırlatmaz. 150.000 karakterde
< 250 ms (M2.10, `package.test.ts` ile sürekli doğrulanır).

### Doğrulama yardımcıları

| Fonksiyon | İmza | Fırlatır mı | Not |
|---|---|---|---|
| `isValidTckn(value)` | `(string) → boolean` | Hayır | 10./11. hane algoritması |
| `isValidIban(raw)` | `(string) → boolean` | Hayır | mod-97; boşluklu/boşluksuz kabul eder |
| `normalizePhone(raw)` | `(string) → string \| undefined` | Hayır | 10 haneye normalleştirir; sabit hat (sıfırsız, alan kodu belirsiz) bilerek yakalanmaz — SORULAR.md S5 |

```ts
isValidTckn('10000000146')  // true
isValidIban('TR33 0006 1005 1978 6457 8413 26')  // true
normalizePhone('0532 111 22 33')  // "5321112233"
```

---

## 6. Araştırma katmanı — `CAPABILITIES.md` A6, plan M7

### `class ResearchClient`

```ts
new ResearchClient(options?: ResearchClientOptions)
interface ResearchClientOptions extends GuardOptions {
  transport?: ResearchTransport    // ağa çıkan taşıma — dışarıdan verilir
  localIndex?: LocalResearchIndex  // çevrimdışı cevap kaynağı
}
```

| Üye | İmza | Fırlatır mı |
|---|---|---|
| `.search(query)` | `→ Promise<ResearchResponse>` | **`UnmaskedContentError`** — sorgu maskelenmemişse (kapı `transport`/`localIndex`'ten ÖNCE çalışır) |

`transport` fırlatırsa (ağ hatası) `search` **fırlatmaz**, `localIndex`'e
düşer, o da yoksa `source: 'unavailable'` döner (M7.7 — ağ yoksa hata değil).

```ts
const client = new ResearchClient({ transport: myWssTransport })
const { documents, source } = await client.search({ text: mask(query).text, kind: 'yargitay' })
```

### `assertMasked(text, options?) → void` / `findUnmaskedContent(text, options?) → readonly GuardFinding[]`

```ts
function assertMasked(text: string, options?: GuardOptions): void          // fırlatır
function findUnmaskedContent(text: string, options?: GuardOptions): readonly GuardFinding[]  // fırlatmaz
```

`assertMasked` ağa çıkan HER yolun ilk çağırdığı fonksiyondur (M7.2). Kural
katmanını **ters yönde** koşar; `options.ner` verilmezse yalnız desenli
tipleri görür (SPEC §7/2 sınırı burada da geçerli). `GuardFinding.preview`
ham değeri **asla** taşımaz (`05••••••••33` biçiminde).

| Fırlatır | Ne zaman |
|---|---|
| `UnmaskedContentError` | `text` içinde en az bir maskelenmemiş kimlik verisi bulunursa. `.findings: readonly GuardFinding[]` |

```ts
assertMasked('TC 10000000146')  // throws UnmaskedContentError
assertMasked(mask('TC 10000000146').text)  // sessiz
```

### `summarizeDocuments(documents, backend) → Promise<readonly DocumentSummary[]>`

*(Deneysel, M7.6)* Her belgeyi backend'e **ayrı ayrı** verir; bir çağrı başka
belgenin metnini asla görmez. Fırlatmaz (backend fırlatırsa yayılır).

```ts
interface SummaryBackend { summarize(document: ResearchDocument): Promise<string> | string }
```

### `correlateWithCase(caseSummary, documents, backend, options?) → Promise<readonly CorrelationResult[]>`

*(Deneysel, M7.6)* Olay özetini ilk-K aday kararla **eşzamanlı ve bağımsız**
karşılaştırır (K bağımsız kısa geçiş, `CAPABILITIES.md` A6). Backend imzası
tek belge alır — dizi almaz; "uzun bağlam yok" kuralı tip düzeyinde kurulur.

```ts
interface CorrelationBackend {
  correlate(caseSummary: string, document: ResearchDocument): Promise<CorrelationVerdict> | CorrelationVerdict
}
interface CorrelateOptions extends GuardOptions { limit?: number }  // K
```

| Fırlatır | Ne zaman |
|---|---|
| `UnmaskedContentError` | `caseSummary` maskelenmemişse — M7.2 ile AYNI kapı |

```ts
const results = await correlateWithCase(mask(caseText).text, candidates, myBackend, { limit: 10 })
```

---

## 7. Kaçak kimlik yakalama — `docs/SPEC.md` §7/3, plan M11

### `preflightCheck(text, options) → PreflightResult`

```ts
function preflightCheck(text: string, options: PreflightOptions): PreflightResult
interface PreflightOptions extends MaskOptions { destination: 'local' | 'network' }
interface PreflightResult {
  clean: boolean
  entities: readonly PreflightEntity[]
  suspects: readonly SuspectSpan[]
  maskedPreview: MaskResult
  canSendUnmasked: boolean   // destination === 'network' ise HER ZAMAN false (M11.5)
}
```

Fırlatmaz. `MaskGuard`'ın (M7) yerine geçmez — ondan **önce** gelir; guard son
savunma hattıdır ve atlanamaz, preflight kullanıcıya nazik bir seçenek sunar.

```ts
const result = preflightCheck(userInput, { destination: 'network' })
if (!result.clean) {
  // result.canSendUnmasked === false → "maskesiz gönder" düğmesi HİÇ çizilmez
}
```

---

## 8. Türkçe çekim eki — `docs/SPEC.md` §4.1, plan M4

| Fonksiyon | İmza | Fırlatır mı |
|---|---|---|
| `nameKey(root)` | `(string) → string` | Hayır |
| `splitName(word, isKnownRoot?)` | `(string, fn?) → SplitName` | Hayır |

`nameKey` Türkçe kurala göre büyütür ve ünsüz yumuşamasını geri çevirir
(`Ahmet`/`Ahmed` → `AHMET`) — S6'nın (çekim birliği) eşleme anahtarı budur.
`splitName` bir sözcüğü kök + ek olarak ayırır; `isKnownRoot` verilmezse
yalnız kesme işaretli yazımı ayırır (kesmesiz ek soyma bilinen köke muhtaçtır,
M4.2).

```ts
splitName("Ahmet'in")  // { root: "Ahmet", suffix: "'in" } — önce ek ayrılır
nameKey('Ahmet')       // "AHMET"
nameKey('Ahmed')       // "AHMET" (yumuşama geri çevrilir — ikisi aynı anahtara düşer)
```

---

## 9. Varlık tipleri ve devir eşiği

### Tipler (`types/entities.ts`)

`ENTITY_TYPES` — SPEC §2'deki 11 kodun sabit dizisi. `TYPE_PRIORITY` —
çakışma eşitliğinde öncelik sırası (SPEC §6.1, küçük sayı önce). İkisi de
salt veridir, fonksiyon değildir.

### `shouldOfferHandoff(job, calibration, device?) → HandoffOutcome`

```ts
function shouldOfferHandoff(
  job: JobEstimate,
  calibration: DeviceCalibration,
  device?: DeviceState,
): HandoffOutcome
```

Fırlatmaz. `CAPABILITIES.md` §C eşiklerinin kod karşılığı. `calibration.measured
=== false` ise eşikler %50 gevşetilir (§C.0). Dönüş `{ kind: 'none' | 'offer' |
'postpone' | 'info', … }` — `'offer'` dışındakiler asla bir yetenek kaybı
anlamına gelmez (PROTOCOL G7).

```ts
shouldOfferHandoff(
  { foregroundWaitSeconds: 700, queueable: false },
  { measured: true },
)
// → { kind: 'offer', trigger: 'time', detail: '…' }
```

`THRESHOLDS` — §C özet tablosundaki ham sayılar (`foregroundWaitSeconds: 600`
vb.), salt veri.

---

## 10. Yazma katmanı — `CAPABILITIES.md` A8/A13, plan M8

*Tüm bu bölüm **deneysel**dir (M8 bu oturumda tamamlandı). İnternete çıkmaz
(M8.1) — hiçbir fonksiyon `fetch`/`WebSocket` vb. içermez, testle doğrulanır.*

### `extractStructure(document) → DocumentStructure`

```ts
function extractStructure(document: string): DocumentStructure
```

Fırlatmaz. Deterministiktir (model kullanmaz) — Romen rakamı, noktalı Arap
rakamı (`1.`, `1.2.`), harf listesi (`a)`), Türkçe sıra sayı sözcüğü
(`BİRİNCİ BÖLÜM`) ve bağımsız TAMAMI BÜYÜK HARF satırları tanır. `etiket:
değer` biçimindeki satırlar (`DAVACI: …`) başlık SAYILMAZ. Tanınmayan biçim
uydurulmaz, sessizce atlanır.

```ts
extractStructure(oldPetitionText).sectionOrder
// ["AÇIKLAMALAR", "Olaylar", "Hukuki Sebepler", "Zamanaşımı", "SONUÇ VE İSTEM"]
```

### `extractStyleProfile(document) → StyleProfile` / `mergeStyleProfiles(profiles) → StyleProfile` / `emptyStyleProfile() → StyleProfile`

```ts
function extractStyleProfile(document: string): StyleProfile          // documentCount: 1
function mergeStyleProfiles(profiles: readonly StyleProfile[]): StyleProfile
function emptyStyleProfile(): StyleProfile                            // documentCount: 0
```

Fırlatmaz. `StyleProfile` JSON'a serileştirilebilir (yalnız düz değer, sınıf
yok) — sayısal dağılımlar `{ count, sum, sumOfSquares, mean, stdev, histogram
}` biçiminde **yeterli istatistik** taşır, böylece iki profil ham metne
dönmeden doğru biçimde birleştirilebilir (M8.4). Histogram kovaları sabittir.

```ts
const profile = mergeStyleProfiles(oldPetitions.map(extractStyleProfile))
profile.documentCount        // kaç belgeden geldiği
profile.sentenceLength.mean  // ortalama cümle uzunluğu (sözcük)
profile.closings             // [{ phrase: 'saygılarımla arz ve talep ederim', count: 12 }, …]
```

### `estimateTokens(text) → number` / `selectFewShotExamples(targetText, candidates, options?) → FewShotSelection`

```ts
function estimateTokens(text: string): number
function selectFewShotExamples(
  targetText: string,
  candidates: readonly FewShotCandidate[],
  options?: FewShotOptions,   // { maxExamples?: number = 3; maxTokens?: number = 2000 }
): FewShotSelection
```

Fırlatmaz. Kosinüs benzerliği (sözcük çantası) ile sıralar; bütçeyi aşan
aday **atlanır**, sıradaki (daha küçük) aday denenmeye devam eder —
bütçe boşa harcanmaz. `estimateTokens` **kasıtlı olarak cömert** bir tahmindir
(gerçek tokenizasyon modele bağlıdır, bu paket model çalıştırmaz).

```ts
const selection = selectFewShotExamples(newCaseSummary, pastPetitions)
selection.examples.length          // ≤ 3
selection.totalEstimatedTokens     // ≤ 2000
selection.excludedCount            // bütçe/sayı yüzünden elenen aday sayısı
```

### `generateOutline(input, backend) → Promise<DocumentOutline>`

```ts
function generateOutline(input: OutlineInput, backend: OutlineBackend): Promise<DocumentOutline>
interface OutlineBackend { generateOutline(input: OutlineInput): Promise<DocumentOutline> | DocumentOutline }
```

İnce bir sarmalayıcıdır — model çağrısı `backend`'e aittir, bu fonksiyon
fırlatmaz (backend fırlatırsa yayılır). A13 aşama 1: iskelet.

### `generateSections(outline, context, backend) → Promise<readonly GeneratedSection[]>`

```ts
function generateSections(
  outline: DocumentOutline,
  context: SectionContext,     // { fewShotExamples?: {id,text}[] }
  backend: SectionBackend,     // generateSection(input: SectionGenerationInput) → string | Promise<string>
): Promise<readonly GeneratedSection[]>
```

A13 aşama 2: her bölüm **bağımsız** üretilir — `backend.generateSection`'a
her çağrıda yalnız TEK `section` gider, önceki bölümlerin üretilmiş metni
asla iletilmez (imza zaten dizi almaz). Fırlatmaz (backend fırlatırsa yayılır).

### `checkDocumentConsistency(summaries, backend) → Promise<readonly ConsistencyIssue[]>`

```ts
function checkDocumentConsistency(
  summaries: readonly SectionSummary[],  // { sectionId, heading, summary } — TAM METİN YOK
  backend: ConsistencyBackend,
): Promise<readonly ConsistencyIssue[]>
```

A13 aşama 3: tutarlılık geçişi yalnız **özetleri** görür — `SectionSummary`
tipinde `text` alanı hiç yok, tam metin bu arayüzden kaçak yoldan bile
geçemez. Fırlatmaz (backend fırlatırsa yayılır).

### `checkNumberingConsistency(sections) → readonly ConsistencyIssue[]`

```ts
function checkNumberingConsistency(sections: readonly GeneratedSection[]): readonly ConsistencyIssue[]
```

Fırlatmaz. Deterministiktir, model kullanmaz (A13.3: "numaralandırma …
deterministik denetlenir"). Yalnız noktalı Arap rakamı üst seviyesini
(`1.`, `2.`, …) denetler; sıra bozulursa `ConsistencyIssue` üretir. Başka
şema (Romen, harf) kullanan başlıklarda sessizce atlar — yanlış pozitif
üretmez.

```ts
const outline = await generateOutline({ documentType: 'istinaf', facts }, backend)
const sections = await generateSections(outline, { fewShotExamples }, sectionBackend)
checkNumberingConsistency(sections)  // []  → sıra doğru
```

---

## 11. Hata tipleri kataloğu (M13.3)

| Sınıf | Nereden | Ne zaman |
|---|---|---|
| `MaskReviewError` | `mask/review` | Geçersiz aralık, bilinmeyen token |
| `MaskTableSerializationError` | `mask/table` | `toJSON()` çağrısı (HER ZAMAN); `exportEncrypted` parola < 8 karakter |
| `MaskTableDecryptError` | `mask/table` | `importEncrypted` — biçim uyuşmuyor / parola yanlış / veri bozuk (ayırt edilmez) |
| `UnmaskedContentError` | `research/guard` | `assertMasked` / `ResearchClient.search` / `correlateWithCase` — maskelenmemiş metin |

Dördü de `Error`'dan türer, `name` alanı sınıf adıyla aynıdır. Hiçbiri ham
kimlik verisini `message`'a yazmaz (`UnmaskedContentError.findings[].preview`
maskeli önizlemedir).

`write/*` ve `research.summarize` içindeki backend arayüzleri (`OutlineBackend`,
`SectionBackend`, `ConsistencyBackend`, `SummaryBackend`, `CorrelationBackend`,
`ResearchTransport`) kendi hatalarını fırlatabilir — bu paket onları
**yakalamaz**, olduğu gibi çağırana yayar. İstisna: `ResearchClient.search`
yalnız `transport` hatasını `local`/`unavailable`'a düşürür (M7.7); guard
hatası (`UnmaskedContentError`) bu yutmaya dahil DEĞİLDİR, her zaman fırlar.

---

## 12. Çapraz bağlar (M13.4)

- **`docs/SPEC.md`** — maskeleme sözleşmesi (S1–S7); §1–8 burada §1, §2, §4, §8
  bölümleriyle birebir örtüşür.
- **`docs/PROTOCOL.md`** — telefon↔masaüstü devir sözleşmesi (G1–G7);
  `maskEvidence.maskTableHash` = `MaskTable.digest()`'in taşıdığı değer.
- **`docs/CAPABILITIES.md`** — §A6 = §6 (araştırma), §A8/A13 = §10 (yazma), §C
  = §9 (`shouldOfferHandoff`).
- **`docs/MODEL.md`** — §3.1 NER/üretim model kararı; bu dosyadaki hiçbir
  fonksiyon belirli bir modele bağlı değildir (backend'ler dışarıdan gelir).
- **`docs/QUESTIONS.md`** — S1–S7 kod kararlarının gerekçesi; özellikle S5
  (`normalizePhone`), S6 (çakışma önceliği), S4 (`maskDates` varsayılanı).
