import { useEffect, useRef } from 'react'
import { useYaklasanHatirlatmalar } from './hatirlatmaSorgulari'
import { useAyarlar } from './sorgular'
import { cihazBildirimiGoster } from '../services/bildirim'
import { sessizSaatteMi } from '../domain/sessizSaat'

/*
 * Cihaz bildirimi tetikleyici (F13). Uygulama açıkken, tetik anı GELEN bir
 * hatırlatma için tarayıcı bildirimini düşürür — Ayarlar'daki söz ("uygulama
 * açıkken … cihaz bildirimi olarak da düşsün") burada gerçekleşir.
 *
 * Muhafazakâr tasarım (bildirim yağmuru olmasın):
 *  - Açılışta zaten aktif olanlar "bildirildi" sayılır → yalnızca oturum
 *    sırasında AKTİFLEŞENLER bildirim üretir (mevcutlar uygulama içi kutuda).
 *  - Her hatırlatma oturumda en fazla bir kez (id'ye göre tekilleştirme).
 *  - Kapılar: push kanalı açık + tarayıcı izni verili + sessiz saatte değil.
 *    Sessiz saatte bildirim ATLANIR ama "bildirildi" işaretlenmez → pencere
 *    bitince hâlâ aktifse düşer (bastırma değil erteleme).
 */
export function useCihazBildirimTetikleyici(): void {
  const ayarlar = useAyarlar()
  const hatirlatmalar = useYaklasanHatirlatmalar(30)
  const bildirilenler = useRef<Set<string>>(new Set())
  const ilkTur = useRef(true)

  useEffect(() => {
    if (hatirlatmalar === undefined || ayarlar === undefined) return
    const aktifler = hatirlatmalar.filter((h) => h.gecti && !h.ertelendi)

    // İlk tur: mevcut aktifleri tohumla, hiçbirini bildirme (açılış patlaması yok).
    if (ilkTur.current) {
      for (const h of aktifler) bildirilenler.current.add(h.id)
      ilkTur.current = false
      return
    }

    if (!ayarlar.varsayilanKanallar.includes('push')) return

    const simdi = new Date()
    const simdiDk = simdi.getHours() * 60 + simdi.getMinutes()
    if (
      sessizSaatteMi(
        simdiDk,
        ayarlar.sessizSaatBaslangic,
        ayarlar.sessizSaatBitis,
      )
    ) {
      return // sessiz saat: erteleme (işaretleme, pencere bitince düşsün)
    }

    for (const h of aktifler) {
      if (bildirilenler.current.has(h.id)) continue
      bildirilenler.current.add(h.id)
      cihazBildirimiGoster(h.baslik, h.altBaslik ?? '')
    }
  }, [hatirlatmalar, ayarlar])
}
