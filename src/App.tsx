import { useEffect } from 'react'
import { AppShell } from './components/AppShell'
import { KilitKapisi } from './components/KilitKapisi'
import { HukukiOnay } from './onboarding/HukukiOnay'
import { KayitEkrani } from './onboarding/KayitEkrani'
import { Tur } from './tur/Tur'
import { RouterProvider, Routes } from './router'
import { NotFound, routes } from './app/routes'
import { useAyarlar } from './data/sorgular'
import { ayarlariGuncelle } from './data/ayarlarIslemleri'
import { onayGerekli } from './data/onayIslemleri'
import { yaziOlcegiCss } from './domain/yaziOlcegi'

export default function App() {
  const ayarlar = useAyarlar()

  // Erişilebilirlik: seçilen yazı boyutunu köke uygula (tüm ekranlar ölçeklenir).
  // Kanca koşulsuz çalışmalı, o yüzden erken dönüşten ÖNCE.
  useEffect(() => {
    document.documentElement.style.fontSize = yaziOlcegiCss(ayarlar?.yaziOlcegi)
    // Ölçeği kökte bir veri özniteliği olarak da yaz: CSS, büyük yazıda dar
    // kalan iki-sütunlu satırları (ör. tarih alanları) tek sütuna indirmek için
    // buna bakar. Medya sorguları kök font-size ölçeğini göremediği için gerekli.
    document.documentElement.dataset.yaziOlcegi = ayarlar?.yaziOlcegi ?? 'normal'
  }, [ayarlar?.yaziOlcegi])

  // Ayarlar yüklenene kadar kısa boşluk (dönen kullanıcıda kapı ekranı parlamasın).
  if (ayarlar === undefined) return null

  // Hukuki onay: kayıt yoksa ya da metin sürümü değiştiyse; atlanamaz.
  if (onayGerekli(ayarlar)) {
    return <HukukiOnay onOnaylandi={() => undefined} />
  }

  // Kayıt / profil: ad-soyad-ünvan alınmadıysa.
  if (!ayarlar.profilKuruldu) {
    return <KayitEkrani onTamam={() => undefined} />
  }

  // Kayıt tamamsa uygulama açılır; ilk girişte rehberli tur gerçek panelleri gezer.
  const turGoster = !ayarlar.turGoruldu

  return (
    <RouterProvider>
      <KilitKapisi>
        <AppShell turAktif={turGoster}>
          <Routes routes={routes} fallback={<NotFound />} />
        </AppShell>
        {turGoster ? (
          <Tur onBitti={() => void ayarlariGuncelle({ turGoruldu: true })} />
        ) : null}
      </KilitKapisi>
    </RouterProvider>
  )
}
