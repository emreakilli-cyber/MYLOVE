/*
 * Cihazlar arası iş bölümü (devir teslim) adaptörü — mimari: services/ katmanı.
 *
 * Dürüst kapsam: uygulama local-first ve sunucusuzdur; bir masaüstü eşine gerçek
 * iş aktarımı bir eşleme/senkron altyapısı gerektirir (bkz. docs/PLAN.md BEKLEYEN,
 * [!]). Bu katman doğru VARSAYILAN davranışı verir: masaüstü erişilebilir değilse
 * devir hiç sorulmaz, iş sessizce telefonda yapılır. "Telefonda yap" her zaman
 * vardır ve varsayılan seçenektir.
 *
 * Süre tahminleri UYDURULMAZ: yalnızca gerçek ölçümlerin ortalamasından gelir;
 * ölçüm yoksa tahmin gösterilmez.
 */

export type IsTipi = 'uzun-dilekce' | 'toplu-belge'

export const isTipiEtiketleri: Record<IsTipi, string> = {
  'uzun-dilekce': 'Uzun dilekçe yazımı',
  'toplu-belge': 'Toplu belge düzenleme',
}

/**
 * Masaüstü eşi erişilebilir mi? Gerçek algılama sunucu/eşleme ister ([!]); bu
 * yüzden varsayılan `false`. Geliştirme/test için `localStorage['juris-masaustu']`
 * '1' yapılırsa true döner (yalnızca akışı görmek için).
 */
export function masaustuErisilebilir(): boolean {
  try {
    return localStorage.getItem('juris-masaustu') === '1'
  } catch {
    return false
  }
}

/* Oturum içi "telefonda yap" tercihi — yalnızca bellekte; sekme kapanınca sıfırlanır. */
const telefonTercihleri = new Set<IsTipi>()

export function telefonTercihiVar(is: IsTipi): boolean {
  return telefonTercihleri.has(is)
}

export function telefonTercihiKur(is: IsTipi): void {
  telefonTercihleri.add(is)
}

/** Test yardımcı: tercihleri temizle. */
export function _tercihleriSifirla(): void {
  telefonTercihleri.clear()
}

/* Gerçek süre ölçümleri (ms) — iş tipi başına son 20 örnek. */
const olcumler = new Map<IsTipi, number[]>()

export function sureOlc(is: IsTipi, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return
  const dizi = olcumler.get(is) ?? []
  dizi.push(ms)
  while (dizi.length > 20) dizi.shift()
  olcumler.set(is, dizi)
}

/** Ölçülmüş ortalama süre (ms) ya da hiç ölçüm yoksa null (uydurma yok). */
export function sureTahminiMs(is: IsTipi): number | null {
  const dizi = olcumler.get(is)
  if (!dizi || dizi.length === 0) return null
  return Math.round(dizi.reduce((t, x) => t + x, 0) / dizi.length)
}

/** Devir ekranı sorulmalı mı? Masaüstü erişilebilir ve bu oturumda telefon seçilmediyse. */
export function devirSorulmali(is: IsTipi): boolean {
  return masaustuErisilebilir() && !telefonTercihiVar(is)
}

/** Ölçümü okunur metne çevirir ("~3 sn" / "~1,2 sn"). */
export function sureMetni(ms: number | null): string | null {
  if (ms === null) return null
  const sn = ms / 1000
  if (sn < 1) return `~${Math.round(ms)} ms`
  return `~${sn.toFixed(sn < 10 ? 1 : 0).replace('.', ',')} sn`
}
