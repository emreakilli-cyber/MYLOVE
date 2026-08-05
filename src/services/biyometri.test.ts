import { describe, expect, it } from 'vitest'
import { biyometriDesteklenirMi, biyometriDogrula } from './biyometri'

/*
 * Biyometri katmanı WebAuthn'e dayanır; Node test ortamında `window` ve
 * platform doğrulayıcı yoktur. Beklenen davranış: çökmeden "desteklenmiyor"
 * demek. Gerçek Face ID / Touch ID akışı yalnızca cihazda doğrulanır.
 */
describe('biyometri', () => {
  it('WebAuthn yoksa desteklenmez döner (çökmeden)', async () => {
    expect(await biyometriDesteklenirMi()).toBe(false)
  })

  it('doğrulama WebAuthn yoksa güvenli biçimde false döner', async () => {
    expect(await biyometriDogrula('sahte-kimlik')).toBe(false)
  })
})
