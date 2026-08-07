# PROTOCOL — Telefon ↔ Masaüstü Sözleşmesi

**Sözleşme sürümü:** `1.0.0`
**Durum:** Bağlayıcı. Bu dosya bir **sözleşmedir**.

> **Değiştirilemezlik kuralı.** Hiçbir modül bu dosyayı tek taraflı değiştiremez.
> Telefon modülü de, masaüstü modülü de bu dosyaya uyar; uymayan modül hatalıdır,
> dosya değil. Değişiklik yalnız §11'deki usulle yapılır.

Kapsam: `packages/hukuk-ai` içindeki telefon (owner) ve masaüstü (worker)
modüllerinin birbirleriyle konuşma biçimi. `CAPABILITIES.md` **ne zaman** devir
olacağını söyler; bu dosya **nasıl** olacağını söyler.

---

## 1. Değişmezler (invariants)

Bu yedi madde protokolün varlık sebebidir. Her biri testle doğrulanır; ihlali
protokol hatası değil **güvenlik olayıdır**.

| No | Değişmez |
|---|---|
| **G1** | Maske tablosu (gerçek değer ↔ maske token eşlemesi) **hiçbir mesajda, hiçbir biçimde** ağa çıkmaz. |
| **G2** | Masaüstüne yalnız **maskelenmiş** içerik gider. Maskeleme kanıtı olmayan iş reddedilir. |
| **G3** | Masaüstü **durumsuzdur**. İş bitince, iptal olunca veya bağlantı kesilince tüm iş verisini siler. Kalıcı depolama yapmaz. |
| **G4** | **Telefon her zaman işin sahibidir.** Masaüstü işi geri veremez, devredemez, saklayamaz; yalnız teslim eder. |
| **G5** | Devir **sessiz olamaz**. Her devir açık kullanıcı onayı ile başlar. |
| **G6** | Şifrelenmemiş taşıma üzerinden hiçbir iş mesajı gönderilmez. |
| **G7** | Masaüstünün yokluğu **hiçbir özelliği kapatmaz**. Protokolün tamamı devre dışı kalsa telefon tüm işleri tek başına bitirir. |

---

## 2. Roller

| Rol | Değer | Yetki |
|---|---|---|
| Telefon | `"phone"` | İşin sahibi. Eşleşmeyi başlatır, işi teklif eder, iptal eder, geri alır, sonucu kabul/ret eder. |
| Masaüstü | `"desktop"` | İşçi. Yalnız kabul eder, ilerleme bildirir, teslim eder. **İş talep edemez**, veri isteyemez, iş saklayamaz. |

Rol dışı mesaj gönderen taraf `2005 ROLE_NOT_ALLOWED` alır.

---

## 3. Taşıma katmanı

| Konu | Karar |
|---|---|
| Keşif | Yerel ağda mDNS/Bonjour, servis tipi `_hukukai._tcp` |
| Taşıma | WebSocket over TLS 1.3 (`wss://`), yerel ağ; sertifika eşleştirme sırasında sabitlenir (pinning) |
| İnternet | **Yasak.** Devir yalnız yerel ağdadır. Uzak sunucu, bulut relay, NAT delme yoktur. |
| Kodlama | UTF-8 JSON; ikili içerik `base64` |
| Azami mesaj | 4 MiB. Daha büyük içerik parçalanır (`JOB_INPUT_CHUNK`). |
| Sıkıştırma | Zarf `permessage-deflate` ile; içerik ayrıca sıkıştırılmaz |

---

## 4. Zarf (envelope)

Her mesaj bu zarfla gider. Alan adları birebir bunlardır.

```
{
  "proto":          "hukukai",         // sabit
  "protoVersion":   "1.0.0",           // semver, gönderenin konuştuğu sürüm
  "messageId":      "01JAV...",        // ULID, gönderende benzersiz
  "correlationId":  "01JAU..." | null, // yanıtlanan mesajın messageId'si
  "sentAt":         "2026-08-07T09:14:22.481Z",  // RFC 3339, UTC, ms
  "senderDeviceId": "dev_7f3a...",     // eşleşmede atanmış kalıcı kimlik
  "senderRole":     "phone" | "desktop",
  "type":           "JOB_OFFER",       // §5 tiplerinden biri
  "payload":        { }                // tipe özgü, §5
}
```

**Kurallar**
- Bilinmeyen **alanlar** yok sayılır (ileri uyumluluk). Bilinmeyen **tipler**
  `2003 UNKNOWN_MESSAGE_TYPE` üretir, bağlantı kapanmaz.
- `messageId` tekrarı = `6006 REPLAY_DETECTED`, bağlantı kapanır.
- `sentAt` sapması ±120 sn'yi aşarsa `6006`.
- Zarf ayrıştırılamazsa `2004 ENVELOPE_MALFORMED`.

---

## 5. Mesaj tipleri

### 5.1 Eşleşme (pairing) — bir kez, cihaz çifti başına

Telefon 8 haneli kod üretir ve QR olarak gösterir. Kod **120 saniye** geçerlidir,
en fazla **3 deneme** hakkı vardır.

| Tip | Yön | `payload` alanları |
|---|---|---|
| `PAIR_REQUEST` | desktop → phone | `pairingCodeProof`, `desktopPublicKey`, `deviceName`, `platform`, `appVersion`, `protoVersionMin`, `protoVersionMax` |
| `PAIR_CHALLENGE` | phone → desktop | `nonce`, `phonePublicKey`, `pairingId` |
| `PAIR_PROOF` | desktop → phone | `pairingId`, `signature` |
| `PAIR_RESULT` | phone → desktop | `pairingId`, `accepted` (bool), `assignedDeviceId`, `sessionKeyConfirm`, `certificateFingerprint` |
| `PAIR_REVOKE` | phone → desktop | `assignedDeviceId`, `revokedAt`, `reason` |

- Eşleşme onayı **telefonda kullanıcı tarafından** verilir (G5).
- `PAIR_REVOKE` telefondan tek taraflı gelir; masaüstü itiraz edemez, tüm yerel
  durumu siler.

### 5.2 El sıkışma (handshake) — her bağlantıda

| Tip | Yön | `payload` alanları |
|---|---|---|
| `HELLO` | desktop → phone | `protoVersionMin`, `protoVersionMax`, `appVersion`, `maskContractVersionMax`, `capabilities` |
| `HELLO_ACK` | phone → desktop | `negotiatedProtoVersion`, `negotiatedFeatures[]`, `phoneAppVersion`, `maskContractVersion`, `heartbeatIntervalMs`, `heartbeatTimeoutMs` |
| `HELLO_REJECT` | phone → desktop | `errorCode`, `reason` |

`capabilities` nesnesi:
```
{
  "maxResidentMemoryMb": 24576,
  "acceleration":        "cuda" | "metal" | "cpu",
  "models": [
    { "modelId": "mizan-27b", "params": 27000000000,
      "quantization": "q4_k_m", "contextTokens": 32768 }
  ],
  "concurrentJobs": 1
}
```

El sıkışma bitmeden `JOB_*` mesajı gönderilemez → `3008 JOB_STATE_INVALID`.

### 5.3 İş devri

| Tip | Yön | `payload` alanları |
|---|---|---|
| `JOB_OFFER` | phone → desktop | `jobId`, `jobType`, `thresholdTriggered`, `stageCount`, `inputByteSize`, `inputTokenEstimate`, `requiredCapabilities`, `maskEvidence`, `offerExpiresAt` |
| `JOB_ACCEPT` | desktop → phone | `jobId`, `acceptedAt`, `estimatedDurationMs` |
| `JOB_REJECT` | desktop → phone | `jobId`, `errorCode`, `reason` |
| `JOB_INPUT_CHUNK` | phone → desktop | `jobId`, `chunkIndex`, `chunkCount`, `contentType`, `contentBase64`, `sha256` |
| `JOB_INPUT_COMPLETE` | phone → desktop | `jobId`, `chunkCount`, `totalSha256` |
| `JOB_PROGRESS` | desktop → phone | `jobId`, `completedStages`, `totalStages`, `percent`, `checkpointId`, `checkpointDigest`, `etaMs`, `note` |
| `JOB_RESULT_CHUNK` | desktop → phone | `jobId`, `chunkIndex`, `chunkCount`, `contentBase64`, `sha256` |
| `JOB_RESULT_COMPLETE` | desktop → phone | `jobId`, `totalSha256`, `completedStages`, `qualityNote` |
| `JOB_RESULT_ACK` | phone → desktop | `jobId`, `accepted`, `errorCode?` |
| `JOB_CANCEL` | phone → desktop | `jobId`, `reason` |
| `JOB_CANCEL_ACK` | desktop → phone | `jobId`, `wipedAt` |
| `JOB_RECLAIM` | phone → desktop | `jobId`, `reason` (`"reconnect"` \| `"user"` \| `"local_completed"` \| `"policy"`) |
| `JOB_RECLAIM_ACK` | desktop → phone | `jobId`, `lastCheckpointId`, `completedStages`, `wipedAt` |

`maskEvidence` nesnesi — G2'nin taşıyıcısı, **zorunlu**:
```
{
  "maskContractVersion": "1.0.0",
  "maskedAt":            "2026-08-07T09:14:20.001Z",
  "entityCount":         37,          // maskelenen varlık sayısı
  "entityTypes":         ["PERSON","ORG","TCKN","IBAN","ADDRESS"],
  "maskTableHash":       "sha256:...",// TABLONUN KENDİSİ DEĞİL, ÖZETİ
  "coverageProof":       "sha256:..." // maskelenmiş metnin özeti
}
```
`maskTableHash` yalnız **özettir**; tablonun kendisi hiçbir alanda taşınmaz (G1).
`maskEvidence` yoksa `6001`, sürümü desteklenmiyorsa `6002` → iş reddedilir.

`JOB_RESULT_ACK` masaüstünün **silme tetiğidir**: `accepted: true` alan masaüstü
işe ait her şeyi anında siler (G3).

### 5.4 Canlılık

| Tip | Yön | `payload` alanları |
|---|---|---|
| `PING` | çift yönlü | `seq` |
| `PONG` | çift yönlü | `seq`, `echoSentAt` |

Varsayılan: `heartbeatIntervalMs = 5000`, `heartbeatTimeoutMs = 15000`
(3 kayıp nabız). Değerler `HELLO_ACK` ile telefon tarafından belirlenir.

### 5.5 Yeniden bağlanma ve sürdürme

| Tip | Yön | `payload` alanları |
|---|---|---|
| `RESUME_REQUEST` | phone → desktop | `jobId`, `localCompletedStages`, `lastKnownCheckpointId` |
| `RESUME_STATE` | desktop → phone | `jobId`, `state`, `completedStages`, `lastCheckpointId`, `checkpointDigest`, `canContinue` |
| `RESUME_ACCEPT` | phone → desktop | `jobId`, `continueFromStage` |

### 5.6 Hata

| Tip | Yön | `payload` alanları |
|---|---|---|
| `ERROR` | çift yönlü | `code`, `codeName`, `message`, `relatesToMessageId`, `jobId?`, `fatal` (bool), `retryAfterMs?` |

`fatal: true` → gönderen bağlantıyı kapatır. Telefon tarafında **her fatal hata,
işin yerelde sürmesiyle sonuçlanır** (G7) — kullanıcıya hata gösterilir ama iş
durmaz.

---

## 6. Durum makineleri

### Telefon (işin sahibi)

```
LOCAL_QUEUED ──teklif onaylandı──> OFFERED ──JOB_ACCEPT──> SENDING_INPUT
     ^                                 │                        │
     │                                 │JOB_REJECT              │JOB_INPUT_COMPLETE
     │                                 v                        v
     └──────────────────────────── LOCAL_QUEUED           REMOTE_RUNNING
     │                                                          │
     │                                             JOB_RESULT_COMPLETE
     │                                                          v
     │                                                    VERIFYING
     │                                                          │
     │  kopma / iptal / doğrulama hatası / fatal hata           │ doğrulandı
     └──────────────────────────────────────────────────────────┤
                                                                v
                                                              DONE
```

**Tek kural:** `DONE` dışındaki **her** durumdan `LOCAL_QUEUED`'a dönüş vardır.
Telefon hiçbir durumda kilitlenmez.

### Masaüstü (işçi)

```
IDLE ──JOB_OFFER+kabul──> ACCEPTED ──ilk chunk──> RECEIVING_INPUT
                                                       │ JOB_INPUT_COMPLETE
                                                       v
                                                    RUNNING ──> DELIVERING
                                                       │             │
                                                       │        JOB_RESULT_ACK
                                                       v             v
                              iptal / kopma / reclaim ──────────> WIPED ──> IDLE
```

`WIPED`'a giriş **geri dönüşsüzdür**: iş verisi, ara ürünler, geçici dosyalar ve
bellekteki kopyalar silinir.

---

## 7. Bağlantı kopması

### 7.1 Telefon ne yapar
1. `heartbeatTimeoutMs` (varsayılan 15 sn) dolduğunda iş `LOCAL_QUEUED`'a döner.
2. **Kullanıcıya sorulmaz.** İş, alınan **son geçerli checkpoint**'ten itibaren
   telefonda sürer. Kopma bir onay noktası değildir.
3. Kullanıcıya gösterilen: "Masaüstü bağlantısı koptu, iş telefonda sürüyor."
   Uyarı bilgilendirmedir, eylem istemez.
4. Yarım kalan iş **kaybolmaz**: `A.0` aşamalı işlem kalıbı gereği her aşamanın
   ara ürünü zaten diske yazılmıştır (`CAPABILITIES.md` §A.0/3).

### 7.2 Masaüstü ne yapar
1. Kopmayı gördüğünde **çalışmayı sürdürür**, sonucu 120 sn tutar (`graceMs = 120000`).
2. 120 sn içinde yeniden bağlanma olmazsa: durur, `WIPED`'a geçer, siler.
3. Yeniden bağlanma olursa `RESUME_REQUEST` bekler; kendiliğinden mesaj göndermez.

### 7.3 Yeniden bağlandığında kim kazanır
Telefon `RESUME_REQUEST` gönderir ve `RESUME_STATE` ile gelen
`completedStages` değerini kendi `localCompletedStages` değeriyle karşılaştırır:

| Koşul | Sonuç |
|---|---|
| `remote > local` **ve** `checkpointDigest` doğrulanıyor | `RESUME_ACCEPT` — uzak ilerleme benimsenir, iş masaüstünde sürer |
| `remote <= local` | `JOB_RECLAIM` (`reason: "local_completed"`) — telefon kendi ilerlemesiyle devam eder |
| `checkpointDigest` doğrulanmıyor | `JOB_RECLAIM` (`reason: "policy"`) + `4002` kaydı |
| Masaüstü silmişse (`3009 JOB_WIPED`) | Telefon zaten yerelde sürüyordu; hiçbir şey yapılmaz |

**Çakışmada telefon kazanır.** Bu G4'ün doğrudan sonucudur. Kural, iş kaybını
imkânsız kılar: en kötü ihtimalle bir miktar hesaplama tekrarlanır.

### 7.4 Uygulama kapanır / telefon yeniden başlarsa
İş kuyruğu kalıcıdır. Açılışta `LOCAL_QUEUED` durumundaki işler kaldığı aşamadan
sürer. Açılışta masaüstüne **kendiliğinden bağlanılmaz**; devir yeniden teklif
edilecekse eşik yeniden değerlendirilir (`CAPABILITIES.md` §C).

---

## 8. Sürüm uyumsuzluğu

`protoVersion` semver'dir: `MAJOR.MINOR.PATCH`.

| Durum | Davranış |
|---|---|
| `MAJOR` aynı, `MINOR` farklı | Uyumlu. Ortak sürüm = `min(phone.MINOR, desktop.MINOR)`. `HELLO_ACK.negotiatedProtoVersion` bunu bildirir; iki taraf da bu sürümün alan kümesiyle konuşur. |
| `MAJOR` aynı, `PATCH` farklı | Tamamen şeffaf. Müzakere yok. |
| `MAJOR` farklı | **Uyumsuz.** `2001 PROTO_MAJOR_MISMATCH`, `fatal: true`, bağlantı kapanır. |
| `protoVersionMin/Max` aralıkları kesişmiyor | `2001`. |
| Sürüm dizgesi bozuk | `2002 PROTO_VERSION_MALFORMED`. |

**Uyumsuzluk hâlinde ne olur:** Telefon işi **yerelde bitirir** (G7). Kullanıcıya
tek satır gösterilir: "Masaüstü sürümü uyumsuz (masaüstü `2.x`, telefon `1.x`).
İş telefonda sürüyor." Devir teklifi o cihaz için, sürüm değişene kadar bir daha
gösterilmez. **Hiçbir koşulda kullanıcı güncelleme yapmaya zorlanmaz ve hiçbir
özellik kilitlenmez.**

**Maskeleme sözleşmesi ayrı sürüme sahiptir.** `maskContractVersion`'ın `MAJOR`'ı
birebir eşleşmek zorundadır; masaüstünün `maskContractVersionMax`'ı telefonunkinden
küçükse `6002 MASK_CONTRACT_UNSUPPORTED` ve devir yapılmaz. Gerekçe: maskeleme
sözleşmesini anlamayan bir masaüstü, maskeleme kanıtını doğrulayamaz — G2 çöker.

**İleri uyumluluk kuralları**
- Yeni **alan** eklemek `MINOR` artışıdır; eski taraf alanı yok sayar.
- Yeni **mesaj tipi** eklemek `MINOR` artışıdır; eski taraf `2003` döner ve
  gönderen bunu "desteklemiyor" diye okur, bağlantıyı kapatmaz.
- Alan **silmek**, alan **anlamını değiştirmek**, zorunlu alan **eklemek** veya
  hata kodunun anlamını değiştirmek `MAJOR` artışıdır.

---

## 9. Hata kodları

| Kod | `codeName` | Anlam | Fatal | Telefonun tepkisi |
|---|---|---|---|---|
| 1001 | `PAIRING_CODE_INVALID` | Kod yanlış | hayır | Denemeye devam |
| 1002 | `PAIRING_CODE_EXPIRED` | 120 sn doldu | evet | Yeni kod üret |
| 1003 | `PAIRING_ATTEMPTS_EXCEEDED` | 3 deneme bitti | evet | Eşleşme iptal |
| 1004 | `PAIRING_REJECTED_BY_USER` | Kullanıcı reddetti | evet | Sessizce kapat |
| 1005 | `PAIRING_UNKNOWN_DEVICE` | Eşleşmemiş cihaz | evet | Bağlantıyı kes |
| 1006 | `PAIRING_REVOKED` | Eşleşme iptal edilmiş | evet | Bağlantıyı kes |
| 2001 | `PROTO_MAJOR_MISMATCH` | Uyumsuz sürüm | evet | §8: yerelde sürdür |
| 2002 | `PROTO_VERSION_MALFORMED` | Bozuk sürüm dizgesi | evet | Yerelde sürdür |
| 2003 | `UNKNOWN_MESSAGE_TYPE` | Bilinmeyen tip | hayır | Özelliği kapalı say |
| 2004 | `ENVELOPE_MALFORMED` | Zarf ayrıştırılamadı | evet | Yerelde sürdür |
| 2005 | `ROLE_NOT_ALLOWED` | Rol dışı mesaj | evet | Bağlantıyı kes, kaydet |
| 2006 | `FEATURE_NOT_SUPPORTED` | Müzakere dışı özellik | hayır | O yolu kullanma |
| 3001 | `JOB_REJECTED_BUSY` | Masaüstü meşgul | hayır | Yerelde sürdür |
| 3002 | `JOB_REJECTED_CAPABILITY` | Yetenek yetersiz | hayır | Yerelde sürdür |
| 3003 | `JOB_REJECTED_BY_USER` | Masaüstü kullanıcısı reddetti | hayır | Yerelde sürdür |
| 3004 | `JOB_ALREADY_EXISTS` | `jobId` çakışması | hayır | Yeni `jobId` ile |
| 3005 | `JOB_UNKNOWN` | Bilinmeyen `jobId` | hayır | Yerelde sürdür |
| 3006 | `JOB_CANCELLED` | İptal edildi | hayır | Yerelde sürdür |
| 3007 | `JOB_TIMEOUT` | Süre aşımı | hayır | Yerelde sürdür |
| 3008 | `JOB_STATE_INVALID` | Duruma aykırı mesaj | hayır | Kaydet, yok say |
| 3009 | `JOB_WIPED` | Silinmiş, sürdürülemez | hayır | Yerelde sürdür |
| 3010 | `JOB_RECLAIMED` | Telefon geri aldı | hayır | — (beklenen) |
| 4001 | `CHUNK_OUT_OF_ORDER` | Parça sırası bozuk | hayır | Parçayı yeniden gönder |
| 4002 | `CHUNK_CHECKSUM_MISMATCH` | `sha256` tutmadı | hayır | Parçayı yeniden gönder (3 kez) |
| 4003 | `PAYLOAD_TOO_LARGE` | 4 MiB aşıldı | hayır | Daha küçük parçala |
| 4004 | `SCHEMA_VALIDATION_FAILED` | `payload` şemaya uymuyor | hayır | Kaydet, işi geri al |
| 4005 | `INPUT_INCOMPLETE` | Eksik parça | hayır | Eksikleri gönder |
| 4006 | `UNSUPPORTED_CONTENT_TYPE` | Bilinmeyen `contentType` | hayır | Yerelde sürdür |
| 5001 | `OUT_OF_MEMORY` | Masaüstü belleği yetmedi | hayır | Yerelde sürdür |
| 5002 | `MODEL_NOT_AVAILABLE` | Model yok | hayır | Yerelde sürdür |
| 5003 | `DISK_FULL` | Disk dolu | hayır | Yerelde sürdür |
| 5004 | `THERMAL_THROTTLED` | Isınma | hayır | `retryAfterMs` kadar bekle |
| 5005 | `INTERNAL_ERROR` | Beklenmeyen hata | hayır | Yerelde sürdür |
| **6001** | `MASK_EVIDENCE_MISSING` | `maskEvidence` yok | **evet** | **Devri iptal et, kullanıcıyı uyar** |
| **6002** | `MASK_CONTRACT_UNSUPPORTED` | Maskeleme sürümü uyumsuz | **evet** | Devri iptal et |
| **6003** | `UNMASKED_PII_DETECTED` | Ham kimlik verisi görüldü | **evet** | **Güvenlik olayı: devri durdur, kaydet, kullanıcıyı uyar, o cihaza bir daha teklif çıkarma** |
| **6004** | `MASK_TABLE_IN_PAYLOAD` | Maske tablosu tespit edildi | **evet** | **Güvenlik olayı: G1 ihlali** |
| 6005 | `SIGNATURE_INVALID` | İmza doğrulanmadı | evet | Bağlantıyı kes |
| 6006 | `REPLAY_DETECTED` | Tekrar/zaman sapması | evet | Bağlantıyı kes |
| 6007 | `TRANSPORT_NOT_ENCRYPTED` | TLS yok | evet | Bağlantıyı kes |

**6xxx kuralı:** Her 6xxx hatası iki tarafta da anında `WIPED`/iptal üretir ve
denetim kaydına yazılır. 6003 ve 6004 ayrıca kullanıcıya **görünür uyarı** çıkarır.

---

## 10. Denetim kaydı

Her devir, telefonda ilgili dosyanın hareket geçmişine tek satır yazar:

```
{ "jobId", "jobType", "thresholdTriggered", "desktopDeviceId",
  "offeredAt", "acceptedAt", "completedAt", "outcome",
  "entityCount", "maskContractVersion", "errorCode" }
```

`outcome`: `"delivered"` | `"reclaimed"` | `"cancelled"` | `"failed"` |
`"security_abort"`. İçerik yazılmaz — yalnız üstveri.

---

## 11. Bu sözleşme nasıl değişir

1. Değişiklik önerisi bu dosyada yapılır; **önce dosya, sonra kod**.
2. Sürüm §8 kurallarına göre artırılır.
3. `MAJOR` artışı bir **geçiş notu** gerektirir: eski sürümdeki iki cihaz
   karşılaştığında ne olacağı yazılır (§8'e satır eklenir).
4. Telefon ve masaüstü modülleri **aynı değişiklikte** güncellenir; tek taraflı
   uyarlama yapılamaz.
5. §1'deki değişmezler (G1–G7) **değiştirilemez**. Bir değişiklik bunlardan
   birini zayıflatıyorsa reddedilir — sürüm artışıyla bile geçmez.
