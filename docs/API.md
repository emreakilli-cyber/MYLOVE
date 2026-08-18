# API — `packages/hukuk-ai` genel yüzeyi

Plan M13. Bu paketin dışa açılan **tek** yüzeyi `src/index.ts`'tir (M13.1);
iç modüller (`mask/rules/*`, `mask/ner/*`'nin uygulama detayları, `mask/overlap.ts`
gibi) buradan dışarı sızmaz. Bu belge, `index.ts`'in dışa aktardığı her
fonksiyonu, sınıfı ve tipini kapsar — ne fazlası ne eksiği.

Çapraz bağlar: davranışın **neden** böyle olduğu `docs/SPEC.md` (maskeleme
sözleşmesi) ve `docs/PROTOCOL.md`'de (telefon↔masaüstü) yazılıdır; bu belge
yalnız **imza düzeyinde** ne çağrılacağını anlatır. Her bölüm ilgili
SPEC/PROTOCOL/CAPABILITIES maddesine atıf yapar.

---

## 0. Kararlılık sözü (M13.5)

| Modül | Durum | Gerekçe |
|---|---|---|
| `mask/*` (mask, unmask, MaskTable, token, rules, review, preflight) | **Kararlı** | M1–M6, M11, M12'nin tamamı; özellik temelli birebirlik testi (M12.1) dâhil kapsamlı test seti |
| `turkish/suffix.ts` | **Kararlı** | M4'ün tamamı, `mask`/`review`'in temel bağımlılığı |
| `research/client.ts`, `research/guard.ts` | **Kararlı** | M7.1–M7.5, M7.7 tamam; ağ sınırının tek kapısı, güvenlik yüzeyi |
| `research/summarize.ts` | **Deneysel** | M7.6 bu oturumda eklendi; gerçek bir cihaz içi backend'e karşı henüz doğrulanmadı |
| `write/*` (skeleton, style, fewshot, generate) | **Deneysel** | M8 bu oturumda eklendi; sezgisel (regex/n-gram tabanlı) çıkarım gerçek dilekçe korpusuyla henüz kalibre edilmedi |
| `handoff/threshold.ts` | **Kararlı** | M12.9 sınır değeri testleriyle doğrulandı |

**Deneysel** işareti "çalışmaz" anlamına gelmez — tip imzaları ve testleri
vardır (bu belgedeki her fonksiyon test edilmiştir). Anlamı: davranışı henüz
gerçek veriyle kalibre edilmedi, bu yüzden `MAJOR` olmayan bir sürümde
sezgisel eşikler (n-gram sayısı, bağlam bütçesi) ayarlanabilir. **Kararlı**
işaretli API'lerin imzası ve dış davranışı `SPEC.md`/`PROTOCOL.md`
değişmezlerine bağlıdır ve aynı disiplinle korunur (S1–S7, G1–G7).

---

## 1. Maskeleme — `mask`, `maskAsync`, `unmask`

`docs/SPEC.md` §3–§6.

### `mask(input: string, options?: MaskOptions): MaskResult`

Metni maskeler: kaçışlama → kural katmanı → (varsa) NER katmanı → çakışma
çözümü → token değiştirme (SPEC §6).

**Parametreler**
- `input` — ham metin.
- `options.table?: MaskTable` — var olan tabloya eklemek için (aynı dosyanın
  birden çok belgesinde kişi kimliğinin tutarlı kalması için, SPEC §4.2).
  Verilmezse yeni ve boş bir `MaskTable` oluşturulur.
- `options.maskDates?: boolean` — `false` verilirse tarih maskelenmez
  (SPEC §7/8). Varsayılan `true`.
- `options.ner?: NerBackend` — eşzamanlı NER backend'i. Verilmezse yalnız
  kural katmanı çalışır (SPEC §7/2).

**Döner:** `MaskResult` — `{ text, table, spans, suspects }`.

**Fırlatır:** Hiçbir zaman fırlatmaz. Kural katmanı doğrulaması geçmeyen
adaylar `suspects`'e düşer, `mask()` yine de tamamlanır (SPEC §7/3).

**Örnek**
```ts
import { mask, unmask } from 'hukuk-ai'

const result = mask('Müvekkil Ahmet Yılmaz, TC 10000000146.')
// result.text === 'Müvekkil [KISI_1], TC [TCKN_1].'
const back = unmask(result.text, result.table)
// back.text === 'Müvekkil Ahmet Yılmaz, TC 10000000146.'
```

### `maskAsync(input: string, options?: MaskAsyncOptions): Promise<MaskResult>`

`mask` ile aynı davranış; `options.ner` hem `NerBackend` hem `AsyncNerBackend`
kabul eder (`MODEL.md` §3.1 — cihaz içi model çıkarımı eşzamansızdır).

**Fırlatır:** `options.ner.detect()` reddederse o reddi yansıtır; kendisi
başka bir hata üretmez.

### `unmask(text: string, table: MaskTable): UnmaskResult`

Token'ları ham metne geri çevirir. Aynı token'ın n'inci geçişi, tabloya
kaydedilmiş n'inci ham yazımla değiştirilir (SPEC §4.1 — farklı yazımlar aynı
token'a düşer ama her biri kendi yazımıyla geri döner).

**Döner:** `UnmaskResult` — `{ text, unresolved }`. `unresolved`, tabloda
karşılığı olmayan token'ların listesidir (SPEC §5.1) — model uydurmuş
olabilir. **Boş değilse çağıran taraf kullanıcıyı uyarmalıdır**, `unmask`
kendisi uyarmaz.

**Fırlatır:** Hiçbir zaman. Bozuk/bilinmeyen token'lar aynen bırakılır.

**Örnek — bozuk token**
```ts
const { text, unresolved } = unmask('Bkz. [KISI_1] ve [KISI_99]', table)
// [KISI_99] tabloda yoksa aynen kalır; unresolved === ['[KISI_99]']
```

### İlgili tipler

| Tip | Alanlar |
|---|---|
| `MaskOptions` | `table?`, `maskDates?`, `ner?` |
| `MaskAsyncOptions` | `MaskOptions`'ın `ner` hariç aynısı + `ner?: NerBackend \| AsyncNerBackend` |
| `MaskResult` | `text`, `table: MaskTable`, `spans: readonly EntitySpan[]`, `suspects: readonly SuspectSpan[]` |
| `UnmaskResult` | `text`, `unresolved: readonly string[]` |

---

## 2. Maske tablosu — `MaskTable`

`docs/SPEC.md` §4, §9; `docs/PROTOCOL.md` G1.

`MaskTable`, gerçek değer ↔ maske token eşlemesini tutar. **Kırmızı çizgi:**
bu sınıf hiçbir koşulda düz metin olarak ağa çıkamaz — `toJSON()` bilerek
fırlatır, ağa çıkabilen tek biçim `digest()`'in özetidir.

### Örnekler oluşturma

`new MaskTable()` — boş tablo. Genelde doğrudan çağrılmaz; `mask()` kendi
tablosunu üretir ya da `options.table` ile var olanı kullanır.

### Sorgu metodları

| Metot | İmza | Açıklama |
|---|---|---|
| `size` (getter) | `number` | Kayıt sayısı |
| `tokenFor` | `(type: EntityType, key: string, surface: string, index: number) => string` | Anahtar için token üretir/döner; kural+NER katmanının iç kullanımıdır, doğrudan çağrı nadirdir |
| `surfaceAt` | `(token: string, nth: number) => string \| undefined` | Token'ın n'inci (0 tabanlı) geçişinin ham yazımı; kayıt dışına taşarsa kanonik yazıma döner |
| `lookup` | `(token: string) => MaskEntry \| undefined` | Token'dan kayda |
| `hasKey` | `(type: EntityType, key: string) => boolean` | Anahtar zaten var mı |
| `tokenOf` | `(type: EntityType, key: string) => string \| undefined` | Anahtardan token'a |
| `entries` | `() => readonly MaskEntry[]` | Tüm kayıtlar, ilk görülme sırasına göre (onay ekranı M6.1'in temelidir) |

### Değiştirme metodları

| Metot | İmza | Açıklama |
|---|---|---|
| `markAmbiguous` | `(token: string, candidates?: readonly string[]) => void` | Belirsiz işaretle (SPEC §7/7); geri alınamaz |
| `remove` | `(token: string) => boolean` | Kaydı kaldırır; numara yeniden kullanılmaz |
| `clear` | `() => void` | Tüm kayıtları siler (oturum sonu, M5.7) |

### Ağa çıkabilen tek biçim

**`digest(): Promise<string>`** — kanonik gösterimin SHA-256 özetini
`sha256:...` biçiminde döner (`PROTOCOL.md` §5.3 `maskTableHash`). Tablonun
kendisi hiçbir noktada bu fonksiyonun dışına sızmaz.

**`toJSON(): never`** — çağrılırsa **her zaman** `MaskTableSerializationError`
fırlatır. `JSON.stringify(table)` bu yüzden sessizce boş nesne üretmez,
gürültüyle patlar (SPEC S2).

### Kalıcı (şifreli) saklama

`docs/SPEC.md` §9 — yalnız çok oturumlu işler için, yalnız şifreli.

**`exportEncrypted(passphrase: string, iterations = 310_000): Promise<EncryptedMaskTable>`**
- **Fırlatır:** `passphrase.length < 8` ise `MaskTableSerializationError`.
- PBKDF2-SHA256 (varsayılan 310.000 tur) + AES-GCM 256.

**`static importEncrypted(blob: EncryptedMaskTable, passphrase: string): Promise<MaskTable>`**
- **Fırlatır:** `blob.format` uyuşmuyorsa veya parola yanlış/veri
  bozuksa `MaskTableDecryptError`. **İkisi ayırt edilemez** (AES-GCM kimlik
  doğrulaması) — bu kasıtlıdır.

**Örnek**
```ts
const blob = await table.exportEncrypted('en-az-8-karakter')
// blob CİHAZDA saklanır — ağa gönderilmez (G1 hâlâ geçerli)
const restored = await MaskTable.importEncrypted(blob, 'en-az-8-karakter')
```

### İlgili tipler ve hatalar

| Ad | Tür | Alanlar / anlam |
|---|---|---|
| `MaskEntry` | arayüz | `token`, `type`, `key`, `canonical`, `occurrenceCount`, `surfaceForms`, `firstIndex`, `ambiguous`, `candidates` |
| `Occurrence` | arayüz | `text`, `index` — tabloya kaydedilen tek geçiş |
| `EncryptedMaskTable` | arayüz | `format`, `iterations`, `salt`, `iv`, `ciphertext` (hepsi base64/sabit) |
| `MASK_TABLE_FORMAT` | sabit dize | `'hukuk-ai.masktable.v1'` |
| `MaskTableSerializationError` | hata sınıfı | `toJSON()` çağrısı veya kısa parola |
| `MaskTableDecryptError` | hata sınıfı | Bilinmeyen biçim veya yanlış parola/bozuk veri |

---

## 3. Maske token'ları — `isMaskToken`

`docs/SPEC.md` §3.1.

### `isMaskToken(candidate: string): boolean`

Bir dizgenin gerçek bir maske token'ı biçimine (`[TIP_N]`, `N` 1'den başlayan
ondalık) uyup uymadığını kontrol eder. Kaçışlanmış (`[!KISI_1]`) veya bozuk
(`[KISI_0]`, `[kisi_1]`) dizgeler için `false` döner.

**Fırlatır:** Hiçbir zaman.

---

## 4. Kural katmanı — desen tabanlı dedektörler

`docs/SPEC.md` §2, M2.

### `runRuleLayer(text: string, options?: RuleLayerOptions): RuleResult`

Tüm kural dedektörlerini (TCKN, IBAN, telefon, e-posta, plaka, esas/karar no,
isteğe bağlı tarih) sırayla koşturur ve sonuçları birleştirir. **Çakışma
çözümü burada yapılmaz** — `mask()` içinde NER sonuçlarıyla birlikte tek
elden yapılır (SPEC §6).

- `options.maskDates?: boolean` — `false` ise `TARIH` dedektörü hiç koşmaz.
- **Döner:** `RuleResult` — `{ spans: readonly EntitySpan[], suspects: readonly SuspectSpan[] }`.
- **Fırlatır:** Hiçbir zaman.

### `isValidTckn(value: string): boolean` / `isValidIban(value: string): boolean`

TCKN'nin resmî 10./11. hane algoritmasını, IBAN'ın mod-97 sağlamasını
uygular. Yalnız rakam/harften oluşan normalize edilmiş girdi beklenir —
boşluklu yazım kendiliğinden geçmez, önce `digitsOnly`/boşluk temizliği
gerekir (kural katmanı bunu kendi içinde yapar).

### `normalizePhone(raw: string): string | undefined`

Ülke kodu / baştaki sıfırı soyar, 10 haneli gövdeyi döner. Geçerli bir Türk
alan kodu (`2`, `3`, `4`, `5` ile başlayan) değilse `undefined`.

**Bilinen sınır (SPEC §7):** sıfırsız sabit hat (`212 444 55 66`)
**bilerek** yakalanmaz — herhangi bir on haneli sayıdan (tutar, sicil no)
ayırt edilemediği için yanlış pozitif riski, kaçırılan bir telefondan
daha zararlı sayılmıştır (`QUESTIONS.md` S5).

### İlgili tipler

`RuleLayerOptions` — `{ maskDates?: boolean }`.
`RuleResult` — `{ spans: readonly EntitySpan[], suspects: readonly SuspectSpan[] }`.
`RuleDetector` — `(text: string) => RuleResult` (tek bir dedektörün imzası;
özel dedektör yazmak isteyenler için referans tip).

---

## 5. NER katmanı — `createDictionaryNerBackend`, `freeRegions`

`docs/SPEC.md` §2, M3; `docs/MODEL.md` §3.1.

### `createDictionaryNerBackend(options?: DictionaryNerOptions): NerBackend`

Modelsiz varsayılan NER uygulaması. Cihazdaki kayıtlardan gelen bilinen
adları (`options.people`, `.organizations`, `.workplaces`) birebir + çekim
ekli biçimleriyle arar; ayrıca unvan (`Av.`, `Dr.`), kurum (`A.Ş.`,
`Ltd. Şti.`), işyeri (`AVM`, `Plaza`) ve adres (`Mah.`, `Sok.`, `No:`)
ipuçlarıyla aday üretir.

**Bilinen sınır (SPEC §7/2):** ipucu taşımayan çıplak bir özel ad (ne bilinen
listede ne unvan/kurum eki yanında) yakalanmaz. Bu, sözlük tabanlı katmanın
yapısal sınırıdır; model tabanlı bir `NerBackend` uygulaması bunu kapatabilir.

**Fırlatır:** Hiçbir zaman. `runsLocally: true` alanı tip düzeyinde ağ
yasağını zorlar (M3.6) — bu alanı `false` yapan bir uygulama derlenmez.

### `freeRegions(textLength: number, taken: readonly {start,end}[]): readonly FreeRegion[]`

Kural katmanının dokunmadığı boşlukları hesaplar. NER, yalnız bu bölgelerde
çalışır (S5) — kendi `NerBackend`'inizi yazarken bu fonksiyonu doğrudan
çağırmanız gerekmez, `mask()`/`maskAsync()` zaten kullanır; özel bir çalıştırma
hattı kuruyorsanız faydalıdır.

### İlgili tipler

| Tip | Anlam |
|---|---|
| `NerBackend` | `{ id: string, runsLocally: true, detect(text, regions): readonly NerCandidate[] }` |
| `AsyncNerBackend` | Aynısı, `detect` bir `Promise` döner |
| `NerCandidate` | `{ start, end, type: NerEntityType, confidence, key?, ambiguous?, candidates? }` |
| `NerEntityType` | `'KISI' \| 'KURUM' \| 'ADRES' \| 'ISYERI'` |
| `FreeRegion` | `{ start, end }` |
| `DictionaryNerOptions` | `{ people?, organizations?, workplaces? }` (üçü de `readonly string[]`) |

**Kendi `NerBackend`'inizi yazmak** için: `detect(text, regions)` yalnız
`regions` içindeki aralıklarla kesişen adaylar döndürmelidir — kesişmeyenler
zaten `mask()` tarafından atılır (`SPEC.md` S5 zorlayıcı kontrolü,
`mask/ner/index.ts`), ama gereksiz hesaplamadan kaçınmak için backend'in
kendisi de `regions` dışına aday üretmemelidir.

---

## 6. Onay ekranı — `MaskReview`

Plan M6. Saf veri API'sidir; arayüz bileşeni içermez (M6.7).

### `new MaskReview(originalText: string, options?: MaskOptions)`

Metni hemen maskeler (`get result`); sonraki her müdahalede **baştan**
yeniden hesaplar (bkz. dosya başındaki gerekçe — numaralandırma ve
birebirlik tutarlılığı, M6.6).

### Getter'lar

| Getter | Tür | Anlam |
|---|---|---|
| `sourceText` | `string` | Kaçışlanmış kaynak metin — tüm aralıklar buna göredir |
| `maskedText` | `string` | Güncel maskelenmiş metin |
| `table` | `MaskTable` | Güncel tablo |
| `result` | `MaskResult` | Güncel tam sonuç |

### Metodlar

| Metot | İmza | Plan | Açıklama |
|---|---|---|---|
| `listMasks` | `() => readonly ReviewMask[]` | M6.1 | İlk geçiş sırasına göre maske listesi; her kayıt hangi katmanın bulduğunu (`layer`) ve güvenini taşır |
| `addMask` | `(range: TextRange, type: EntityType) => string` | M6.2 | Elle maske ekler, üretilen token'ı döner |
| `linkToExisting` | `(range: TextRange, token: string) => void` | M6.3 | Seçili aralığı var olan bir maskeye bağlar |
| `removeMask` | `(token: string) => void` | M6.4 | Maskeyi kaldırır (varlık kimliğiyle bastırılır, token'la değil) |
| `applyToAll` | `(range: TextRange, type: EntityType) => string` | M6.5 | Kökün TÜM geçişlerini (çekim ekli biçimler dâhil) aynı maskeye bağlar |

**Fırlatır (hepsi `MaskReviewError`):**
- `addMask`/`applyToAll`/`linkToExisting`/`removeMask`: `range` sınır dışıysa,
  ters/sıfır uzunluklu ise, ya da tamsayı değilse.
- `linkToExisting`/`removeMask`: `token` tabloda yoksa.

**Örnek**
```ts
const review = new MaskReview('Yılmaz beyanda bulundu.')
const [entry] = review.listMasks()
// entry.ambiguous true olabilir — birden çok "Yılmaz" kayıtlıysa
review.linkToExisting({ start: 0, end: 6 }, '[KISI_2]')
```

### İlgili tipler

`TextRange` — `{ start: number, end: number }` (yarı açık aralık, `sourceText`
üzerinde).
`ReviewMask` — `MaskEntry & { layer: EntitySpan['layer'], confidence: number }`.
`MaskReviewError` — `name: 'MaskReviewError'`.

---

## 7. Kaçak kimlik yakalama — `preflightCheck`

Plan M11.

### `preflightCheck(text: string, options: PreflightOptions): PreflightResult`

Gönderim düğmesine basılmadan **önce** çalışır; kullanıcı onay ekranını
atlayıp doğrudan serbest metin yazdıysa kimlik verisini yakalar. `MaskGuard`
(§8) ile aynı iş değildir — bu, atlanabilir kibar bir kapı; guard atlanamaz
son savunma hattıdır.

**Parametreler:** `options` = `MaskOptions & { destination: 'local' | 'network' }`.

**Döner:** `PreflightResult`:
- `clean: boolean` — hiç varlık/şüpheli yoksa `true`.
- `entities: readonly PreflightEntity[]` — bulunan her varlık için tip,
  konum, ham metin, önerilen token, güven.
- `suspects: readonly SuspectSpan[]` — doğrulamadan geçemeyen adaylar
  (SPEC §7/3), sessizce yutulmaz.
- `maskedPreview: MaskResult` — "maskele ve gönder" seçilirse gidecek metin.
- `canSendUnmasked: boolean` — **`destination: 'network'` ise HER ZAMAN
  `false`** (M11.5). Arayüz bu bayrağa bakıp "maskesiz gönder" düğmesini hiç
  çizmemelidir.

**Fırlatır:** Hiçbir zaman.

---

## 8. Araştırma katmanı — `ResearchClient`

`docs/CAPABILITIES.md` A6; `docs/SPEC.md` S3. **Bu paketin ağa çıkan tek
modülüdür.**

### `new ResearchClient(options?: ResearchClientOptions)`

`options`:
- `transport?: ResearchTransport` — ağa çıkan taşıma (`search(query)`); paket
  bunu kendisi uygulamaz, dışarıdan verilir.
- `localIndex?: LocalResearchIndex` — çevrimdışı/ağ hatası düşüşü.
- `ner?: NerBackend` — kapının (§9) ad/kurum/adres de denetlemesi için.

### `search(query: ResearchQuery): Promise<ResearchResponse>`

`query = { text, kind: 'yargitay' | 'mevzuat', limit? }`. **İlk iş kapıdır**
(`assertMasked`) — taşımaya, yerel dizine, günlüğe hiçbir şey gitmeden önce
çalışır.

**Akış:**
1. `assertMasked(query.text)` geçmezse → `UnmaskedContentError`, **hiçbir yan
   etki oluşmaz** (SPEC S3).
2. `transport` varsa → çağrılır; başarılı olursa `{ documents, source: 'network' }`.
3. `transport` yoksa veya reddederse → `localIndex` varsa `{ documents, source: 'local', note }`,
   yoksa `{ documents: [], source: 'unavailable', note }`. **Hiçbir dalda hata fırlatmaz** (M7.7).

**Fırlatır:** Yalnız 1. adımda, `UnmaskedContentError`.

**Örnek**
```ts
const client = new ResearchClient({ transport: myWssTransport })
const { text } = mask('Müvekkilin kira sözleşmesi feshi talebi')
const response = await client.search({ text, kind: 'yargitay', limit: 10 })
```

### İlgili tipler

`ResearchQuery`, `ResearchDocument`, `ResearchResponse`, `ResearchSource`
(`'network' | 'local' | 'unavailable'`), `ResearchKind`
(`'yargitay' | 'mevzuat'`), `ResearchTransport`, `LocalResearchIndex`,
`ResearchClientOptions`.

---

## 9. `MaskGuard` — ağ kapısı

Plan M7.2/M7.3. `research/guard.ts`.

### `assertMasked(text: string, options?: GuardOptions): void`

Kural katmanını (ve varsa `options.ner`'i) **ters yönde** koşar: metinde
maskelenmemiş kimlik verisi kalıntısı varsa fırlatır. `ResearchClient.search`
her çağrıda bunu otomatik çağırır; doğrudan çağırmak, kendi ağ yolunuzu
yazıyorsanız gereklidir.

**Fırlatır:** `UnmaskedContentError` — bulgu varsa. Yoksa sessizdir.

### `findUnmaskedContent(text: string, options?: GuardOptions): readonly GuardFinding[]`

Aynı taramayı yapar ama fırlatmaz, bulguları döner. `assertMasked`'in
temelidir; arayüz katmanı "hangi tipler bulundu" göstermek isterse kullanılır.

**Döner:** Her `GuardFinding` `{ type, start, end, preview }` — `preview`
ham değeri **taşımaz** (`05••••••••33` gibi), hata nesnesi de sızıntı yüzeyi
sayılır.

### `UnmaskedContentError`

`.findings: readonly GuardFinding[]`. Mesaj bulunan **tipleri** listeler,
**ham değerleri asla içermez**.

### İlgili tipler

`GuardOptions` — `{ ner?: NerBackend }`. `GuardFinding` — yukarıda.

---

## 10. Sonuç özetleme ve olayla ilişkilendirme

Plan M7.6, `CAPABILITIES.md` A6. **Deneysel** (bkz. §0).

### `summarizeDocument(document: ResearchDocument, backend: SummaryBackend): Promise<string>`
### `summarizeDocuments(documents: readonly ResearchDocument[], backend: SummaryBackend): Promise<readonly DocumentSummary[]>`

Her belge **bağımsız** özetlenir; hiçbiri diğerinin metnini görmez.

### `correlateDocuments(caseSummary: string, documents: readonly ResearchDocument[], backend: CorrelationBackend): Promise<readonly DocumentCorrelation[]>`

İlk-K aday kararı olay özetiyle ilişkilendirir. Her karar **kendi bağımsız
geçişinde** değerlendirilir — backend'e yalnız `(caseSummary, tek belge)`
çifti gider (`CAPABILITIES.md` A6 — "K bağımsız kısa geçiş").

**Fırlatır:** `caseSummary.length > CASE_SUMMARY_CHAR_BUDGET` (**3.200**
karakter, ~800 token) ise `CaseSummaryTooLongError`, **hiçbir backend
çağrısı yapılmadan.**

**Örnek**
```ts
const results = await correlateDocuments(
  'Müvekkil kiracı, tahliye talep ediyor.',
  documents,
  localModelBackend, // cihaz içi model — ağa çıkmaz
)
const relevant = results.filter((r) => r.score.relevant)
```

### İlgili tipler ve sabitler

`SummaryBackend` — `{ summarize(excerpt: string): string | Promise<string> }`.
`CorrelationBackend` — `{ correlate(caseSummary, documentExcerpt): CorrelationScore | Promise<CorrelationScore> }`.
`CorrelationScore` — `{ relevant: boolean, rationale: string }`.
`DocumentSummary` — `{ document, summary }`. `DocumentCorrelation` —
`{ document, score }`. `CASE_SUMMARY_CHAR_BUDGET` — `3200`.
`CaseSummaryTooLongError` — `{ length: number }`.

---

## 11. Türkçe çekim eki normalleştirmesi — `nameKey`, `splitName`

Plan M4. `docs/SPEC.md` §4.1, S6.

### `nameKey(root: string): string`

Eşleme anahtarını üretir: Türkçe kurala göre büyütür, ünsüz yumuşamasını
tersine çevirir (`Ahmet`/`Ahmed` → `AHMET`). Aynı kişinin farklı yazımları
aynı anahtara, dolayısıyla aynı token'a düşer (S6).

### `splitName(word: string, isKnownRoot?: (candidate: string) => boolean): SplitName`

Bir sözcüğü kök + ek olarak ayırır. Önce kesme işaretine bakar (güvenilir);
yoksa `isKnownRoot` ile denetimli ek soyma dener (yalnız kalan kök bilinen
bir ada uyuyorsa). İkisi de tutmazsa sözcüğün tamamı köktür, `suffix: ''`.

**Fırlatır:** Hiçbir zaman.

### İlgili tip

`SplitName` — `{ root: string, suffix: string }`. `suffix` metinde olduğu
gibi kalır, maskeye girmez (M4.7).

---

## 12. Varlık tipleri ve öncelik — `types/entities.ts`

`docs/SPEC.md` §2, §6.1.

| Dışa aktarım | Tür | İçerik |
|---|---|---|
| `ENTITY_TYPES` | `readonly EntityType[]` sabiti | `['TCKN','IBAN','TEL','EPOSTA','PLAKA','ESAS','TARIH','KISI','KURUM','ISYERI','ADRES']` |
| `TYPE_PRIORITY` | `Readonly<Record<EntityType, number>>` | Çakışma eşitliğinde küçük sayı önce kazanır (SPEC §6.1) |
| `EntityType` | birleşim tipi | `ENTITY_TYPES`'ın eleman tipi |
| `EntitySpan` | arayüz | `{ start, end, text, type, layer, key, confidence, ambiguous?, candidates? }` |
| `SuspectSpan` | arayüz | `{ start, end, text, type, reason }` — doğrulamadan geçemeyen ama insan gözüyle okunabilir aday (SPEC §7/3) |
| `DetectionLayer` | birleşim tipi | `'rule' \| 'ner' \| 'manual'` |

---

## 13. Devir eşiği — `shouldOfferHandoff`

`docs/CAPABILITIES.md` §C, plan M12.9.

### `shouldOfferHandoff(job: JobEstimate, calibration: DeviceCalibration, device?: DeviceState): HandoffOutcome`

**Tek iddia:** eşik aşılmadıkça `{ kind: 'none' }` dışında hiçbir şey
dönmez. Bu fonksiyon devri **yapmaz**, yalnız teklif edilip edilmeyeceğine
karar verir; kullanıcı onayı ve devrin kendisi (`PROTOCOL.md`) bu paketin
kapsamı dışındadır (bkz. `ARCHITECTURE.md` §3).

**Karar sırası:** bellek (§C.6, bilgilendirme) → termal/batarya (§C.7,
erteleme) → eşleşmiş masaüstü yoksa `none` → süre (§C.1) → toplu iş (§C.3)
→ ses (§C.5) → `none`.

**Fırlatır:** Hiçbir zaman.

**Örnek**
```ts
const outcome = shouldOfferHandoff(
  { foregroundWaitSeconds: 700, queueable: false },
  { measured: true },
)
// outcome.kind === 'offer', outcome.trigger === 'time'
```

### İlgili tipler ve sabit

`JobEstimate`, `DeviceCalibration`, `DeviceState`, `ThermalState`
(`'nominal'|'fair'|'serious'|'critical'`), `HandoffTrigger`
(`'time'|'batch'|'audio'`), `HandoffOutcome` (ayrık birleşim:
`none`/`offer`/`postpone`/`info`). `THRESHOLDS` — `{ foregroundWaitSeconds: 600,
chunkCount: 2000, audioMinutes: 90, peakResidentMemoryMb: 1200,
lowBatteryPercent: 20 }` (ölçüm yoksa 1,5 ile gevşetilir, §C.0).

---

## 14. Yazma katmanı — iskelet, üslup, few-shot, aşamalı üretim

Plan M8, `CAPABILITIES.md` A8/A9/A13. **Deneysel** (bkz. §0).

### 14.1 İskelet — `extractSkeleton`

**`extractSkeleton(text: string): DocumentSkeleton`**

Başlıkları (ondalık/roma/harf numaralı veya bilinen büyük-harf başlık
kalıpları) ve bölüm sırasını çıkarır. **Döner:** `DocumentSkeleton` —
`{ headings: readonly SkeletonHeading[], numberingScheme, sectionOrder }`.
`numberingScheme`: `'decimal' | 'roman' | 'alpha' | 'none' | 'mixed'`.

**Fırlatır:** Hiçbir zaman; başlıksız metinde boş liste döner.

### 14.2 Üslup profili — `extractStyleProfile`, `mergeStyleProfiles`

**`extractStyleProfile(text: string): StyleProfile`** — tek bir dilekçeden
**bağımsız, kısmi** profil çıkarır: cümle/paragraf uzunluğu istatistiği,
tekrarlanan 3-5 kelimelik kalıp ifadeler (n-gram), numaralandırma biçimi,
hitap/kapanış/atıf kalıpları (küçük regex kataloğu), sık terimler.

**`mergeStyleProfiles(a: StyleProfile, b: StyleProfile): StyleProfile`** —
**artımlı** birleştirme (M8.4); komütatiftir, `emptyStyleProfile()` birim
elemandır. Frekans listeleri toplanıp ilk 10'a kırpılır.

**`emptyStyleProfile()`**, **`meanSentenceWords(profile)`**,
**`meanParagraphSentences(profile)`** — yardımcılar.

**Fırlatır:** Hiçbiri fırlatmaz; boş metin sıfır istatistik üretir.

**Örnek — artımlı toplama (A8)**
```ts
let profile = emptyStyleProfile()
for (const petition of oldPetitions) {
  profile = mergeStyleProfiles(profile, extractStyleProfile(petition))
}
```

### 14.3 Few-shot seçimi — `selectFewShot`, `jaccardSimilarity`

**`selectFewShot(target: string, corpus: readonly FewShotExample[], options?): FewShotSelection`**

En benzer (Jaccard benzerliği, normalize kelime kümeleri) 2-3 örneği
(`DEFAULT_FEW_SHOT_COUNT = 3`) bağlam bütçesi (`FEW_SHOT_CHAR_BUDGET = 8000`
≈ 2.000 token) içinde greedy seçer. Bütçeye sığmayan adaylar `skipped`'e
düşer, **sessizce kaybolmaz**.

**Döner:** `FewShotSelection` — `{ examples, usedChars, skipped }`.
**Fırlatır:** Hiçbir zaman.

### 14.4 Aşamalı üretim — `generateStagedDraft` ve aşama fonksiyonları

`CAPABILITIES.md` A13: **iskelet → bölüm bölüm → tutarlılık geçişi.**
Cihaz içi modeli temsil eden `WriteBackend = { generate(prompt): string | Promise<string> }`
dışarıdan verilir; bu modül **hiçbir zaman ağa çıkmaz** (M8.1).

| Fonksiyon | İmza | Bağlam bütçesi | Aşılırsa |
|---|---|---|---|
| `generateSkeletonPlan` | `(instructions, facts, backend) => Promise<readonly string[]>` | `SKELETON_PLAN_CHAR_BUDGET = 2000` (~500 token) | `SkeletonPlanContextTooLargeError`, backend **hiç çağrılmaz** |
| `generateSection` | `(context: SectionContext, backend) => Promise<DraftSection>` | `SECTION_CONTEXT_CHAR_BUDGET = 8000` (~2.000 token) | `SectionContextTooLargeError`, backend **hiç çağrılmaz** |
| `runConsistencyPass` | `(sections, backend) => Promise<ConsistencyResult>` | `CONSISTENCY_CONTEXT_CHAR_BUDGET = 6000` (~1.500 token) | `ConsistencyContextTooLargeError`, backend **hiç çağrılmaz** |
| `generateStagedDraft` | `(options: GenerateStagedDraftOptions, backend) => Promise<StagedDraft>` | Üç aşamayı sırayla çalıştırır | Yukarıdakilerden hangisi aşılırsa onu yansıtır |

`generateStagedDraft` içindeki bölümler `Promise.all` ile **bağımsız**
üretilir — biri diğerinin taslağını görmez, yalnız ortak başlık planını ve
`factsBySection`'daki kendi olgu altkümesini görür.

`buildSkeletonPlanPrompt`, `buildSectionPrompt`, `buildConsistencyPrompt` —
backend'e giden prompt'u üreten saf fonksiyonlar; test etmek veya kendi
orkestrasyonunuzu kurmak için dışa açıktır.

**Örnek**
```ts
const draft = await generateStagedDraft(
  {
    instructions: 'kira sözleşmesi feshi dilekçesi',
    factsBySection: { '1. KONU': ['kira bedeli 3 aydır ödenmedi'] },
    styleProfile,
    fewShot: selectFewShot(instructions, corpus).examples,
  },
  onDeviceBackend,
)
// draft.headings, draft.sections, draft.consistencyNotes
```

### İlgili tipler

`WriteBackend`, `SectionContext`, `DraftSection`, `ConsistencyResult`,
`GenerateStagedDraftOptions`, `StagedDraft`, `DocumentSkeleton`,
`SkeletonHeading`, `NumberingScheme`, `StyleProfile`, `RunningStats`,
`PhraseFrequency`, `FewShotExample`, `ScoredExample`, `FewShotSelection`.

---

## 15. Hata tipleri kataloğu (M13.3)

Tüm hata sınıfları `Error`'dan türer, `name` alanı sınıf adıyla aynıdır
(`instanceof` VE `.name` ile ayırt edilebilir).

| Hata | Fırlatan | Ne zaman | `SPEC`/`PROTOCOL` bağı |
|---|---|---|---|
| `UnmaskedContentError` | `assertMasked`, `ResearchClient.search` | Ağa giden metinde maskelenmemiş kimlik verisi kalıntısı | SPEC S3, PROTOCOL 6003 |
| `MaskTableSerializationError` | `MaskTable.toJSON`, `exportEncrypted` (kısa parola) | Düz metin serileştirme girişimi / parola < 8 karakter | SPEC S2, PROTOCOL G1 |
| `MaskTableDecryptError` | `MaskTable.importEncrypted` | Bilinmeyen biçim veya (ayırt edilemez biçimde) yanlış parola/bozuk veri | SPEC §9 |
| `MaskReviewError` | `MaskReview.addMask/linkToExisting/removeMask/applyToAll` | Geçersiz aralık veya bilinmeyen token | M6 |
| `CaseSummaryTooLongError` | `correlateDocuments` | Olay özeti > 3.200 karakter | `CAPABILITIES.md` A6 |
| `SkeletonPlanContextTooLargeError` | `generateSkeletonPlan` | Prompt > 2.000 karakter | `CAPABILITIES.md` A13.1 |
| `SectionContextTooLargeError` | `generateSection` | Prompt > 8.000 karakter | `CAPABILITIES.md` A9/A13.2 |
| `ConsistencyContextTooLargeError` | `runConsistencyPass` | Prompt > 6.000 karakter | `CAPABILITIES.md` A13.3 |

**Ortak desen:** her "bağlam bütçesi aşıldı" hatası, **backend hiç
çağrılmadan** fırlar — cihaz içi modele büyük bir prompt asla gitmez, üst
katman daha küçük bir girdiyle yeniden dener.

---

## 16. Kapsam dışı — bu belgeye girmeyenler

`src/index.ts`'in dışa aktarmadığı hiçbir şey burada yoktur: dedektörlerin
kendisi (`detectTckn` vb.), `resolveOverlaps`, `mask/rules/shared.ts`
yardımcıları, `mask/ner/index.ts`'in `toEntitySpans`/`runNer`/`runNerAsync`'i.
Bunlar iç uygulama detaylarıdır (M13.1); paket dışından erişilemez ve bu
belgenin kapsamına girmez. Eklenirse önce `index.ts`'e, sonra bu belgeye
eklenir — sıra tersine işlemez.
