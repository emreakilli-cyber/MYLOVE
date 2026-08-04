import type { IconName } from '../components/Icon'

export interface NavItem {
  readonly path: string
  readonly label: string
  readonly icon: IconName
  /** Yalnızca tam eşleşmede aktif sayılsın (kök yol için). */
  readonly exact?: boolean
}

export interface NavGroup {
  readonly label: string
  readonly items: readonly NavItem[]
}

/**
 * Yan menünün yapısı. Referansta tek grup vardı; şartnamedeki görev, finans ve
 * asistan alanlarını da taşıyabilmek için ikinci bir grup açtık — görsel dil
 * aynı, yalnızca ikinci bir mono başlık ekleniyor.
 */
export const navGroups: readonly NavGroup[] = [
  {
    label: 'Çalışma alanı',
    items: [
      { path: '/', label: 'Genel bakış', icon: 'grid', exact: true },
      { path: '/takvim', label: 'Takvim', icon: 'calendar' },
      { path: '/dosyalar', label: 'Dosyalar', icon: 'folder' },
      { path: '/muvekkiller', label: 'Müvekkiller', icon: 'users' },
    ],
  },
  {
    label: 'Yürütme',
    items: [
      { path: '/gorevler', label: 'Görevler', icon: 'checklist' },
      { path: '/finans', label: 'Finans', icon: 'wallet' },
      { path: '/asistan', label: 'Asistan', icon: 'sparkles' },
      { path: '/raporlar', label: 'Raporlar', icon: 'chart' },
    ],
  },
]

export const settingsItem: NavItem = {
  path: '/ayarlar',
  label: 'Ayarlar',
  icon: 'settings',
}
