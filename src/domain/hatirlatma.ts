/*
 * Hatırlatma türetme — saf çekirdek.
 *
 * Hatırlatmalar tabloda tutulmaz; olay/süre hedef anından ve ofset profilinden
 * ANLIK türetilir (bkz. data/hatirlatmaSorgulari.ts). Bu dosya o türetmenin saf
 * (yan etkisiz) aritmetiğini taşır ki DB/DOM olmadan test edilebilsin ve iki
 * kanca (yaklaşan liste + aktif sayaç) aynı kuralları paylaşsın.
 *
 * İki eşik bilinçli olarak asimetriktir ve öyle kalmalıdır:
 *   - yaklaşan liste alt sınırı DAHİL eder (tetik >= alt),
 *   - aktif sayaç alt sınırı HARİÇ tutar (tetik > alt).
 */

export const GUN_MS = 86_400_000
const DK_MS = 60_000

/** Ofsetin insan okunur etiketi ("3 gün önce", "1 saat önce", "aynı gün"). */
export function ofsetMetni(dk: number): string {
  if (dk === 0) return 'aynı gün'
  if (dk < 60) return `${dk} dk önce`
  if (dk < 24 * 60) return `${Math.round(dk / 60)} saat önce`
  return `${Math.round(dk / (24 * 60))} gün önce`
}

/** Hatırlatmanın tetikleneceği an (ms): hedeften `ofsetDk` dakika önce. */
export function tetikAni(hedefMs: number, ofsetDk: number): number {
  return hedefMs - ofsetDk * DK_MS
}

/** Yaklaşan liste penceresi: geçmiş 3 gün ile `ufukGun` gün ileri arası. */
export function pencere(
  simdiMs: number,
  ufukGun: number,
): { alt: number; ufuk: number } {
  return { alt: simdiMs - 3 * GUN_MS, ufuk: simdiMs + ufukGun * GUN_MS }
}

/** Tetik yaklaşan liste penceresine giriyor mu (alt sınır dâhil). */
export function pencereDe(tetik: number, alt: number, ufuk: number): boolean {
  return tetik >= alt && tetik <= ufuk
}

/** Tetikleme zamanı geçti mi ("artık zamanı geldi"). */
export function gectiMi(tetik: number, simdiMs: number): boolean {
  return tetik <= simdiMs
}

/**
 * Erteleme çözümü: türetilmiş hatırlatma için ileri (henüz gelmemiş) bir
 * erteleme varsa tetiklemeyi o ana taşır; süresi geçmiş erteleme yok sayılır.
 */
export function etkinTetik(
  erteleme: Record<string, string> | undefined,
  id: string,
  tetik: number,
  simdiMs: number,
): { tetik: number; ertelendi: boolean } {
  const kadar = erteleme?.[id]
  if (kadar) {
    const an = new Date(kadar).getTime()
    if (an > simdiMs) return { tetik: an, ertelendi: true }
  }
  return { tetik, ertelendi: false }
}

/** Bu hatırlatma ileri bir ana ertelenmiş (yani şu an gizli) mi. */
export function ertelemeAktif(
  erteleme: Record<string, string> | undefined,
  id: string,
  simdiMs: number,
): boolean {
  const kadar = erteleme?.[id]
  return kadar !== undefined && new Date(kadar).getTime() > simdiMs
}

/**
 * "Şu an zamanı gelmiş" mi (aktif sayaç için) — alt sınır HARİÇ.
 * Erteleme kontrolü ayrıca `ertelemeAktif` ile yapılır.
 */
export function aktifMi(tetik: number, alt: number, simdiMs: number): boolean {
  return tetik > alt && tetik <= simdiMs
}
