/*
 * Tek çizgi kalınlığında, 24'lük ızgarada çizilmiş ikon seti.
 * Referanstaki ikonlar ince ve yuvarlak uçlu; hepsi currentColor kullanır ki
 * bulunduğu bağlamın rengini alsın.
 */

import type { ReactElement, SVGProps } from 'react'

export type IconName =
  | 'menu'
  | 'search'
  | 'bell'
  | 'grid'
  | 'calendar'
  | 'folder'
  | 'users'
  | 'chart'
  | 'settings'
  | 'shield'
  | 'sparkles'
  | 'wallet'
  | 'checklist'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-left'
  | 'arrow-up-right'
  | 'clock'
  | 'map-pin'
  | 'refresh'
  | 'plus'
  | 'check'
  | 'close'
  | 'calendar-clock'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  readonly name: IconName
  readonly size?: number
  /** Dekoratif ikonlarda başlık verme; anlamlı ise erişilebilir ad geç. */
  readonly title?: string
}

const paths: Record<IconName, ReactElement> = {
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 4.5-1.5 6-1.5 6h15S18 13.5 18 9Z" />
      <path d="M10.5 19a2 2 0 0 0 3 0" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
    </>
  ),
  'calendar-clock': (
    <>
      <path d="M20.5 11V7.5a2.5 2.5 0 0 0-2.5-2.5H6a2.5 2.5 0 0 0-2.5 2.5V18A2.5 2.5 0 0 0 6 20.5h5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
      <circle cx="17.5" cy="17.5" r="4" />
      <path d="M17.5 15.8v1.9l1.3.9" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.5.7l1.1 1.3h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    </>
  ),
  users: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.8 19.5c.6-3.2 3.2-5 6.2-5s5.6 1.8 6.2 5" />
      <path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6" />
      <path d="M18.4 14.9c1.4.7 2.4 2 2.8 3.9" />
    </>
  ),
  chart: (
    <>
      <path d="M4.5 20V10" />
      <path d="M10 20V4.5" />
      <path d="M15.5 20v-7" />
      <path d="M21 20H3.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.1 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.5 1.5 0 0 0-2.6 1.1 1.9 1.9 0 1 1-3.8 0 1.5 1.5 0 0 0-2.6-1.1l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.5 1.5 0 0 0-1.1-2.6 1.9 1.9 0 1 1 0-3.8 1.5 1.5 0 0 0 1.1-2.6l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.5 1.5 0 0 0 2.6-1.1 1.9 1.9 0 1 1 3.8 0 1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.5 1.5 0 0 0 1.1 2.6 1.9 1.9 0 1 1 0 3.8 1.5 1.5 0 0 0-1.4.9Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 5 6v5.6c0 4.3 2.8 7.6 7 9.2 4.2-1.6 7-4.9 7-9.2V6Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 4 1.4 4.1L17.5 9.5l-4.1 1.4L12 15l-1.4-4.1L6.5 9.5l4.1-1.4Z" />
      <path d="m18 15 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" />
    </>
  ),
  wallet: (
    <>
      <path d="M3.5 8.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2" />
      <rect x="3.5" y="8.5" width="17" height="11" rx="2.5" />
      <path d="M16 14h1.5" />
    </>
  ),
  checklist: (
    <>
      <path d="m3.5 7 1.7 1.7L8.5 5.4" />
      <path d="m3.5 16.5 1.7 1.7 3.3-3.3" />
      <path d="M12 7.5h8.5" />
      <path d="M12 17h8.5" />
    </>
  ),
  'chevron-right': <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  'chevron-down': <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />,
  'arrow-left': (
    <>
      <path d="M19.5 12h-15" />
      <path d="m10.5 5.5-6 6.5 6 6.5" />
    </>
  ),
  'arrow-up-right': (
    <>
      <path d="M7 17 17 7" />
      <path d="M8.5 7H17v8.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3 1.8" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 21c4-4.2 6-7.4 6-10a6 6 0 1 0-12 0c0 2.6 2 5.8 6 10Z" />
      <circle cx="12" cy="11" r="2.3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.2 4.5V10h-5.4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
}

export function Icon({ name, size = 20, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  )
}
