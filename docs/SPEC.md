# SPEC — Maskeleme Sözleşmesi

**`maskContractVersion`:** `1.0.0`
**Durum:** Bağlayıcı. `PROTOCOL.md` §8 bu sürüme atıf yapar.

Maskeleme, müvekkil verisinin cihazdan çıkabilmesinin **tek** koşuludur
(`CAPABILITIES.md` A3). Bu belge neyin maskelendiğini, nasıl maskelendiğini ve
geri dönüşün nasıl garanti edildiğini tanımlar.

---

## 1. Değişmezler

| No | Değişmez | Doğrulayan test |
|---|---|---|
| **S1** | `unmask(mask(x).text, mask(x).table) === x` — **birebir**, istisnasız | M12.1 |
| **S2** | Maske tablosu serileştirilip ağa gönderilemez. Ağa çıkabilen tek biçim `sha256` özetidir | M5.5, M5.6 |
| **S3** | Maskeleme koşamazsa dışarı **hiçbir** veri gitmez. Başarısızlık = iş durur | M7.4 |
| **S4** | Aynı girdi + aynı seçenekler → aynı çıktı (deterministik) | M5.2 |
| **S5** | Kural katmanı her zaman NER katmanından **önce** koşar | M3.7 |
| **S6** | Bir kökün tüm çekimli biçimleri **aynı** maske token'ına düşer | M4.6 |

---

## 2. Varlık tipleri

| Kod | Türkçe | Katman | Örnek | Duyarlılık |
|---|---|---|---|---|
| `TCKN` | T.C. kimlik no | kural | `10000000146` | kritik |
| `IBAN` | IBAN | kural | `TR33 0006 1005 1978 6457 8413 26` | kritik |
| `TEL` | Telefon | kural | `0532 111 22 33` | yüksek |
| `EPOSTA` | E-posta | kural | `av.ahmet@ornek.com` | yüksek |
| `PLAKA` | Araç plakası | kural | `34 ABC 123` | yüksek |
| `ESAS` | Dosya / esas / karar no | kural | `2024/1234 E.` | yüksek |
| `TARIH` | Tarih | kural | `12.03.2024` | orta |
| `KISI` | Gerçek kişi adı | NER | `Ahmet Yılmaz` | kritik |
| `KURUM` | Tüzel kişi / kurum | NER | `Demir İnşaat Ltd. Şti.` | yüksek |
| `ISYERI` | İşyeri / ticari mekân | NER | `Egeperla AVM` | yüksek |
| `ADRES` | Adres | NER | `Alsancak Mah. 1470 Sok. No:3` | kritik |

**Tip kodları neden Türkçe:** Maske token'ları cihaz içi Türkçe dil modeline
giden metnin içinde yer alır. `[KISI_1]` Türkçe bir cümlede `[PERSON_1]`'den
daha doğal okunur ve modelin bağlamı bozma ihtimali düşer. Kod tarafındaki
tanımlayıcılar İngilizce kalır; bu kodlar **veri değeridir**, tanımlayıcı değil.

---

## 3. Maske token biçimi

### 3.1 Dilbilgisi

```
token      = "[" tip "_" sıra "]"
tip        = 2..12 ASCII büyük harf   ; §2 tablosundaki kodlar
sıra       = 1..n ondalık, baştan sıfırsız
```

Örnek: `[KISI_1]`, `[TCKN_2]`, `[ESAS_1]`

### 3.2 Çakışmazlık — kaçış kuralı

Kullanıcı metninde doğal olarak `[KISI_1]` dizgesi geçebilir. Bunun unmask'i
bozmaması için maskeleme **öncesi** kaçışlama yapılır:

| Aşama | Dönüşüm |
|---|---|
| Kaçışlama (mask öncesi) | `[` `!`* `TIP_N` `]` → `[` `!` `!`* `TIP_N` `]` (bir `!` eklenir) |
| Kaçış çözme (unmask sonrası) | `[` `!` `!`* `TIP_N` `]` → `[` `!`* `TIP_N` `]` (bir `!` silinir) |

Gerçek maske token'ları **hiçbir zaman** `!` içermez. Unmask sırasında token
araması `!` içermeyen desene bakar, dolayısıyla kaçışlanmış dizgeler yanlışlıkla
çözülmez. Dönüşüm çifti bir **eşleme** (bijection) olduğu için S1 korunur.

Örnek: girdi `Dosyada [KISI_1] yazıyordu` → kaçışlanmış `Dosyada [!KISI_1] yazıyordu`
→ maskeleme değiştirmez → unmask kaçışı çözer → `Dosyada [KISI_1] yazıyordu`. ✔

### 3.3 Sıra numarası

Numaralar **tip başına**, metinde **ilk görülme sırasına** göre 1'den başlar.
Aynı varlık ikinci kez geçtiğinde yeni numara almaz.

---

## 4. Deterministik eşleme

### 4.1 Eşleme anahtarı

Bir varlık, `(tip, normalleştirilmiş kök)` çiftiyle tanımlanır.

| Tip sınıfı | Normalleştirme |
|---|---|
| `TCKN`, `IBAN`, `TEL`, `PLAKA` | Boşluk/ayırıcı silinir, harfler Türkçe kurala göre büyütülür |
| `EPOSTA` | Küçültülür |
| `ESAS`, `TARIH` | Ham biçim korunur, boşluklar sadeleştirilir |
| `KISI`, `KURUM`, `ISYERI`, `ADRES` | Çekim eki ayrılır (M4), kök Türkçe kurala göre normalleştirilir |

Aynı anahtar → aynı token. Bu, S6'nın (çekim eki birliği) mekanizmasıdır:
`Ahmet`, `Ahmet'in`, `Ahmet'e`, `Ahmet'ten` hepsi `(KISI, "AHMET")` anahtarına
düşer ve tek token alır.

### 4.2 Determinizm sınırı

Determinizm **oturum içidir**: aynı `MaskTable` ile aynı girdi her zaman aynı
çıktıyı verir. Farklı bir tablo ile başlanan yeni bir oturumda numaralar yine
1'den ve aynı sırayla üretilir; dolayısıyla **aynı metin tek başına
maskelendiğinde her zaman aynı sonucu verir**. Birden çok belge aynı tabloya
maskelenirse numaralar belge sırasına bağlıdır — bu kasıtlıdır, dosya boyunca
kişi kimliğinin tutarlı kalmasını sağlar.

---

## 5. Unmask algoritması

```
unmask(text, table):
  1. text içindeki tüm [TIP_N] desenlerini soldan sağa tara
     (desen: \[[A-Z]{2,12}_[0-9]+\] — '!' içerenler eşleşmez)
  2. her eşleşme için table.lookup(token):
       bulunursa  -> kökün ORİJİNAL metni ile değiştir
       bulunmazsa -> §5.1 kuralına göre davran
  3. kaçış çözme uygula (§3.2)
  4. sonucu döndür
```

Tarama soldan sağa **tek geçişlidir**; token'lar birbirini içeremeyeceği için
en uzun eşleşme sorunu doğmaz.

### 5.1 Bozuk / bilinmeyen token davranışı

| Durum | Davranış |
|---|---|
| `[KISI_99]` — tabloda yok | **Aynen bırakılır.** Hata fırlatılmaz, çökme olmaz. `unresolved` listesine eklenir |
| `[KISI_` — kapanmamış | Desene uymaz, düz metin sayılır, aynen bırakılır |
| `[kisi_1]` — küçük harf | Desene uymaz, aynen bırakılır |
| `[KISI_0]`, `[KISI_007]` | Desene uymaz (baştan sıfır yasak), aynen bırakılır |
| `[!KISI_1]` | Kaçışlanmış; §3.2 ile `[KISI_1]`'e döner |

`unmask` sonucu `{ text, unresolved[] }` döndürür. `unresolved` boş değilse
çağıran taraf kullanıcıyı uyarır — model uydurmuş bir token üretmiş olabilir.
**Sessiz veri kaybı yoktur.**

---

## 6. Katman sırası ve çakışma çözümü

1. **Kaçışlama** (§3.2)
2. **Kural katmanı** — deterministik desenler, doğrulama algoritmalı (S5)
3. **NER katmanı** — yalnız kural katmanının dokunmadığı aralıklarda
4. **Elle düzenleme** — kullanıcının onay ekranındaki müdahaleleri (M6)
5. **Değiştirme** — aralıklar sondan başa doğru token'larla değiştirilir

### 6.1 Çakışan aralıklar

İki aralık kesişiyorsa:
1. **Uzun olan kazanır.**
2. Uzunluk eşitse **öncelik sırası** karar verir (küçük sayı önce):

| Öncelik | Tip |
|---|---|
| 10 | `TCKN` |
| 20 | `IBAN` |
| 30 | `ESAS` |
| 40 | `EPOSTA` |
| 50 | `PLAKA` |
| 60 | `TEL` |
| 70 | `TARIH` |
| 80 | `KISI` |
| 90 | `KURUM` |
| 95 | `ISYERI` |
| 100 | `ADRES` |

3. İkisi de eşitse metinde **önce başlayan** kazanır.

### 6.2 İç içe geçmiş varlık

`Egeperla AVM sahibi Ahmet Yılmaz` → iki **ayrı, kesişmeyen** aralık:
`[ISYERI_1] sahibi [KISI_1]`. Kesişme yoksa çakışma çözümü devreye girmez.

Gerçek iç içelik (`Ahmet Yılmaz İnşaat Ltd. Şti.` — kurum adı kişi adı içeriyor)
durumunda §6.1/1 gereği **uzun olan** kazanır: tamamı `[KURUM_1]` olur, içindeki
kişi adı ayrıca maskelenmez. Gerekçe: kurum adının parçalı maskelenmesi
(`[KISI_1] İnşaat Ltd. Şti.`) hem okunaksızdır hem de kişi kimliğini sızdırır.

---

## 7. Bilinen sınırlar

Bu bölüm dürüstlük bölümüdür. Aşağıdakiler **yakalanamaz veya güvenilmez**:

1. **Bağlamdan çıkan kimlik.** "Müvekkilin ağabeyi olan emekli albay" — hiçbir
   varlık adı geçmez ama kişi tanımlanabilir. Maskeleme sözcük düzeyinde çalışır,
   çıkarım düzeyinde değil.
2. **Nadir / yabancı özel adlar.** Yerel sözlükte ve modelde bulunmayan adlar
   (özellikle yabancı uyruklu taraf adları) atlanabilir.
3. **Yazım hatalı kimlik verisi.** `TR33 0006 1005 1978 6457 8413 2` (bir hane
   eksik) checksum'dan geçmez, maskelenmez — ama insan gözüyle hâlâ okunabilir.
   Kural: **doğrulanamayan aday, `preflightCheck`'te (M11) kullanıcıya "şüpheli"
   olarak gösterilir**, sessizce geçilmez.
4. **Görüntü içindeki metin.** OCR'dan geçmemiş taranmış belgedeki veri
   maskelenemez. OCR zorunlu ön adımdır.
5. **Tablolarda parçalanmış veri.** Bir hücrede ad, diğerinde soyad → kural
   katmanı ilişkilendiremez; NER katmanı satır bağlamı görmezse atlar.
6. **Kısaltılmış adlar.** `A.Y.`, `Ah. Yılmaz` — düşük güvenle yakalanır,
   yanlış pozitif oranı yüksektir.
7. **Aynı soyisimli kişilerin tekil geçişi.** `Ahmet Yılmaz` ve `Mehmet Yılmaz`
   ayrı token alır; ama metinde yalnız `Yılmaz` geçtiğinde hangisi olduğu
   belirsizdir. Bu durum **belirsiz** olarak işaretlenir ve kullanıcıya sorulur
   (M5.3) — tahmin edilmez.
8. **Tarih maskelemenin yan etkisi.** Tüm tarihler maskelendiğinde kronoloji
   okunmaz hâle gelebilir. `TARIH` bu yüzden **kapatılabilir** tek tiptir;
   kapatma kararı kullanıcınındır ve onay ekranında görünür.
9. **Ters mühendislik.** Yeterince uzun bir metinde `[KISI_1]`'in kim olduğu
   bağlamdan çıkarılabilir. Maskeleme, veriyi **anonimleştirmez**; kimlik
   verisinin düz metin olarak ağa çıkmasını engeller. Bu farkın kullanıcıya
   açıkça söylenmesi gerekir.

---

## 8. Sürüm ve `PROTOCOL.md` bağı

`maskContractVersion` semver'dir ve `PROTOCOL.md` §5.3 `maskEvidence` alanında
taşınır. `MAJOR` birebir eşleşmezse devir yapılmaz (`6002`).

| Değişiklik | Sürüm etkisi |
|---|---|
| Yeni varlık tipi eklemek | `MINOR` |
| Yeni tespit deseni eklemek | `PATCH` |
| Token dilbilgisini değiştirmek | `MAJOR` |
| Kaçış kuralını değiştirmek | `MAJOR` |
| Öncelik tablosunu değiştirmek | `MAJOR` |
| Normalleştirme kuralını değiştirmek | `MAJOR` |

§1'deki değişmezler (S1–S6) sürüm artışıyla bile değiştirilemez.
