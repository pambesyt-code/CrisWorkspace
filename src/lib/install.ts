import type { InstallPlatform } from "@/types/workspace";

/**
 * Detección del dispositivo para la guía de instalación (PWA).
 * Funciones puras sobre los datos del navegador para poder probarlas en Node.
 */

export interface BrowserInfo {
  userAgent: string;
  /** `navigator.maxTouchPoints`: distingue un iPad (que se anuncia como Mac) de un Mac. */
  maxTouchPoints: number;
  /** El navegador emitió `beforeinstallprompt` (Chrome/Edge/Android). */
  hasInstallPrompt: boolean;
}

export function detectInstallPlatform({ userAgent, maxTouchPoints, hasInstallPrompt }: BrowserInfo): InstallPlatform {
  const ua = userAgent;
  const isIPhone = /iPhone|iPod/.test(ua);
  // Desde iPadOS 13 el iPad se identifica como «Macintosh», pero tiene pantalla táctil.
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  // En iOS todos los navegadores usan WebKit; Chrome, Firefox, Edge… añaden su marca.
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\//.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/.test(ua);

  if (isIPhone) return isOtherIOSBrowser ? "iphone-otro" : "iphone-safari";
  if (isIPad) return isOtherIOSBrowser ? "iphone-otro" : "ipad-safari";
  if (isAndroid) return hasInstallPrompt ? "android-instalable" : "otro";
  if (/Macintosh/.test(ua) && isSafari) return "mac-safari";
  if (hasInstallPrompt || /Chrome|Edg\//.test(ua)) return "escritorio-instalable";
  return "otro";
}

/** La app ya se está ejecutando instalada (sin la interfaz del navegador). */
export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches;
}

/** Evento no estándar de Chrome/Edge para instalar con un clic. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
