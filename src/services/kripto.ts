/*
 * WebCrypto yardımcıları: PIN özeti ve şifreli yedek.
 *
 * Dürüst kapsam: uygulama içi veriler (IndexedDB) düz saklanır; gerçek disk
 * şifrelemesini işletim sistemi sağlar (iOS'ta cihaz zaten şifreli). Bu katman
 * iki somut güvenceyi verir:
 *   1) Uygulama kilidi — PIN, PBKDF2 ile türetilip yalnızca ÖZETİ saklanır;
 *      PIN'in kendisi hiçbir yerde durmaz.
 *   2) Şifreli yedek — dışa aktarılan dosya AES-GCM ile parolayla şifrelenir;
 *      cihaz dışına çıkan tek veri budur ve şifresiz çıkmaz.
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

const PBKDF2_ITER = 210_000
const TUZ_BAYT = 16
const IV_BAYT = 12

function b64(bayt: ArrayBuffer | Uint8Array): string {
  const u8 = bayt instanceof Uint8Array ? bayt : new Uint8Array(bayt)
  let s = ''
  for (const b of u8) s += String.fromCharCode(b)
  return btoa(s)
}

function b64Coz(metin: string): Uint8Array<ArrayBuffer> {
  const ikili = atob(metin)
  // ArrayBuffer'ı doğrudan ayırıyoruz: TS 5.9 aksi halde Uint8Array<ArrayBufferLike>
  // üretiyor ve bu tür WebCrypto'nun BufferSource beklentisine oturmuyor.
  const u8 = new Uint8Array(new ArrayBuffer(ikili.length))
  for (let i = 0; i < ikili.length; i++) u8[i] = ikili.charCodeAt(i)
  return u8
}

async function anahtarTuret(
  parola: string,
  tuz: BufferSource,
  kullanim: KeyUsage[],
): Promise<CryptoKey> {
  const temel = await crypto.subtle.importKey(
    'raw',
    enc.encode(parola),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: tuz as BufferSource, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    temel,
    { name: 'AES-GCM', length: 256 },
    false,
    kullanim,
  )
}

/* ------------------------------------------------------------------ *
 * PIN özeti
 * ------------------------------------------------------------------ */

/**
 * PIN'den saklanabilir bir özet üretir: "pbkdf2$<tuzB64>$<hashB64>".
 * Ham PIN saklanmaz; doğrulama yeniden türetip karşılaştırır.
 */
export async function pinOzetiUret(pin: string): Promise<string> {
  const tuz = crypto.getRandomValues(new Uint8Array(TUZ_BAYT))
  const temel = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bitler = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: tuz as BufferSource, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    temel,
    256,
  )
  return `pbkdf2$${b64(tuz)}$${b64(bitler)}`
}

/** Girilen PIN, saklanan özetle eşleşiyor mu? */
export async function pinDogrula(pin: string, ozet: string): Promise<boolean> {
  const parcalar = ozet.split('$')
  if (parcalar.length !== 3 || parcalar[0] !== 'pbkdf2') return false
  const tuz = b64Coz(parcalar[1]!)
  const beklenen = parcalar[2]!
  const temel = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bitler = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: tuz as BufferSource, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    temel,
    256,
  )
  // Sabit zamanlı olması şart değil (yerel), ama basit eşitlik yeterli.
  return b64(bitler) === beklenen
}

/* ------------------------------------------------------------------ *
 * Şifreli yedek (AES-GCM + PBKDF2)
 * ------------------------------------------------------------------ */

export interface SifreliZarf {
  bicim: 'juriscalendar-sifreli-yedek'
  surum: 1
  tuz: string
  iv: string
  veri: string
}

/** Düz metni parolayla şifreleyip taşınabilir bir zarf döndürür. */
export async function sifrele(metin: string, parola: string): Promise<SifreliZarf> {
  const tuz = crypto.getRandomValues(new Uint8Array(TUZ_BAYT))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BAYT))
  const anahtar = await anahtarTuret(parola, tuz, ['encrypt'])
  const sifreli = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    anahtar,
    enc.encode(metin),
  )
  return {
    bicim: 'juriscalendar-sifreli-yedek',
    surum: 1,
    tuz: b64(tuz),
    iv: b64(iv),
    veri: b64(sifreli),
  }
}

export class SifreCozmeHatasi extends Error {}

/** Zarfı parolayla çözer. Parola yanlışsa SifreCozmeHatasi fırlatır. */
export async function sifreCoz(zarf: SifreliZarf, parola: string): Promise<string> {
  if (zarf.bicim !== 'juriscalendar-sifreli-yedek') {
    throw new SifreCozmeHatasi('Bu bir JurisCalendar şifreli yedeği değil.')
  }
  const anahtar = await anahtarTuret(parola, b64Coz(zarf.tuz), ['decrypt'])
  try {
    const cozulmus = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64Coz(zarf.iv) as BufferSource },
      anahtar,
      b64Coz(zarf.veri),
    )
    return dec.decode(cozulmus)
  } catch {
    throw new SifreCozmeHatasi('Parola yanlış ya da dosya bozuk.')
  }
}
