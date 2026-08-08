/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Derleme kimliği — vite.config.ts içinde `define` ile gömülür. */
declare const __BUILD_ID__: string
/** Derleme zamanı, ISO damgası. */
declare const __BUILD_TIME__: string
/** Uygulama sürümü (package.json) — arayüzde gösterilen sürüm etiketi. */
declare const __APP_VERSION__: string
