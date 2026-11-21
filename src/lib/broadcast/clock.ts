import type { EpochMs, ScheduledVideo } from "@/types/workspace";

/**
 * Cálculos del reloj maestro. Todo se deriva de `Date.now()` frente al
 * instante de inicio: nunca se suman intervalos, así que una pestaña en
 * segundo plano (con temporizadores ralentizados) no se desincroniza.
 */

export function elapsedSecondsAt(startTimestamp: EpochMs, now: EpochMs): number {
  return Math.max(0, Math.floor((now - startTimestamp) / 1000));
}

/** Instante exacto (segundo 00 del minuto) en que toca publicar el vídeo. */
export function dueTimestamp(startTimestamp: EpochMs, triggerMinute: number): EpochMs {
  return startTimestamp + triggerMinute * 60_000;
}

/**
 * Vídeos pendientes cuyo instante ya llegó, ordenados por minuto.
 * Es idempotente y "recupera": si el temporizador se retrasó (pestaña oculta,
 * equipo suspendido), los vídeos atrasados se devuelven en el siguiente tic.
 * El bloqueo contra duplicados lo hace el store al reclamar cada vídeo.
 */
export function getDueVideos(queue: readonly ScheduledVideo[], startTimestamp: EpochMs, now: EpochMs): ScheduledVideo[] {
  return queue
    .filter((video) => video.status === "pending" && dueTimestamp(startTimestamp, video.triggerMinute) <= now)
    .sort((a, b) => a.triggerMinute - b.triggerMinute || a.createdAt - b.createdAt);
}

/** Milisegundos hasta el próximo cambio de segundo del reloj del directo. */
export function msUntilNextSecond(startTimestamp: EpochMs, now: EpochMs): number {
  const offset = (now - startTimestamp) % 1000;
  return offset < 0 ? -offset : 1000 - offset;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Minuto final del timeline: al menos 60 y siempre 10 minutos por delante del último vídeo o del reloj. */
export function timelineMaxMinute(queue: readonly ScheduledVideo[], elapsedSeconds: number): number {
  const lastTrigger = queue.reduce((max, video) => Math.max(max, video.triggerMinute), 0);
  const furthest = Math.max(lastTrigger, Math.ceil(elapsedSeconds / 60));
  return Math.max(60, Math.ceil((furthest + 10) / 10) * 10);
}
