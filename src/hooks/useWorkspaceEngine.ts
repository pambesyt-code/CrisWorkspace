"use client";

import { useEffect } from "react";
import { startTicker } from "@/lib/broadcast/ticker";
import { notesStorage, useNotesStore } from "@/store/notesStore";
import { settingsStorage, useSettingsStore } from "@/store/settingsStore";
import { studioStorage, useStudioStore } from "@/store/studioStore";

/**
 * Carga los datos guardados en IndexedDB (una sola vez, en el cliente) y
 * garantiza que el autoguardado pendiente se escribe al ocultar o cerrar la pestaña.
 */
/**
 * Stores que ya empezaron a cargar. Se guarda el propio store (no un booleano)
 * para que, si la recarga en caliente de desarrollo crea un store nuevo, este
 * también se cargue; y para que el doble montaje de React no cargue dos veces.
 */
const rehydrationStarted = new WeakSet<object>();

export function usePersistence(): void {
  useEffect(() => {
    for (const store of [useNotesStore, useStudioStore, useSettingsStore]) {
      if (rehydrationStarted.has(store)) continue;
      rehydrationStarted.add(store);
      void store.persist.rehydrate();
    }

    const flush = () => {
      void notesStorage.flush();
      void studioStorage.flush();
      void settingsStorage.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);
}

/**
 * Registra el service worker (modo sin conexión) solo en producción. En
 * desarrollo lo desregistra, para que una versión vieja en caché no tape los cambios.
 */
export function useServiceWorker(): void {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister())));
      return;
    }
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch((error: unknown) => {
      console.error("[CrisWorkspace] No se pudo activar el modo sin conexión", error);
    });
  }, []);
}

/**
 * Motor del Reloj Maestro. Mientras el directo está en marcha, recibe un tic
 * en cada cambio de segundo (desde un Web Worker) y además se resincroniza al
 * volver a la pestaña o recuperar el foco. Cada tic recalcula el tiempo con
 * `Date.now()` y dispara los vídeos cuyo minuto ya llegó.
 */
export function useBroadcastEngine(): void {
  const isRunning = useStudioStore((s) => s.broadcast.isRunning);
  const startTimestamp = useStudioStore((s) => s.broadcast.startTimeTimestamp);
  const hydrated = useStudioStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated || !isRunning || startTimestamp === null) return;
    const tick = () => useStudioStore.getState().tick();
    tick();
    const ticker = startTicker(startTimestamp, tick);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      ticker.stop();
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrated, isRunning, startTimestamp]);
}
