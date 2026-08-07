/*
 * Öğretici moddaki küçük geri bildirimler: "tık" sesi ve titreşim.
 * İkisi de isteğe bağlı ve kapatılabilir olmalı: `prefers-reduced-motion`
 * açıksa ya da çağrıya `sesli=false` geçilirse hiçbir şey yapmaz.
 *
 * Ses için asset taşımıyoruz; WebAudio ile kısa bir tık üretiliyor.
 */

function hareketAzalt(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

let audioCtx: AudioContext | null = null

/** Kısa bir "tık" sesi çalar (sesli değilse ya da hareket azaltılmışsa sessiz). */
export function tikSesi(sesli: boolean): void {
  if (!sesli || hareketAzalt()) return
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return
    audioCtx ??= new AC()
    const ctx = audioCtx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 660
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.07)
  } catch {
    /* ses desteklenmiyorsa sessiz geç */
  }
}

/** Kısa titreşim (destekleniyorsa ve titresimli isteniyorsa). */
export function titret(titresimli: boolean, ms = 12): void {
  if (!titresimli || hareketAzalt()) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* titreşim desteklenmiyorsa sessiz geç */
  }
}

export { hareketAzalt }
