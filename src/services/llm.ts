import type { Ayarlar } from '../domain/types'

/*
 * Opsiyonel LLM adaptörü (mimari: services/ katmanı; şartname md. 10).
 *
 * Dürüst kapsam ve gizlilik: uygulama local-first'tür ve varsayılan asistan
 * cihaz içi **kural motorudur**. Bu katman yalnızca kullanıcı Ayarlar'dan açıkça
 * açtığında ve kendi uç noktası + anahtarını girdiğinde devreye girer. Açıldığında
 * bile cihazdan çıkan tek şey, kullanıcının sorusu ve seçtiği dosyanın **kısa
 * özetidir** (ham müvekkil kaydı, TCKN, tam finans dökümü gönderilmez).
 *
 * OpenAI uyumlu `/chat/completions` gövdesi kullanılır; böylece kullanıcı OpenAI,
 * Azure, OpenRouter, yerel Ollama/LM Studio ya da kendi vekil sunucusunu
 * bağlayabilir. Tarayıcıdan doğrudan çağrı CORS'a takılabileceği için kullanıcının
 * CORS'a izin veren bir uç nokta vermesi beklenir.
 */

export type LlmDurumu =
  | 'kapali' // kullanıcı açmadı (varsayılan)
  | 'yapilandirilmadi' // açık ama uç nokta/anahtar eksik
  | 'hazir' // kullanıma hazır

export function llmDurumu(ayarlar: Ayarlar | undefined): LlmDurumu {
  if (!ayarlar?.llmEtkin) return 'kapali'
  if (!ayarlar.llmUcNokta?.trim() || !ayarlar.llmAnahtar?.trim()) {
    return 'yapilandirilmadi'
  }
  return 'hazir'
}

export class LlmHatasi extends Error {}

const SISTEM_ISTEMI =
  'Sen bir Türk hukuk bürosuna yardımcı olan dikkatli bir asistansın. ' +
  'Yalnızca sana verilen dosya özetine dayan; emin olmadığın bilgiyi uydurma. ' +
  'Hukuki süre ve değerlendirmelerin bilgilendirme amaçlı olduğunu, kesin ' +
  'teyidin avukata ait olduğunu belirt. Kısa, açık ve Türkçe yanıtla.'

interface SohbetYaniti {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * Soruyu, seçili dosyanın özetiyle birlikte kullanıcının LLM uç noktasına
 * gönderir ve yanıtı döndürür. Hata durumunda LlmHatasi fırlatır.
 */
export async function llmSor(
  ayarlar: Ayarlar,
  baglamMetni: string,
  soru: string,
): Promise<string> {
  const ucNokta = ayarlar.llmUcNokta?.trim()
  const anahtar = ayarlar.llmAnahtar?.trim()
  if (!ucNokta || !anahtar) {
    throw new LlmHatasi('LLM yapılandırılmadı.')
  }
  const model = ayarlar.llmModel?.trim() || 'gpt-4o-mini'

  let yanit: Response
  try {
    yanit = await fetch(ucNokta, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anahtar}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SISTEM_ISTEMI },
          {
            role: 'user',
            content: `Dosya özeti:\n${baglamMetni}\n\nSoru: ${soru}`,
          },
        ],
      }),
    })
  } catch {
    throw new LlmHatasi(
      'LLM sunucusuna ulaşılamadı. Uç noktayı ve bağlantınızı kontrol edin.',
    )
  }

  if (!yanit.ok) {
    throw new LlmHatasi(
      `LLM sağlayıcı hatası (${yanit.status}). Anahtarı ve modeli kontrol edin.`,
    )
  }

  let veri: SohbetYaniti
  try {
    veri = (await yanit.json()) as SohbetYaniti
  } catch {
    throw new LlmHatasi('LLM yanıtı okunamadı.')
  }

  const metin = veri.choices?.[0]?.message?.content
  if (typeof metin !== 'string' || !metin.trim()) {
    throw new LlmHatasi('LLM boş yanıt döndürdü.')
  }
  return metin.trim()
}

/** Uç noktanın ana bilgisayar adı — "bu veri nereye gidiyor" notu için. */
export function llmSaglayiciAdi(ayarlar: Ayarlar | undefined): string {
  const uc = ayarlar?.llmUcNokta?.trim()
  if (!uc) return 'sağlayıcınız'
  try {
    return new URL(uc).host
  } catch {
    return 'sağlayıcınız'
  }
}
