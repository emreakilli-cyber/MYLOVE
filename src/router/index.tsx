/*
 * Minimal hash tabanlı yönlendirici.
 *
 * Neden kendi yönlendiricimiz: uygulama saf istemci tarafı, sunucusuz ve
 * GitHub Pages'ten yayınlanıyor. Hash yönlendirme sunucu tarafında 404
 * yeniden yazımı gerektirmez ve iOS ana ekran kısayolunda sorunsuz çalışır.
 * İhtiyacımız olan yüzey (eşleştirme, parametre, gezinme, geri) yüz satırdan
 * küçük olduğu için harici bağımlılık taşımıyoruz.
 */

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type RouteParams = Readonly<Record<string, string>>

export interface Location {
  /** Sorgu dizesi ayıklanmış yol, her zaman "/" ile başlar. */
  readonly path: string
  readonly query: URLSearchParams
}

interface RouterContextValue {
  readonly location: Location
  readonly navigate: (to: string, options?: { replace?: boolean }) => void
  readonly back: () => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

function readLocation(): Location {
  const raw = window.location.hash.replace(/^#/, '')
  const [pathPart = '', queryPart = ''] = raw.split('?')
  const path = pathPart.startsWith('/')
    ? pathPart
    : `/${pathPart}`.replace(/\/+$/, '') || '/'
  return {
    path: path === '' ? '/' : path,
    query: new URLSearchParams(queryPart),
  }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(readLocation)

  useEffect(() => {
    const onHashChange = () => setLocation(readLocation())
    window.addEventListener('hashchange', onHashChange)
    // İlk yüklemede hash boşsa köke sabitle ki adres çubuğu tutarlı olsun.
    if (!window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}#/`)
    }
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      const target = to.startsWith('/') ? to : `/${to}`
      const nextHash = `#${target}`
      if (window.location.hash === nextHash) return
      if (options?.replace) {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}${nextHash}`,
        )
        setLocation(readLocation())
      } else {
        window.location.hash = nextHash
      }
    },
    [],
  )

  const back = useCallback(() => window.history.back(), [])

  const value = useMemo<RouterContextValue>(
    () => ({ location, navigate, back }),
    [location, navigate, back],
  )

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  )
}

function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext)
  if (!ctx) {
    throw new Error('useRouter yalnızca RouterProvider içinde kullanılabilir')
  }
  return ctx
}

export function useLocation(): Location {
  return useRouter().location
}

export function useNavigate() {
  return useRouter().navigate
}

export function useBack() {
  return useRouter().back
}

/**
 * "/dosyalar/:id" kalıbını "/dosyalar/42" yoluna eşler.
 * Eşleşmezse null, eşleşirse parametre sözlüğü döner.
 */
export function matchPath(pattern: string, path: string): RouteParams | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)

  // Sondaki "*" kalan tüm segmentleri yakalar.
  const hasWildcard = patternParts.at(-1) === '*'
  if (!hasWildcard && patternParts.length !== pathParts.length) return null
  if (hasWildcard && pathParts.length < patternParts.length - 1) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    if (patternPart === '*') break
    const pathPart = pathParts[i]
    if (pathPart === undefined) return null
    if (patternPart === undefined) return null
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart)
    } else if (patternPart !== pathPart) {
      return null
    }
  }
  return params
}

export interface RouteDefinition {
  /** "/dosyalar/:id" biçiminde kalıp. */
  readonly path: string
  readonly render: (params: RouteParams) => ReactNode
  /** Sekme/geçmiş ve ekran okuyucu için sayfa başlığı (WCAG 2.4.2). */
  readonly baslik?: string
}

interface RoutesProps {
  readonly routes: readonly RouteDefinition[]
  readonly fallback: ReactNode
}

export function Routes({ routes, fallback }: RoutesProps) {
  const { path } = useLocation()

  const matched = useMemo(() => {
    for (const route of routes) {
      const params = matchPath(route.path, path)
      if (params) return { route, params }
    }
    return null
  }, [routes, path])

  // Gezinince içerik başa sarsın; tarayıcı geri tuşu da aynı davranır.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [path])

  // Her rota kendi başlığını taşısın (WCAG 2.4.2): ekran okuyucu sayfa
  // değişimini duyurur, tarayıcı geçmişi ve sekmeler anlamlı olur.
  const baslik = matched?.route.baslik ?? 'Sayfa bulunamadı'
  useEffect(() => {
    document.title = `${baslik} · JurisCalendar`
  }, [baslik])

  // Eşleşen içeriği **yola göre anahtarla**: bir kayıttan (`/finans/A`)
  // başkasına (`/finans/B`) geçildiğinde React aynı bileşen örneğini yeniden
  // kullanmasın, taze mount etsin. Aksi hâlde "yalnızca bir kez ön-doldur"
  // (`yuklendi`) korumalı düzenleme formları önceki kaydın verisini gösterir
  // ve kaydedilirse yanlış kaydın üzerine yazılır (veri bozulması). Anahtar
  // sorgu dizesini içermez → aynı yolda süzgeç (query) değişimi remount etmez.
  if (matched) return <Fragment key={path}>{matched.route.render(matched.params)}</Fragment>
  return <Fragment key="__404__">{fallback}</Fragment>
}

interface LinkProps {
  readonly to: string
  readonly children: ReactNode
  readonly className?: string
  readonly replace?: boolean
  readonly ariaLabel?: string
  /** Aktif gezinme öğesi ise "page" geç — stil ve ekran okuyucu bunu kullanır. */
  readonly ariaCurrent?: 'page'
  readonly onNavigate?: () => void
}

export function Link({
  to,
  children,
  className,
  replace,
  ariaLabel,
  ariaCurrent,
  onNavigate,
}: LinkProps) {
  const navigate = useNavigate()
  return (
    <a
      href={`#${to.startsWith('/') ? to : `/${to}`}`}
      className={className}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onClick={(event) => {
        // Yeni sekmede açma niyetini bozmayalım.
        if (event.metaKey || event.ctrlKey || event.shiftKey) return
        event.preventDefault()
        navigate(to, replace ? { replace: true } : undefined)
        onNavigate?.()
      }}
    >
      {children}
    </a>
  )
}

/** Verilen kalıp şu anki yola uyuyor mu (yan menüde aktif durum için). */
export function useIsActive(pattern: string, exact = false): boolean {
  const { path } = useLocation()
  if (exact) return path === pattern
  if (pattern === '/') return path === '/'
  return path === pattern || path.startsWith(`${pattern}/`)
}
