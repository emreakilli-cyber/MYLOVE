# JurisCalendar — Görsel Referans

Bu doküman, kullanıcının yüklediği ekran kaydından (64 sn, 384×832 portre, iOS Safari,
Replit prototipi) çıkarılan tasarım dilini kayıt altına alır. **Uygulanacak arayüzün
kaynağı budur.** Video oturum konteynerinde tutulmuyor; bu doküman + `design-reference/`
altındaki kareler kalıcı referanstır.

---

## 1. Genel karakter

Sakin, editoryal, "hukuk bürosu kırtasiyesi" hissi veren bir arayüz. Kurumsal SaaS
mavisi **yok**. Sıcak kırık beyaz zemin, beyaz kartlar, ince kenarlıklar, geniş boşluk.
Vurgu renkleri soluk ve pastel — dikkat çeken tek şey içerik.

Mobil öncelikli (tek kolon), ama masaüstünde de çalışmalı.

## 2. Tipografi

Üç ayrı rol, üç ayrı font:

| Rol | Karakter | Kullanım |
|---|---|---|
| **Başlık** | Serif, yüksek kontrast, editoryal | `Günaydın, Av. Ece`, `Yaklaşan son tarihler`, `Dosyalarınızın nabzı.` |
| **Gövde** | Sans-serif, humanist, yumuşak | Kart içerikleri, açıklamalar, liste satırları |
| **Etiket / sayaç** | Monospace, BÜYÜK HARF, geniş harf aralığı (~0.16em) | `TAKİPTE KALIN`, `PAZARTESİ, 3 AĞUSTOS 2026`, `2 gün kaldı`, `09:30`, `03 AĞU` |

Serif başlıklar bölüm adlarında **cümle düzeni** (`Yaklaşan son tarihler`), tanıtım
sayfalarında **nokta ile biten kısa cümle** (`İşinizin resmini görün.`).

Türkçe karakter desteği (İ, ı, ş, ğ, ü, ö, ç) her üç fontta da zorunlu.

## 3. Renk paleti

```
Zemin sayfa      #F7F6F3   sıcak kırık beyaz
Kart             #FFFFFF
Kart kenarlığı   #ECE9E4   çok ince, 1px
Metin birincil   #1C2B2D   koyu, hafif yeşile çalan siyah
Metin ikincil    #6B7472
Metin soluk      #9AA0A0

Adaçayı (marka)  #A8C5B4 / açık #E4EFE7   hero kartı, aktif durum, "iyi" hâli
Koyu lacivert    #16262E                  yan menü, alt güvenlik kartı
Teal vurgu       #5FB49C                  logo, bağlantı, "Sistem hazır" noktası
```

Durum/kategori renkleri (hepsi soluk pastel, zemini `%12` opaklıkta):

```
Kırmızı  #C96A5B   kritik / acil son tarih / BUGÜN rozeti
Turuncu  #D9A45B   uyarı / yaklaşan / YARIN rozeti / duruşma
Mor      #8E7CC3   finans / tahsilat
Mavi     #6E93B8   dosya / belge
Yeşil    #5FB49C   tamamlandı / iyi ilerliyor
```

## 4. Şekil ve gölge

- Kart köşe yarıçapı **16px**; içteki küçük öğeler 10–12px; hap (pill) butonlar tam yuvarlak.
- Gölge neredeyse yok — derinlik 1px kenarlıkla veriliyor. En fazla `0 1px 2px rgba(0,0,0,.04)`.
- Kart iç boşluğu 20px; bölümler arası 16px.
- Hero ve tanıtım kartlarında **dekoratif büyük halka** (ince çemberler, sağ üstte, taşarak kırpılmış).

## 5. Ekran ekran döküm

### 5.1 Üst çubuk (sabit)
Solda hamburger `☰`, sağda daire içinde arama `🔍` ve zil `🔔` (okunmamış varsa kırmızı nokta).
Zemin sayfa rengiyle aynı, kaydırınca ince alt kenarlık.

### 5.2 Hero kartı — `01-dashboard-hero.jpg`
Adaçayı degrade zemin + dekoratif halkalar.
- Üstte mono etiket: `PAZARTESİ, 3 AĞUSTOS 2026`
- Serif büyük başlık: `Günaydın, Av. Ece` (saate göre Günaydın / İyi günler / İyi akşamlar)
- Gövde: `İyi bir gün için önce bugün neyin önemli olduğuna bakalım.`
- Beyaz hap buton, yenile ikonu + `Güncelle`

### 5.3 İstatistik ızgarası (2×2) — `02-stats-deadlines.jpg`
Her kart: sol üstte küçük etiket, sağ üstte kategori rengi noktası, altında **mono büyük sayı**,
en altta küçük değişim metni.

| Etiket | Değer | Alt metin |
|---|---|---|
| Aktif dosya | 24 | +3 bu ay |
| Bu haftaki duruşma | 8 | 2 bugün |
| Bekleyen görev | 17 | 4 öncelikli |
| Bu ay tahsilat | ₺184.500 | +%12 geçen aya göre |

### 5.4 Bölüm başlığı deseni
Her bölüm aynı: mono etiket → serif başlık → sağda `Hepsini gör ↗`.

| Mono etiket | Serif başlık |
|---|---|
| `TAKİPTE KALIN` | Yaklaşan son tarihler |
| `BUGÜNÜN PROGRAMI` | Duruşmalar |
| `İŞ LİSTESİ` | Bugün yapılacaklar |
| `DOSYA SAĞLIĞI` | Hazırlık durumu |
| `İZ BIRAKIN` | Son hareketler |

### 5.5 Yaklaşan son tarihler — `03-deadlines-hearings.jpg`
Satır: solda yuvarlak köşeli renkli takvim ikonu kutusu → başlık + `Dosya — Konu · tarih`
alt satırı → sağda mono `N gün kaldı` (aciliyete göre renk) → `›`.

Örnek veriler: `İstinaf başvuru süresi / Yılmaz / Arslan — İşçilik alacağı · 5 Ağustos / 2 gün kaldı`,
`Bilirkişi ücreti yatırılacak / Demir İnşaat — Tazminat davası · 8 Ağustos / 5 gün kaldı`,
`Cevap dilekçesi son günü / Kaya / Nova — Ticari uyuşmazlık · 12 Ağustos / 9 gün kaldı`.

### 5.6 Duruşmalar
Satır: solda **tarih rozeti** (renkli yumuşak kutu; üstte mono büyük gün `03`, altında küçük ay `AĞU`)
→ tür + dosya + `📍 yer` → sağda `🕐 09:30`.

Örnekler: `Duruşma / Yılmaz / Arslan / İstanbul 14. İş Mahkemesi / 09:30`,
`Müvekkil görüşmesi / Demir İnşaat / Ofis — Toplantı odası 2 / 14:00`,
`Keşif / Kaya / Nova / Kadıköy, Rasimpaşa Mah. / 11:15`.

### 5.7 Bugün yapılacaklar — `04-task-list.jpg`
Onay kutusu + görev metni + altında dosya adı + sağda vade rozeti (`BUGÜN` kırmızı,
`YARIN` turuncu, `6 AĞUSTOS` nötr). Tamamlananlar **üstü çizili + soluk + yeşil dolu kutu**.
En altta kesikli kenarlıklı `+ Yeni görev ekle` satırı.

### 5.8 Hazırlık durumu — `05-file-health.jpg`
Dosya adı + sağda mono yüzde → altında `Müvekkil · Mahkeme` → ince ilerleme çubuğu
→ altında solda bir sonraki adım, sağda durum metni.

```
Yılmaz / Arslan   82%   Seda Yılmaz · İstanbul 14. İş Mahkemesi
                        Duruşma bugün            İyi ilerliyor   (yeşil)
Demir İnşaat      64%   Demir İnşaat A.Ş. · İstanbul 5. Asliye Ticaret
                        Bilirkişi bekleniyor     İyi ilerliyor   (mor)
Kaya / Nova       47%   Mert Kaya · Kadıköy 2. Sulh Hukuk
                        Belge bekleniyor         Dikkat gerekiyor (turuncu)
```

### 5.9 Son hareketler — `06-activity-footer.jpg`
Renkli kare ikon kutusu + eylem başlığı + `nesne · dosya` alt satırı + sağda mono göreli zaman
(`12 dk önce`, `1 saat önce`, `Dün, 16:42`).

### 5.10 Alt güvenlik kartı
Koyu lacivert kart, kalkan ikonu, serif başlık `Dosyalarınız güvende, odağınız sizde.`,
açıklama `JurisCalendar, kritik tarihleri ve iş akışınızı tek bir sakin ekranda tutar.`,
teal bağlantı `Çalışma alanını yönet ↗`.

### 5.11 Yan menü (drawer) — `07-sidebar-drawer.jpg`
Soldan kayan koyu lacivert panel, kalan alan karartılmış.
- Üstte teal yuvarlak `J` + serif `Juris` + mono `CALENDAR`, sağda `✕`
- Mono bölüm etiketi `ÇALIŞMA ALANI`
- Menü: `Genel bakış` (aktif — açık zemin + sol teal çubuk + sağda nokta), `Takvim`,
  `Dosyalar`, `Müvekkiller`, `Raporlar`
- Durum kartı: teal nokta + `Sistem hazır` + `Bugünkü iş akışınız için her şey senkronize.`
- Ayırıcı, sonra `⚙ Ayarlar`
- En altta kullanıcı: turuncu `AK` avatarı + `Ayşe Kaya` / `Kıdemli avukat` + `⌄`

### 5.12 Tanıtım (placeholder) sayfaları — `08`, `09`
Prototipte Takvim / Dosyalar / Müvekkiller / Raporlar henüz boştu:
`← Genel bakışa dön` → renkli ikon karesi → mono breadcrumb `ÇALIŞMA ALANI / RAPORLAR`
→ serif başlık → açıklama → `● Bu alan ürün planında` hapı → `Dashboard'a git ↗`.

| Sayfa | Başlık | Açıklama | Renk |
|---|---|---|---|
| Takvim | `Takvim, sizin ritminizde.` | Duruşmalar, son tarihler ve önemli hatırlatmalar tek bir zaman çizelgesinde yakında burada. | mavi |
| Dosyalar | `Dosyalarınızın nabzı.` | Her dosyanın durumu, hazırlık seviyesi ve bir sonraki adımı için odaklanmış görünüm hazırlanıyor. | mor |
| Müvekkiller | `İlişkiler, bağlamını korur.` | Müvekkil listenizi ve onlarla ilgili dosyaları tek bakışta yönetebileceğiniz alan çok yakında. | yeşil |
| Raporlar | `İşinizin resmini görün.` | Dosya performansı, iş yükü ve takvim sağlığı için sade raporlar hazırlanıyor. | turuncu |

> **Bizim işimiz:** bu dört sayfayı tanıtım ekranı olmaktan çıkarıp gerçekten çalışır hâle
> getirmek. Görsel dil aynı kalacak; ton, tipografi ve boşluk aynen korunacak.

## 6. Yazım tonu

Sakin, saygılı, birinci çoğul değil ikinci tekil-nazik. Ünlem yok. Kısa cümleler.
`Hepsini gör`, `Güncelle`, `Yeni görev ekle`, `Dashboard'a git` gibi net fiiller.
Sayılar Türkçe biçimde: `₺184.500`, `%12`, `3 Ağustos 2026`.
