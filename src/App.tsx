import { AppShell } from './components/AppShell'
import { KilitKapisi } from './components/KilitKapisi'
import { Onboarding } from './onboarding/Onboarding'
import { HukukiOnay } from './onboarding/HukukiOnay'
import { RouterProvider, Routes } from './router'
import { NotFound, routes } from './app/routes'
import { useAyarlar } from './data/sorgular'
import { ayarlariGuncelle } from './data/ayarlarIslemleri'
import { onayGerekli } from './data/onayIslemleri'

export default function App() {
  const ayarlar = useAyarlar()

  // Ayarlar yüklenene kadar kısa boşluk (dönen kullanıcıda onboarding parlamasın).
  if (ayarlar === undefined) return null

  // İlk açılış: öğretici mod. Bittiğinde/atlandığında işaretlenir; ardından onay.
  if (!ayarlar.onboardingTamam) {
    return (
      <Onboarding
        onBitti={() => void ayarlariGuncelle({ onboardingTamam: true })}
      />
    )
  }

  // Hukuki onay: kayıt yoksa ya da metin sürümü değiştiyse; atlanamaz.
  if (onayGerekli(ayarlar)) {
    return <HukukiOnay onOnaylandi={() => undefined} />
  }

  return (
    <RouterProvider>
      <KilitKapisi>
        <AppShell>
          <Routes routes={routes} fallback={<NotFound />} />
        </AppShell>
      </KilitKapisi>
    </RouterProvider>
  )
}
