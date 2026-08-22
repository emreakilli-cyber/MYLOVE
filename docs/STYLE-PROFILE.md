# STYLE-PROFILE — üslup profili JSON şeması

Plan M8.3. Kaynak kod: `packages/hukuk-ai/src/write/styleProfile.ts` — bu
belgedeki her alan oradaki `StyleProfile` arayüzünün birebir karşılığıdır.
Tipler tek gerçek kaynaktır (source of truth); bu belge onları okunur biçimde
özetler, çelişki çıkarsa **kod** kazanır ve bu belge güncellenir.

`StyleProfile` yalnız JSON'a birebir dönüşen alanlardan kuruludur (sayı, dize,
dizi, düz nesne) — `Map`/`Set`/`Infinity` yok. `JSON.stringify(profile)` her
zaman güvenlidir; kalıcı saklama veya cihazlar arası aktarım bunun üzerinden
yapılır.

## Alanlar

| Alan | Tip | Ne taşır |
|---|---|---|
| `documentCount` | `number` | Profile katkı veren dilekçe sayısı |
| `sentenceLength` | `DistributionStats` | Cümle uzunluğu (kelime sayısı) dağılımı |
| `paragraphLength` | `DistributionStats` | Paragraf uzunluğu (kelime sayısı) dağılımı |
| `numberingStyle` | `'arabic' \| 'roman' \| 'letter' \| 'none'` | Gövdede baskın sıralı liste biçimi |
| `formulaicPhrases` | `PhraseFrequency[]` | Sabit kalıp ifadelerin geçiş sayısı, azalan sırayla |
| `salutations` | `PhraseFrequency[]` | Dilekçe başı hitap kalıpları ("… MAHKEMESİ'NE") |
| `closings` | `PhraseFrequency[]` | Kapanış kalıpları ("… arz ve talep ederim") |
| `citationStyle` | `CitationStyleStats` | Mevzuat/karar atıf sayısı ve E./K. sırası tercihi |
| `preferredTerms` | `PhraseFrequency[]` | Yakın anlamlı terim varyantlarının geçiş sayısı |
| `excerpts` | `RepresentativeExcerpt[]` | Few-shot havuzu — belge başına 2–3 temsilî paragraf |

### `DistributionStats`

| Alan | Tip | Not |
|---|---|---|
| `count` | `number` | Örneklem sayısı |
| `mean` | `number` | Ortalama |
| `min` / `max` | `number` | `count === 0` iken ikisi de `0` — `Infinity` asla sızmaz |
| `stdDev` | `number` | Standart sapma |

Çevrimiçi (online) Welford algoritmasıyla tutulur: belgeler tek tek eklenir,
hiçbiri aynı anda bellekte tutulmaz (M8.4). İki bağımsız durum, sıfırdan
saymadan matematiksel olarak birleştirilebilir (`mergeState`).

### `PhraseFrequency`

| Alan | Tip |
|---|---|
| `phrase` | `string` |
| `count` | `number` |

Yalnız `count > 0` olan girdiler listelenir; sıralama azalan sayı, eşitlikte
`tr` alfabetik.

### `CitationStyleStats`

| Alan | Tip | Not |
|---|---|---|
| `lawReferenceCount` | `number` | "`<sayı> sayılı`" biçimindeki mevzuat atfı; karar numarasının (`.../....`) parçası olan sayılar hariç |
| `caseReferenceCount` | `number` | `E. .../... K. .../...` biçimindeki içtihat atfı (iki yönde de) |
| `caseOrder` | `'e-first' \| 'k-first' \| 'unknown'` | Bürodaki baskın sıralama tercihi; atıf yoksa `unknown` |

### `RepresentativeExcerpt`

| Alan | Tip |
|---|---|
| `documentId` | `string` |
| `text` | `string` |

En az 8 kelimelik paragraflardan, belge başına en uzun (içerik yoğun) en
fazla 3 tanesi. M8.5 few-shot seçiminin havuzudur; seçim **belge** düzeyinde
yapılır (bkz. `write/fewShot.ts`) — bir dilekçenin alıntıları ya hep birlikte
seçilir ya da hiç.

## Kalıp/terim sözlüğü — bilinen sınır

`formulaicPhrases` ve `preferredTerms`, kodda sabit küçük bir başlangıç
listesine (`FORMULAIC_PHRASES`, `TERM_VARIANTS`) karşı sayım yapar; listede
olmayan bir kalıp hiç görünmez (yanlış pozitif üretmez, yalnız eksik kalır).
Gerekçe ve genişletme yolu: `docs/QUESTIONS.md` S7.
