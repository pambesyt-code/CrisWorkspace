import type { EpochMs, ScheduledVideo } from "@/types/workspace";

/**
 * Cálculos del reloj maestro y de la agenda. Todo se deriva de `Date.now()`:
 * nunca se suman intervalos, así que una pestaña en segundo plano (con
 * temporizadores ralentizados) no se desincroniza.
 */

export function elapsedSecondsAt(startTimestamp: EpochMs, now: EpochMs): number {
  return Math.max(0, Math.floor((now - startTimestamp) / 1000));
}

/** Instante exacto (segundo 00 del minuto) en que toca publicar un vídeo del directo. */
export function dueTimestamp(startTimestamp: EpochMs, triggerMinute: number): EpochMs {
  return startTimestamp + triggerMinute * 60_000;
}

/**
 * Momento en que toca publicar un vídeo, o `null` si aún no se puede saber
 * (vídeo del directo con el directo parado).
 */
export function videoDueAt(video: ScheduledVideo, liveStart: EpochMs | null): EpochMs | null {
  if (video.scheduleMode === "fecha") return video.publishAt;
  return liveStart === null ? null : dueTimestamp(liveStart, video.triggerMinute);
}

/**
 * Vídeos pendientes cuyo momento ya llegó, del más antiguo al más nuevo.
 * - "fecha": cuando `publishAt` ya pasó, haya directo o no.
 * - "directo": solo con el directo en marcha (`liveStart` no nulo).
 * Es idempotente y "recupera": si el temporizador se retrasó (pestaña oculta,
 * app cerrada), los vídeos atrasados se devuelven en el siguiente tic.
 * El bloqueo contra duplicados lo hace el store al reclamar cada vídeo.
 */
export function getDueVideos(queue: readonly ScheduledVideo[], liveStart: EpochMs | null, now: EpochMs): ScheduledVideo[] {
  return queue
    .flatMap((video) => {
      if (video.status !== "pending") return [];
      const at = videoDueAt(video, liveStart);
      return at !== null && at <= now ? [{ video, at }] : [];
    })
    .sort((a, b) => a.at - b.at || a.video.createdAt - b.video.createdAt)
    .map((entry) => entry.video);
}

/** ¿Hay vídeos que esperan una fecha? (el motor debe vigilar aunque no haya directo). */
export function hasPendingDated(queue: readonly ScheduledVideo[]): boolean {
  return queue.some((video) => video.status === "pending" && video.scheduleMode === "fecha");
}

/** Milisegundos hasta el próximo cambio de segundo contado desde `origin`. */
export function msUntilNextSecond(origin: EpochMs, now: EpochMs): number {
  const offset = (now - origin) % 1000;
  return offset < 0 ? -offset : 1000 - offset;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Minuto final del timeline del directo: al menos 60 y siempre 10 minutos por delante del último vídeo o del reloj. */
export function timelineMaxMinute(queue: readonly ScheduledVideo[], elapsedSeconds: number): number {
  const lastTrigger = queue.reduce((max, video) => (video.scheduleMode === "directo" ? Math.max(max, video.triggerMinute) : max), 0);
  const furthest = Math.max(lastTrigger, Math.ceil(elapsedSeconds / 60));
  return Math.max(60, Math.ceil((furthest + 10) / 10) * 10);
}
