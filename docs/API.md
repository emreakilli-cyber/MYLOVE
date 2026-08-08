# API — `packages/hukuk-ai` genel yüzeyi

Plan M13. Dışa açılan **her şey** `src/index.ts`'ten geçer (M13.1); bu belge
o dosyanın dışa aktardıklarını satır satır belgeler. İç modüller (`mask/rules/*`
detektörleri gibi) burada yok, çünkü dışarıdan hiç erişilemezler.

Her bölüm ilgili `SPEC.md` / `CAPABILITIES.md` / `PROTOCOL.md` maddesine
atıfla açılır; sözleşmenin kendisi oralarda, burada yalnız **imza düzeyinde**
karşılığı var.

---

## 1. Maskeleme çekirdeği (`SPEC.md`)

### `mask(input, options?) → MaskResult`

Metni maskeler. Kural katmanı her zaman koşar; `options.ner` verilirse NER
katmanı da eklenir (S5: kural her zaman önce).

| | |
|---|---|
| **Parametreler** | `input: string` — ham metin.<br>`options?: MaskOptions` — `table?: MaskTable` (var olan tabloya ekler, SPEC §4.2), `maskDates?: boolean` (varsayılan `true`, S4), `ner?: NerBackend` (senkron backend) |
| **Döner** | `MaskResult` — `{ text, table, spans, suspects }`. `text` maskelenmiş çıktı; `table` yeni veya genişletilmiş `MaskTable`; `spans` maskelenen aralıklar (kaçışlanmış metne göre konumlu); `suspects` doğrulamadan geçemeyen adaylar (SPEC §7/3) |
| **Fırlatır** | Hiçbir zaman. Girdi ne olursa olsun tanımlı bir sonuç döner (SPEC S3'ün "koşamazsa hiçbir şey gitmez" ilkesi, koşmanın kendisinin çökmemesini gerektirir) |
| **Örnek** | `const { text, table } = mask('Ahmet Yılmaz, TC 10000000146')` → `text === '[KISI_1], TC [TCKN_1]'` |

### `maskAsync(input, options?) → Promise<MaskResult>`

`mask`'in eşzamansız sürümü. Yalnız fark: `options.ner` bir `AsyncNerBackend`
da olabilir (cihaz içi model çıkarımı eşzamansızdır, `MODEL.md` §3.1). Sözlük
tabanlı varsayılan backend senkron kaldığı için `mask()` de kalabiliyor;
model bağlandığında `maskAsync` kullanılır.

### `unmask(text, table) → UnmaskResult`

Token'ları ham metne çevirir — **birebir** (SPEC S1).

| | |
|---|---|
| **Parametreler** | `text: string` — maskelenmiş (veya model çıktısı) metin.<br>`table: MaskTable` — `mask()`'ten dönen tablo |
| **Döner** | `UnmaskResult` — `{ text, unresolved }`. `unresolved`: tabloda karşılığı olmayan token'lar (bozuk/tabloda-olmayan) — SPEC §5.1 gereği **hata değil**, uyarı listesi |
| **Fırlatır** | Hiçbir zaman. Bilinmeyen token aynen bırakılır, çökme olmaz |
| **Not** | Aynı token'ın n'inci geçişi tablodaki n'inci ham yazımla değişir (M5.2, M5.3 kayıt sırası) — model çıktısında token beklenenden çok tekrarlanmışsa fazlalık kanonik yazıma düşer |

---

## 2. `MaskTable` (SPEC §4, §5, PROTOCOL G1)

Deterministik eşleme tablosu. Örnekleri `mask()` üretir; doğrudan
`new MaskTable()` ile de kurulabilir (`MaskReview` böyle yapar).

| Üye | İmza | Not |
|---|---|---|
| `size` | `get size(): number` | Kayıt sayısı |
| `tokenFor` | `(type, key, surface, index) => string` | Var olan anahtar için mevcut token'ı döner, yoksa yeni sıra numarasıyla oluşturur (S4: aynı anahtar → aynı token) |
| `surfaceAt` | `(token, nth) => string \| undefined` | Bir token'ın n'inci geçişinin ham yazımı |
| `lookup` | `(token) => MaskEntry \| undefined` | Tek kayıt |
| `hasKey` / `tokenOf` | `(type, key) => boolean / string \| undefined` | Anahtar sorgusu |
| `markAmbiguous` | `(token, candidates?) => void` | SPEC §7/7 — geri alınamaz işaretleme |
| `entries` | `() => readonly MaskEntry[]` | M6.1 — onay ekranı listesi, ilk geçiş sırasına göre |
| `remove` | `(token) => boolean` | M6.4 — numaralar yeniden kullanılmaz |
| `clear` | `() => void` | M5.7 — oturum sonu |
| `digest` | `() => Promise<string>` | **Ağa çıkabilen TEK biçim** (PROTOCOL §5.3 `maskTableHash`); `sha256:` önekli özet |
| `toJSON` | `(): never` | **Fırlatır** — `MaskTableSerializationError`. Kasıtlı: `JSON.stringify(table)` sessizce boş nesne üretmesin (SPEC S2) |
| `exportEncrypted` | `(passphrase, iterations = 310000) => Promise<EncryptedMaskTable>` | M5.7 — kalıcı saklamanın TEK yolu. `passphrase.length < 8` ise `MaskTableSerializationError` fırlatır. Çıktı **cihazda saklanmak içindir**, ağa çıkarılabilir değildir |
| `importEncrypted` *(static)* | `(blob, passphrase) => Promise<MaskTable>` | Yanlış parola veya bozuk veri ayırt edilmeden `MaskTableDecryptError` fırlatır (zamanlama/hata-mesajı yoluyla parola sızıntısını önlemek için kasıtlı) |

`MASK_TABLE_FORMAT` sabiti (`'hukuk-ai.masktable.v1'`) — `exportEncrypted`
çıktısının `format` alanı, sürüm kontrolü için.

---

## 3. Onay ekranı — `MaskReview` (M6)

Saf veri sınıfı; DOM'a dokunmaz (M6.7). Her müdahalede maskeleme **baştan**
yeniden hesaplanır (M6.6'yı tanım gereği sağlar).

| Üye | İmza | Not |
|---|---|---|
| *constructor* | `new MaskReview(originalText, options?: MaskOptions)` | `options` `mask()`'inkiyle aynı |
| `sourceText` / `maskedText` / `table` / `result` | *getter* | `sourceText` kaçışlanmış hâldir; sonraki tüm aralıklar buna göredir |
| `listMasks()` | `() => readonly ReviewMask[]` | M6.1 — `MaskEntry` + `layer` + `confidence` |
| `addMask(range, type)` | `(TextRange, EntityType) => string` | M6.2 — token döner |
| `linkToExisting(range, token)` | `(TextRange, string) => void` | M6.3. Bilinmeyen `token` → `MaskReviewError` |
| `removeMask(token)` | `(string) => void` | M6.4. Bilinmeyen `token` → `MaskReviewError` |
| `applyToAll(range, type)` | `(TextRange, EntityType) => string` | M6.5 — kökün tüm çekimli geçişleri (M4 ile bağlantılı) |

**Fırlatır:** `MaskReviewError` — geçersiz aralık (`range.start`/`end` metin
sınırları dışında, tersine dönük, tam sayı değil), bilinmeyen `token`.

---

## 4. Kaçak kimlik yakalama — `preflightCheck` (M11)

### `preflightCheck(text, options) → PreflightResult`

Gönderim düğmesine basılmadan önce çalışır; `MaskGuard`'ın (§5) **yerine
geçmez**, ondan önce gelir — preflight atlanabilir, guard atlanamaz.

| | |
|---|---|
| **Parametreler** | `text: string`.<br>`options: PreflightOptions` — `MaskOptions` + zorunlu `destination: 'local' \| 'network'` |
| **Döner** | `PreflightResult` — `{ clean, entities, suspects, maskedPreview, canSendUnmasked }`. `canSendUnmasked` **her zaman `false`** olur `destination === 'network'` iken (M11.5) — arayüz bu bayrağa bakıp "maskesiz gönder" düğmesini hiç çizmez |
| **Fırlatır** | Hiçbir zaman |

---

## 5. Araştırma katmanı — `ResearchClient` + `MaskGuard` (M7, `CAPABILITIES.md` A6)

**Bu, paketin internete çıkan TEK modülüdür.**

### `ResearchClient`

| Üye | İmza | Not |
|---|---|---|
| *constructor* | `new ResearchClient(options?: ResearchClientOptions)` | `transport?: ResearchTransport` (ağın kendisi, dışarıdan enjekte), `localIndex?: LocalResearchIndex` (çevrimdışı kaynak), `ner?: NerBackend` (kapının ad/kurum/adres de görmesi için) |
| `search(query)` | `(ResearchQuery) => Promise<ResearchResponse>` | **İlk iş kapıdır** — `assertMasked` her şeyden önce çalışır; kapı fırlatırsa taşımaya, yerel dizine, günlüğe hiçbir yan etki gitmez |

`search` akışı: kapı geçer → `transport` varsa dener → başarısızsa veya
`transport` yoksa `localIndex`'e düşer (M7.7, hata değil) → ikisi de yoksa
`source: 'unavailable'`.

**Fırlatır:** `UnmaskedContentError` — `query.text` maskelenmemiş kimlik verisi
taşıyorsa. Kaçış yolu yok (M7.4).

### `assertMasked(text, options?) → void` ve `findUnmaskedContent(text, options?) → readonly GuardFinding[]`

Kapının kendisi, `ResearchClient` dışında bağımsız kullanılabilir (ör.
başka bir ağa-çıkan entegrasyon eklenirse). `findUnmaskedContent` sessiz
tarama yapar (bulgu listesi döner, fırlatmaz); `assertMasked` bulgu varsa
`UnmaskedContentError` fırlatır. İkisi de kural katmanının **aynı** çakışma
çözümünü kullanır (maskeleme ile kapı hiçbir zaman farklı sayıda bulgu
görmez).

`GuardFinding.preview` ham değeri **taşımaz** — ilk/son karakter dışı
gizlenmiş önizleme (`05••••••••33`); hata nesnesi de bir sızıntı yüzeyi
sayılır.

---

## 6. Sonuç özetleme ve ilişkilendirme (M7.6, A6)

K bağımsız kısa geçiş sözleşmesi **imza düzeyinde** zorlanır: her iki
fonksiyon da backend'e her çağrıda **tek** belge verir, hiçbir zaman dizi
almaz.

| Fonksiyon | İmza | Not |
|---|---|---|
| `summarizeResults` | `(documents, backend: SummaryBackend) => Promise<readonly DocumentSummary[]>` | Belgeler sırayla, bağımsız işlenir |
| `correlateResults` | `(caseSummary, documents, backend: CorrelationBackend) => Promise<readonly CaseCorrelation[]>` | Çıktı uzunluğu her zaman `documents.length` |

Bu adım **ağa çıkmaz** — karar/mevzuat metni `ResearchClient`'tan zaten
elde edilmiştir; özetleme/ilişkilendirme cihaz içi modelin işidir
(`SummaryBackend`/`CorrelationBackend` arayüzleriyle enjekte edilir, model
bağımsız).

---

## 7. Türkçe çekim eki normalizasyonu (M4)

| Fonksiyon | İmza | Not |
|---|---|---|
| `nameKey(root)` | `(string) => string` | Eşleme anahtarı: büyütür + son ünsüzü sertleştirir (`Ahmet`/`Ahmed` → `AHMET`) |
| `splitName(word, isKnownRoot?)` | `(string, (candidate: string) => boolean) => SplitName` | Önce kesme işareti (güvenilir), sonra bilinen köke dayalı ek soyma (denetimli); ikisi de tutmazsa kelime kendi kökü sayılır |

`isKnownRoot` verilmezse hiçbir kesme-işaretsiz ek soyulmaz (varsayılan
`() => false`) — bu, sıradan sözcüklerin yanlışlıkla parçalanmasını önleyen
kasıtlı güvenli varsayılandır.

---

## 8. NER katmanı (M3)

| Fonksiyon | İmza | Not |
|---|---|---|
| `createDictionaryNerBackend(options?)` | `(DictionaryNerOptions) => NerBackend` | Varsayılan, modelsiz uygulama (M3.3). `options`: `people?`, `organizations?`, `workplaces?` — cihazdaki kayıtlar |
| `freeRegions(textLength, taken)` | `(number, ranges) => readonly FreeRegion[]` | Kural katmanının dokunmadığı boşluklar — S5'i uygulayan iskelet fonksiyonu, özel `NerBackend` yazanlar için dışa açık |

`NerBackend.detect(text, regions)` **yalnız** verilen `regions` içinde aday
üretmelidir; bunun dışına taşan adaylar `runNer`/`mask()` tarafından
sessizce **atılır** (S5'in zorlayıcı kısmı, backend'in iyi niyetine
bırakılmaz).

---

## 9. Kural katmanı yardımcıları (M2)

| Fonksiyon | İmza | Not |
|---|---|---|
| `runRuleLayer(text, options?)` | `(string, RuleLayerOptions) => RuleResult` | Tüm deterministik dedektörlerin birleşimi. `options.maskDates === false` ise `detectDate` devre dışı |
| `isValidTckn(value)` | `(string) => boolean` | 10./11. hane doğrulama algoritması |
| `isValidIban(raw)` | `(string) => boolean` | TR IBAN, mod-97 |
| `normalizePhone(raw)` | `(string) => string \| undefined` | Ayırıcılardan arındırılmış kanonik biçim; tanınmayan girişte `undefined` |

`ENTITY_TYPES` (11 kod) ve `TYPE_PRIORITY` (çakışma çözümünde eşitlik
bozucu sıra, SPEC §6.1) sabitleri de burada dışa açık.

`isMaskToken(candidate)` — bir dizgenin gerçek maske token'ı biçimine
uyup uymadığını sınar (`mask/token.ts`); kaçışlama/kaçış-çözme kendisi
dışa açık değildir (`mask()`/`unmask()` içinde kalır).

---

## 10. Devir teslim eşiği (M12.9, `CAPABILITIES.md` §C)

### `shouldOfferHandoff(job, calibration, device?) → HandoffOutcome`

Saf fonksiyon — ağ yok, cihaz erişimi yok, yan etki yok.

| | |
|---|---|
| **Parametreler** | `job: JobEstimate`, `calibration: DeviceCalibration` (`measured: false` ise eşikler ×1,5 gevşer, §C.0), `device?: DeviceState` (varsayılan `{}`) |
| **Döner** | `HandoffOutcome` — ayrık birleşim: `{kind:'none'}` (varsayılan, ezici çoğunluk), `{kind:'offer', trigger, detail}`, `{kind:'postpone', detail}` (§C.7 — batarya/ısınma), `{kind:'info', detail}` (§C.6 — bellek, teklif değil bilgilendirme) |
| **Sıra** | Bellek (§C.6, ölçüm gevşemesi yok) → termal/batarya (§C.7) → eşleşme yok → süre (§C.1) → toplu iş (§C.3) → ses (§C.5) → `none` |
| **Fırlatır** | Hiçbir zaman |

`THRESHOLDS` sabiti (`foregroundWaitSeconds: 600`, `chunkCount: 2000`,
`audioMinutes: 90`, `peakResidentMemoryMb: 1200`, `lowBatteryPercent: 20`)
dışa açık — arayüz "eşiğe ne kadar kaldı" göstergesi için kullanabilir.

---

## 11. Yazma katmanı (M8, `CAPABILITIES.md` A8/A9/A13)

Ağa hiç çıkmaz (M8.1); `WriteBackend` model bağımsızdır (NER'deki
`NerBackend` deseniyle aynı).

| Fonksiyon | İmza | Not |
|---|---|---|
| `extractSkeleton(documentText)` | `(string) => DocumentSkeleton` | M8.2 — tamamen deterministik, model gerekmez |
| `emptyStyleProfile()` | `() => StyleProfile` | Boş profil; artımlı toplamanın başlangıcı |
| `addDocument(profile, documentId, documentText)` | `(StyleProfile, string, string) => StyleProfile` | M8.3/M8.4 — saf fonksiyon, **ham metni saklamaz**; yalnız çalışan istatistik + ≤ 40 örnek tutar |
| `estimateTokens(text)` | `(string) => number` | Kaba tahmin (`karakter/4`) — cihazda gerçek tokenizer yok |
| `selectFewShot(query, candidates, options?)` | `(string, FewShotCandidate[], FewShotOptions) => FewShotSelection` | M8.5 — Jaccard benzerliği, bağlam bütçesi (varsayılan ≤ 2.000 token, ≤ 3 örnek) aşılınca durur |
| `generateStaged(caseSummary, backend, options?)` | `(string, WriteBackend, GenerateStagedOptions) => Promise<StagedDocument>` | M8.7 — iskelet → bölüm bölüm üretim → tutarlılık geçişi. `backend.generateSection` her çağrıda **tek** bölüm görür; `backend.reviewConsistency` bölümlerin **özetini** görür, tam metnini değil (A13 §2/§3, imzayla zorlanır) |

**Fine-tuning burada yoktur (M8.6 kararı).** `WriteBackend`'in cihaz içi
küçük model mi, isteğe bağlı büyük model mi olduğu bu katmanın bilmediği
bir karardır — bkz. `MODEL.md`, `TRAINING.md`.

---

## 12. Hata tipleri kataloğu (M13.3)

| Tip | Nerede fırlar | Taşıdığı bilgi | Sızıntı önlemi |
|---|---|---|---|
| `MaskTableSerializationError` | `MaskTable.toJSON()`; `exportEncrypted()` (parola < 8 karakter) | yalnız sabit mesaj | mesaj hiçbir tablo içeriği taşımaz |
| `MaskTableDecryptError` | `MaskTable.importEncrypted()` | yalnız sabit mesaj | yanlış parola / bozuk veri **ayırt edilmez** (bilerek) |
| `MaskReviewError` | `MaskReview.addMask/linkToExisting/removeMask` (geçersiz aralık, bilinmeyen token) | aralık değerleri veya token dizgesi | yalnız konum/tanımlayıcı, ham değil |
| `UnmaskedContentError` | `assertMasked()`; `ResearchClient.search()` | `findings: readonly GuardFinding[]` — tip + konum + **önizleme** (`05••••••••33`), mesajda yalnız tip adları | `GuardFinding.preview` ham değeri taşımaz (§5) |

**Fırlatmayan, sessiz-yutmayan durumlar (hata değil, sonuç alanı):**
`unmask()`'in `unresolved` listesi, `mask()`'in `suspects` listesi,
`ResearchClient.search()`'ün `source: 'unavailable'` dönüşü,
`shouldOfferHandoff`'un `{kind:'info'}`/`{kind:'postpone'}` dönüşleri. Bunlar
"başarısızlık" değil, SPEC/CAPABILITIES'in tanımladığı **normal** sonuçlardır
— çağıran taraf `try/catch` yerine dönüş değerine bakmalıdır.

---

## 13. Kararlılık sözü (M13.5)

| Yüzey | Durum | Gerekçe |
|---|---|---|
| `mask`, `maskAsync`, `unmask`, `MaskTable`, `MaskReview`, `preflightCheck` | **Kararlı** | `SPEC.md`'nin bağlayıcı sözleşmesine (`maskContractVersion 1.0.0`) bağlı; değişiklik sürüm artışı gerektirir (SPEC'in kendi değişim usulü) |
| `ResearchClient`, `assertMasked`, `findUnmaskedContent`, `runRuleLayer`, `isValidTckn`, `isValidIban`, `normalizePhone`, `nameKey`, `splitName`, `isMaskToken` | **Kararlı** | Maskeleme sözleşmesinin doğrudan uzantısı; kapı, kural katmanıyla **aynı** davranışı paylaşmak zorunda (§5) |
| `shouldOfferHandoff`, `THRESHOLDS` | **Kararlı** | `CAPABILITIES.md` §C eşiklerine bağlı, sınır değerleriyle test altında (M12.9); değişiklik önce `CAPABILITIES.md`'de yapılır |
| `createDictionaryNerBackend`, `NerBackend`/`AsyncNerBackend` arayüzleri | **Kararlı arayüz, deneysel uygulama** | Arayüz `SPEC.md` S5'e bağlı ve değişmeyecek; sözlük tabanlı `createDictionaryNerBackend` gerçek model backend'i (`MODEL.md`) bağlanınca varsayılan olmaktan çıkabilir, kaldırılmaz ama "önerilen" olmaktan çıkabilir |
| `correlateResults`, `summarizeResults`, `CorrelationBackend`, `SummaryBackend` | **Deneysel** | M7.6'da bu oturumda eklendi; henüz hiçbir gerçek backend'e bağlanmadı, arayüz gerçek model entegrasyonunda değişebilir |
| `write/*` (`extractSkeleton`, `addDocument`, `selectFewShot`, `generateStaged`, `WriteBackend` ve ilişkili tipler) | **Deneysel** | M8'de bu oturumda eklendi; `WriteBackend` imzası gerçek bir model bağlanmadan doğrulanamaz, ilk entegrasyonda değişme ihtimali yüksek |

**"Deneysel" ne anlama gelir:** API kırılabilir, ama **sessizce** kırılmaz —
`SPEC.md`/`CAPABILITIES.md` gibi bir bağlayıcı belgeye taşınmadıkça `PLAN-HUKUKAI.md`
oturum günlüğüne değişikliğin gerekçesi yazılır. "Kararlı" olanlar için aynı
kural + ilgili bağlayıcı belgenin kendi değişim usulü (`PROTOCOL.md` §11
örneğindeki gibi) geçerlidir.
