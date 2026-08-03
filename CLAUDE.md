# JurisCalendar

Hukuk profesyonelleri için akıllı dijital takvim ve dosya yönetim sistemi.
Yerelde çalışan (local-first) bir PWA; GitHub Pages'ten kurulup iOS ana ekranına
eklenebilir, sonrasında Capacitor ile App Store paketine dönüşecek.

## Bu oturum bir döngü (/loop) ile yürüyor

Her uyanışta sırasıyla:

1. `docs/PLAN.md` dosyasını oku — döngünün hafızası odur.
2. `[ ]` işaretli **ilk** maddeden devam et. Bir oturumda birden çok madde
   bitirebilirsin; yarım iş bırakma.
3. Arayüz yazarken `docs/DESIGN-REFERENCE.md` ve `docs/design-reference/*.jpg`
   referansından şaşma. Görsel dil pazarlık konusu değil.
4. İşi bitirince `npm run build` ile derlemenin geçtiğini doğrula.
5. `claude/juriscalendar-legal-platform-y8f5lr` dalına commit'le ve push'la.
6. `docs/PLAN.md` içinde biten kutuları `[x]` yap ve "Oturum günlüğü" tablosuna
   tek satır ekle.

Kullanıcıya soru sorma; makul varsayımla ilerle ve varsayımı günlüğe yaz.

## Dil

Arayüzün tamamı **Türkçe**. Kod, değişken adları, commit mesajları İngilizce.
Hukuki terimler Türk hukuku terminolojisine sadık kalsın (esas no, tebligat,
istinaf, adli tatil, gider avansı, vekâlet ücreti…).

## Teknik çerçeve

- React 18 + TypeScript + Vite, `HashRouter`
- Dexie (IndexedDB) ile local-first depolama; sunucu bağımlılığı yok
- Elle yazılmış CSS + tasarım token'ları (`src/styles/tokens.css`)
- `date-fns` + `tr` yerel ayarı
- Grafikler elle yazılmış SVG
- Sunucu gerektiren her şey (SMS, e-posta, push, LLM) `src/services/` altında
  adaptör arkasında; varsayılan uygulama cihaz içi olmalı

## Sınırlar

- Hukuki süre hesabı **bilgilendirme amaçlıdır**. Her ekranda ve hesap
  çıktısında bu uyarı görünür olmalı, kullanıcının teyidi esastır.
- Müvekkil verisi hassastır: veri cihazdan dışarı çıkmaz, üçüncü taraf analitik
  eklenmez, LLM katmanı varsayılan olarak kapalıdır.
