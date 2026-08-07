import { AppShell } from './components/AppShell'
import { KilitKapisi } from './components/KilitKapisi'
import { Onboarding } from './onboarding/Onboarding'
import { RouterProvider, Routes } from './router'
import { NotFound, routes } from './app/routes'
import { useAyarlar } from './data/sorgular'
import { ayarlariGuncelle } from './data/ayarlarIslemleri'

export default function App() {
  const ayarlar = useAyarlar()

  // Ayarlar yüklenene kadar kısa boşluk (dönen kullanıcıda onboarding parlamasın).
  if (ayarlar === undefined) return null

  // İlk açılış: öğretici mod. Bittiğinde/atlandığında işaretlenir.
  // (Sonraki turda buraya hukuki onay ekranı — F18 — eklenecek.)
  if (!ayarlar.onboardingTamam) {
    return (
      <Onboarding
        onBitti={() => void ayarlariGuncelle({ onboardingTamam: true })}
      />
    )
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
