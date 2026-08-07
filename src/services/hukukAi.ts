/*
 * `packages/hukuk-ai` paketinin UYGULAYACAĞI arayüz sözleşmesi.
 *
 * ÖNEMLİ: Bu dosya yalnızca TİP tanımıdır — çalışma zamanı kodu içermez ve
 * `packages/hukuk-ai/` klasörüne DOKUNULMAZ (orada başka bir session çalışıyor).
 * Tüketici (bu uygulama) sözleşmeyi burada tanımlar; gerçek uygulama pakette yazılır.
 *
 * Gizlilik sözleşmesi: `maskele` kimlik bilgilerini maskeli belirteçlerle
 * değiştirir ve eşleme tablosunu döndürür. Eşleme **cihazda kalır**, AI'a yalnızca
 * `maskeliMetin` gider. `demaskele` yanıttaki maskeleri eşlemeyle geri koyar.
 */

/** Maskeli belirteç → ham değer. Yalnızca cihazda tutulur; dışarı çıkmaz. */
export type MaskeEslesmesi = Readonly<Record<string, string>>

export interface MaskeSonucu {
  /** AI'a gönderilebilecek, kimliksizleştirilmiş metin. */
  readonly maskeliMetin: string
  /** Maskeli belirteç → ham değer eşlemesi (cihazda saklanır). */
  readonly eslesme: MaskeEslesmesi
}

/** Bir maskeli parçanın türü — arayüzü kullananların denetleyebilmesi için. */
export type MaskeTuru =
  | 'isim'
  | 'tckn'
  | 'adres'
  | 'iban'
  | 'telefon'
  | 'eposta'
  | 'dosya-no'
  | 'diger'

export interface MaskeParcasi {
  readonly maske: string
  readonly ham: string
  readonly tur: MaskeTuru
}

export interface AiSecenekleri {
  /** Kullanılacak model adı (paket kendi varsayılanını da kullanabilir). */
  readonly model?: string
  /** Üretim sıcaklığı 0–1. */
  readonly sicaklik?: number
}

/**
 * hukuk-ai sözleşmesi. Uygulama bu arayüze bağımlıdır; somut uygulama
 * `packages/hukuk-ai` içinde yazılır ve buraya enjekte edilir.
 */
export interface HukukAi {
  /** Cihazda çalışır: kimlik bilgilerini maskeler, eşlemeyi döndürür. */
  maskele(metin: string): Promise<MaskeSonucu>
  /** Maskeli metni eşlemeyle ham metne geri döndürür (cihazda). */
  demaskele(maskeliMetin: string, eslesme: MaskeEslesmesi): string
  /**
   * Maskeli soru/bağlam üzerinden yanıt üretir. Yanıt da maskeli döner;
   * çağıran taraf `demaskele` ile geri koyar. Kimlik bilgisi asla gönderilmez.
   */
  sor(maskeliSoru: string, secenekler?: AiSecenekleri): Promise<string>
  /** Paketin bu cihazda kullanılabilir olup olmadığı (model indi mi vb.). */
  hazirMi(): Promise<boolean>
}

/**
 * Uygulama, paket enjekte edilene kadar bu "bağlı değil" uygulamayı kullanır.
 * Böylece arayüz tüketicileri paket olmadan da derlenip çalışır (özellik kapalı).
 */
export const bagliDegilHukukAi: HukukAi = {
  async maskele(metin) {
    return { maskeliMetin: metin, eslesme: {} }
  },
  demaskele(maskeliMetin) {
    return maskeliMetin
  },
  async sor() {
    throw new Error('hukuk-ai paketi bu cihazda bağlı değil.')
  },
  async hazirMi() {
    return false
  },
}
