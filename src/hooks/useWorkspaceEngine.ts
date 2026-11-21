"use client";

import { useEffect, useSyncExternalStore } from "react";
import { hasPendingDated } from "@/lib/broadcast/clock";
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
  // La agenda (vídeos con fecha) también necesita el motor, aunque no haya directo.
  const hasDated = useStudioStore((s) => hasPendingDated(s.broadcast.queue));
  const live = isRunning && startTimestamp !== null;

  useEffect(() => {
    if (!hydrated || (!live && !hasDated)) return;
    const tick = () => useStudioStore.getState().tick();
    tick();
    // Con directo, los tics se alinean con su inicio; sin él, con los segundos del reloj.
    const ticker = startTicker(live && startTimestamp !== null ? startTimestamp : 0, tick);
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
  }, [hydrated, live, hasDated, startTimestamp]);
}

/*
 * Reloj compartido para las cuentas atrás en pantalla. La hora solo se lee en
 * el navegador (nunca al generar la página en el servidor, donde vale 0).
 */
let currentNow = 0;
const nowListeners = new Set<() => void>();
let nowTimer: number | null = null;

function subscribeNow(listener: () => void): () => void {
  nowListeners.add(listener);
  if (nowTimer === null) {
    nowTimer = window.setInterval(() => {
      currentNow = Date.now();
      for (const l of nowListeners) l();
    }, 1000);
  }
  return () => {
    nowListeners.delete(listener);
    if (nowListeners.size === 0 && nowTimer !== null) {
      window.clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

const noSubscribe = () => () => {};

function getNowSnapshot(): number {
  if (currentNow === 0) currentNow = Date.now();
  return currentNow;
}

/** Hora actual que se actualiza cada segundo (solo mientras `active`). */
export function useNow(active: boolean): number {
  return useSyncExternalStore(active ? subscribeNow : noSubscribe, getNowSnapshot, () => 0);
}
