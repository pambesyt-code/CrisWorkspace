"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { InstallState } from "@/types/workspace";
import { detectInstallPlatform, isRunningStandalone, type BeforeInstallPromptEvent } from "@/lib/install";

/**
 * Estado de instalación como app. El evento `beforeinstallprompt` puede llegar
 * antes de que React monte, así que se escucha desde que se carga el módulo
 * y se guarda en un pequeño almacén externo.
 */

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let snapshot: InstallState | null = null;
const listeners = new Set<() => void>();

function computeState(): InstallState {
  return {
    platform: detectInstallPlatform({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      hasInstallPrompt: deferredPrompt !== null,
    }),
    isInstalled: installedNow || isRunningStandalone(),
    canPromptInstall: deferredPrompt !== null,
  };
}

function emit(): void {
  snapshot = null;
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // Mostramos nuestro propio botón en lugar del aviso del navegador.
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedNow = true;
    emit();
  });
  window.matchMedia("(display-mode: standalone)").addEventListener("change", emit);
}

const SERVER_STATE: InstallState = { platform: "otro", isInstalled: false, canPromptInstall: false };

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): InstallState {
  snapshot ??= computeState();
  return snapshot;
}

export function useInstall(): { install: InstallState; promptInstall: () => void } {
  const install = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
  const promptInstall = useCallback(() => {
    const event = deferredPrompt;
    if (!event) return;
    void event
      .prompt()
      .then(() => event.userChoice)
      .then((choice) => {
        if (choice.outcome === "accepted") installedNow = true;
      })
      .catch((error: unknown) => console.error("[CrisWorkspace] No se pudo abrir la instalación", error))
      .finally(() => {
        // El aviso solo se puede usar una vez.
        deferredPrompt = null;
        emit();
      });
  }, []);
  return { install, promptInstall };
}
