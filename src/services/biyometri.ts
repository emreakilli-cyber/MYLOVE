/*
 * Biyometrik açış (WebAuthn platform authenticator).
 *
 * Dürüst kapsam: PIN gibi bu da bir ERİŞİM kapısıdır — cihaz sahibinin orada
 * olduğunu (Face ID / Touch ID / Windows Hello) kanıtlar, veriyi şifrelemez.
 * Sunucu olmadığı için imza doğrulaması yapılmaz; güvence, platform
 * doğrulayıcısının kullanıcıyı yerelde doğrulamasından gelir. Yine de PIN'e göre
 * gündelik kullanımda çok daha hızlı ve en az onun kadar güçlü bir engeldir.
 *
 * Kayıtlı kimlik (credential id) Ayarlar'da saklanır; parola ya da biyometrik
 * veri hiçbir yerde durmaz — o cihazın güvenli bölgesinde kalır.
 */

function b64(bayt: ArrayBuffer): string {
  const u8 = new Uint8Array(bayt)
  let s = ''
  for (const b of u8) s += String.fromCharCode(b)
  return btoa(s)
}

function b64Coz(metin: string): Uint8Array<ArrayBuffer> {
  const ikili = atob(metin)
  const u8 = new Uint8Array(new ArrayBuffer(ikili.length))
  for (let i = 0; i < ikili.length; i++) u8[i] = ikili.charCodeAt(i)
  return u8
}

/** Tarayıcı WebAuthn'i ve yerleşik (platform) biyometriyi destekliyor mu? */
export async function biyometriDesteklenirMi(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const w = window as unknown as {
    PublicKeyCredential?: {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
    }
  }
  const pkc = w.PublicKeyCredential
  if (!pkc?.isUserVerifyingPlatformAuthenticatorAvailable) return false
  try {
    return await pkc.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Bu cihazda biyometrik açışı kaydeder. Başarılıysa saklanacak kimlik (b64)
 * döner; kullanıcı vazgeçer ya da cihaz desteklemezse null.
 */
export async function biyometriKaydet(): Promise<string | null> {
  if (!(await biyometriDesteklenirMi())) return null

  const meydan = crypto.getRandomValues(new Uint8Array(32))
  const kullaniciKimlik = crypto.getRandomValues(new Uint8Array(16))

  try {
    const kimlik = (await navigator.credentials.create({
      publicKey: {
        // rp.id özellikle atlanıyor: tarayıcı geçerli kaynağın alan adını
        // kullanır, böylece localhost ve github.io'da aynı kod çalışır.
        rp: { name: 'JurisCalendar' },
        user: {
          id: kullaniciKimlik,
          name: 'juriscalendar-yerel',
          displayName: 'JurisCalendar',
        },
        challenge: meydan,
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!kimlik) return null
    return b64(kimlik.rawId)
  } catch {
    return null
  }
}

/**
 * Kayıtlı kimlikle biyometrik doğrulama ister. Kullanıcı yüzü/parmağıyla
 * onaylarsa true; vazgeçer ya da başarısız olursa false.
 */
export async function biyometriDogrula(kimlikB64: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.credentials) return false

  const meydan = crypto.getRandomValues(new Uint8Array(32))

  try {
    const sonuc = await navigator.credentials.get({
      publicKey: {
        challenge: meydan,
        allowCredentials: [
          {
            type: 'public-key',
            id: b64Coz(kimlikB64),
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return sonuc !== null
  } catch {
    return false
  }
}
