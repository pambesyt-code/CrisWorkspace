import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  BroadcastState,
  CoverSource,
  EpochMs,
  Id,
  NewScheduledVideoInput,
  PlatformPublishResult,
  ScheduleMode,
  ScheduledVideo,
  ScheduledVideoStatus,
  SocialPlatform,
  SocialPlatformId,
  ValidationIssue,
} from "@/types/workspace";
import { coverBlobKey, deleteBlobs, getBlob, putBlob, videoBlobKey } from "@/lib/blobStore";
import { elapsedSecondsAt, getDueVideos } from "@/lib/broadcast/clock";
import { createDebouncedIdbStorage } from "@/lib/idbStorage";
import { createId } from "@/lib/ids";
import { createCoverUrl, createPreviewUrl, readVideoDuration, revokeCoverUrl, revokePreviewUrl } from "@/lib/media";
import { DEFAULT_PLATFORMS, isPlatformId, mergePlatforms, normalizeHandle } from "@/lib/platforms";
import { buildPayload, publishToPlatforms } from "@/lib/publishing/publishers";
import { extractMentions, hasBlockingIssues, MAX_TRIGGER_MINUTE, validateDraft, type DraftToValidate } from "@/lib/validation";

export const studioStorage = createDebouncedIdbStorage(150);

interface PersistedStudio {
  platforms: SocialPlatform[];
  broadcast: Omit<BroadcastState, "elapsedSeconds">;
  mentionHistory: string[];
}

export interface StudioState {
  platforms: SocialPlatform[];
  broadcast: BroadcastState;
  /** Menciones usadas antes (sin arroba), la más reciente primero. */
  mentionHistory: string[];
  hydrated: boolean;

  connectPlatform: (platformId: SocialPlatformId, handle: string) => void;
  disconnectPlatform: (platformId: SocialPlatformId) => void;

  validateDraft: (draft: DraftToValidate) => ValidationIssue[];
  scheduleVideo: (input: NewScheduledVideoInput) => Promise<ValidationIssue[]>;
  removeVideo: (videoId: Id) => void;
  retryVideo: (videoId: Id) => void;
  updateTriggerMinute: (videoId: Id, minute: number) => void;
  updateSchedule: (videoId: Id, schedule: { scheduleMode: ScheduleMode; triggerMinute: number; publishAt: EpochMs | null }) => void;
  togglePlatform: (videoId: Id, platformId: SocialPlatformId, enabled: boolean) => void;
  updateCover: (videoId: Id, cover: Blob | null, source: CoverSource | null) => Promise<void>;
  publishNow: (videoId: Id) => void;

  startBroadcast: () => void;
  stopBroadcast: () => void;
  resetBroadcast: () => void;
  /** Recalcula el reloj con `Date.now()` y dispara los vídeos que ya tocan. Lo llama el motor en cada tic. */
  tick: (now?: EpochMs) => void;
  /** Reclama y publica un vídeo. Devuelve `false` si otro proceso ya lo había reclamado. */
  publishVideo: (videoId: Id) => Promise<boolean>;
}

const MAX_MENTION_HISTORY = 200;

/** Vídeos con una publicación en curso (segunda barrera contra duplicados, además del estado). */
const inFlight = new Set<Id>();

function replaceVideo(queue: readonly ScheduledVideo[], videoId: Id, update: (v: ScheduledVideo) => ScheduledVideo): ScheduledVideo[] {
  return queue.map((v) => (v.id === videoId ? update(v) : v));
}

/** Estado final tras un intento: publicado solo si TODAS las redes destino están bien. */
export function settleStatus(video: ScheduledVideo, results: Partial<Record<SocialPlatformId, PlatformPublishResult>>): {
  status: ScheduledVideoStatus;
  error: string | null;
} {
  const okPlatforms = video.platforms.filter((p) => results[p]?.ok === true);
  if (okPlatforms.length === video.platforms.length) return { status: "published", error: null };
  const failed = video.platforms.filter((p) => results[p]?.ok !== true);
  const message =
    okPlatforms.length === 0
      ? "No se pudo publicar en ninguna red."
      : `Publicado en ${okPlatforms.length} de ${video.platforms.length} redes; falló en ${failed.length}.`;
  return { status: "error", error: message };
}

function sanitizeQueue(raw: unknown): ScheduledVideo[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value): ScheduledVideo[] => {
    if (typeof value !== "object" || value === null) return [];
    const v = value as Record<string, unknown>;
    if (typeof v.id !== "string" || typeof v.videoBlobKey !== "string") return [];
    const platforms = Array.isArray(v.platforms) ? v.platforms.filter(isPlatformId) : [];
    const results: Partial<Record<SocialPlatformId, PlatformPublishResult>> = {};
    if (typeof v.results === "object" && v.results !== null) {
      for (const [key, r] of Object.entries(v.results as Record<string, unknown>)) {
        if (!isPlatformId(key) || typeof r !== "object" || r === null) continue;
        const res = r as Record<string, unknown>;
        results[key] = {
          platform: key,
          ok: res.ok === true,
          postUrl: typeof res.postUrl === "string" ? res.postUrl : null,
          error: typeof res.error === "string" ? res.error : null,
          finishedAt: typeof res.finishedAt === "number" ? res.finishedAt : 0,
        };
      }
    }
    const statuses: readonly ScheduledVideoStatus[] = ["pending", "uploading", "published", "error"];
    let status = statuses.find((s) => s === v.status) ?? "pending";
    let error = typeof v.error === "string" ? v.error : null;
    // Una subida que estaba en marcha al cerrar la página no terminó: se marca
    // como error para que el usuario decida reintentar (evita duplicados).
    if (status === "uploading") {
      status = "error";
      error = "La página se cerró durante la subida. Pulsa «Reintentar».";
    }
    const trigger = typeof v.triggerMinute === "number" && Number.isInteger(v.triggerMinute) ? v.triggerMinute : 0;
    // Los vídeos guardados antes de la versión 1.2 no tenían modo: eran todos del directo.
    const publishAt = typeof v.publishAt === "number" && Number.isFinite(v.publishAt) ? v.publishAt : null;
    const scheduleMode: ScheduleMode = v.scheduleMode === "fecha" && publishAt !== null ? "fecha" : "directo";
    const coverSources: readonly CoverSource[] = ["imagen", "fotograma"];
    const coverBlobKey = typeof v.coverBlobKey === "string" ? v.coverBlobKey : null;
    return [
      {
        id: v.id,
        videoBlobKey: v.videoBlobKey,
        fileName: typeof v.fileName === "string" ? v.fileName : "video",
        mimeType: typeof v.mimeType === "string" ? v.mimeType : "video/mp4",
        sizeBytes: typeof v.sizeBytes === "number" ? v.sizeBytes : 0,
        durationSeconds: typeof v.durationSeconds === "number" ? v.durationSeconds : null,
        previewUrl: null,
        description: typeof v.description === "string" ? v.description : "",
        mentions: Array.isArray(v.mentions) ? v.mentions.filter((m): m is string => typeof m === "string") : [],
        platforms,
        scheduleMode,
        triggerMinute: Math.min(MAX_TRIGGER_MINUTE, Math.max(0, trigger)),
        publishAt: scheduleMode === "fecha" ? publishAt : null,
        coverBlobKey,
        coverSource: coverBlobKey ? (coverSources.find((s) => s === v.coverSource) ?? "imagen") : null,
        coverUrl: null,
        status,
        results,
        error,
        createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
        publishedAt: typeof v.publishedAt === "number" ? v.publishedAt : null,
      },
    ];
  });
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      platforms: DEFAULT_PLATFORMS.map((p) => ({ ...p })),
      broadcast: { isRunning: false, elapsedSeconds: 0, startTimeTimestamp: null, queue: [] },
      mentionHistory: [],
      hydrated: false,

      connectPlatform: (platformId, handle) => {
        const clean = normalizeHandle(handle);
        if (!clean) return;
        set((state) => ({
          platforms: state.platforms.map((p) => (p.id === platformId ? { ...p, connected: true, handle: clean } : p)),
        }));
      },

      disconnectPlatform: (platformId) =>
        set((state) => ({
          platforms: state.platforms.map((p) => (p.id === platformId ? { ...p, connected: false, handle: null } : p)),
        })),

      validateDraft: (draft) => {
        const { platforms, broadcast } = get();
        return validateDraft(draft, {
          platforms,
          liveElapsedSeconds: broadcast.isRunning ? broadcast.elapsedSeconds : null,
          now: Date.now(),
        });
      },

      scheduleVideo: async (input) => {
        if (!input.file.type.startsWith("video/")) {
          return [{ severity: "error", platform: null, message: "El archivo no es un vídeo." }];
        }
        const platforms = [...new Set(input.platforms)];
        const durationSeconds = await readVideoDuration(input.file);
        const issues = get().validateDraft({
          description: input.description,
          platforms,
          durationSeconds,
          scheduleMode: input.scheduleMode,
          triggerMinute: input.triggerMinute,
          publishAt: input.publishAt,
          cover: input.cover ? { mimeType: input.cover.type, sizeBytes: input.cover.size } : null,
        });
        if (hasBlockingIssues(issues)) return issues.filter((i) => i.severity === "error");

        const id = createId();
        const blobKey = videoBlobKey(id);
        const coverKey = input.cover ? coverBlobKey(id) : null;
        try {
          await putBlob(blobKey, input.file);
          if (input.cover && coverKey) await putBlob(coverKey, input.cover);
        } catch (error) {
          console.error("[CrisWorkspace] No se pudo guardar el vídeo", error);
          void deleteBlobs(coverKey ? [blobKey, coverKey] : [blobKey]);
          return [{ severity: "error", platform: null, message: "No se pudo guardar el vídeo en el navegador (¿falta espacio?)." }];
        }

        const mentions = extractMentions(input.description);
        const video: ScheduledVideo = {
          id,
          videoBlobKey: blobKey,
          fileName: input.file.name || "video",
          mimeType: input.file.type,
          sizeBytes: input.file.size,
          durationSeconds,
          previewUrl: createPreviewUrl(id, input.file),
          description: input.description,
          mentions,
          platforms,
          scheduleMode: input.scheduleMode,
          triggerMinute: input.scheduleMode === "directo" ? input.triggerMinute : 0,
          publishAt: input.scheduleMode === "fecha" ? input.publishAt : null,
          coverBlobKey: coverKey,
          coverSource: input.cover ? (input.coverSource ?? "imagen") : null,
          coverUrl: input.cover ? createCoverUrl(id, input.cover) : null,
          status: "pending",
          results: {},
          error: null,
          createdAt: Date.now(),
          publishedAt: null,
        };
        set((state) => ({
          broadcast: { ...state.broadcast, queue: [...state.broadcast.queue, video] },
          mentionHistory: [...new Set([...mentions, ...state.mentionHistory])].slice(0, MAX_MENTION_HISTORY),
        }));
        // «Ahora», una fecha ya alcanzada o un minuto del directo ya pasado: se publica en este mismo instante.
        get().tick();
        return [];
      },

      removeVideo: (videoId) => {
        const video = get().broadcast.queue.find((v) => v.id === videoId);
        if (!video || video.status === "uploading" || inFlight.has(videoId)) return;
        set((state) => ({ broadcast: { ...state.broadcast, queue: state.broadcast.queue.filter((v) => v.id !== videoId) } }));
        revokePreviewUrl(videoId);
        revokeCoverUrl(videoId);
        void deleteBlobs(video.coverBlobKey ? [video.videoBlobKey, video.coverBlobKey] : [video.videoBlobKey]);
      },

      updateSchedule: (videoId, schedule) => {
        const isDated = schedule.scheduleMode === "fecha";
        if (isDated && (schedule.publishAt === null || !Number.isFinite(schedule.publishAt))) return;
        const minute = Math.min(MAX_TRIGGER_MINUTE, Math.max(0, Math.round(Number.isFinite(schedule.triggerMinute) ? schedule.triggerMinute : 0)));
        set((state) => {
          const video = state.broadcast.queue.find((v) => v.id === videoId);
          if (!video || video.status !== "pending") return state;
          return {
            broadcast: {
              ...state.broadcast,
              queue: replaceVideo(state.broadcast.queue, videoId, (v) => ({
                ...v,
                scheduleMode: schedule.scheduleMode,
                triggerMinute: isDated ? v.triggerMinute : minute,
                publishAt: isDated ? schedule.publishAt : null,
              })),
            },
          };
        });
        get().tick();
      },

      togglePlatform: (videoId, platformId, enabled) =>
        set((state) => {
          const video = state.broadcast.queue.find((v) => v.id === videoId);
          if (!video || video.status !== "pending") return state;
          const has = video.platforms.includes(platformId);
          if (enabled === has) return state;
          // Siempre queda al menos una red: un vídeo sin redes no tiene dónde publicarse.
          if (!enabled && video.platforms.length <= 1) return state;
          const platforms = enabled ? [...video.platforms, platformId] : video.platforms.filter((p) => p !== platformId);
          return { broadcast: { ...state.broadcast, queue: replaceVideo(state.broadcast.queue, videoId, (v) => ({ ...v, platforms })) } };
        }),

      updateCover: async (videoId, cover, source) => {
        const video = get().broadcast.queue.find((v) => v.id === videoId);
        if (!video || video.status !== "pending") return;
        if (cover !== null && !cover.type.startsWith("image/")) return;
        const oldKey = video.coverBlobKey;
        let newKey: string | null = null;
        if (cover) {
          // Clave nueva: si algo falla a medias, la portada anterior sigue intacta.
          newKey = coverBlobKey(`${videoId}:${createId()}`);
          try {
            await putBlob(newKey, cover);
          } catch (error) {
            console.error("[CrisWorkspace] No se pudo guardar la portada", error);
            return;
          }
        }
        let applied = false;
        set((state) => {
          const current = state.broadcast.queue.find((v) => v.id === videoId);
          if (!current || current.status !== "pending") return state;
          applied = true;
          return {
            broadcast: {
              ...state.broadcast,
              queue: replaceVideo(state.broadcast.queue, videoId, (v) => ({
                ...v,
                coverBlobKey: newKey,
                coverSource: cover ? (source ?? "imagen") : null,
                coverUrl: cover ? createCoverUrl(videoId, cover) : null,
              })),
            },
          };
        });
        if (!applied) {
          if (newKey) void deleteBlobs([newKey]);
          return;
        }
        if (!cover) revokeCoverUrl(videoId);
        if (oldKey) void deleteBlobs([oldKey]);
      },

      publishNow: (videoId) => {
        const video = get().broadcast.queue.find((v) => v.id === videoId);
        if (!video || video.status !== "pending") return;
        get().updateSchedule(videoId, { scheduleMode: "fecha", triggerMinute: video.triggerMinute, publishAt: Date.now() });
      },

      retryVideo: (videoId) => {
        set((state) => {
          const video = state.broadcast.queue.find((v) => v.id === videoId);
          const hasFailures = video ? video.platforms.some((p) => video.results[p]?.ok !== true) : false;
          if (!video || video.status === "uploading" || video.status === "pending" || !hasFailures) return state;
          return {
            broadcast: {
              ...state.broadcast,
              queue: replaceVideo(state.broadcast.queue, videoId, (v) => ({ ...v, status: "pending", error: null })),
            },
          };
        });
        get().tick();
      },

      updateTriggerMinute: (videoId, minute) => {
        if (!Number.isFinite(minute)) return;
        const clamped = Math.min(MAX_TRIGGER_MINUTE, Math.max(0, Math.round(minute)));
        set((state) => {
          const video = state.broadcast.queue.find((v) => v.id === videoId);
          if (!video || video.status !== "pending" || video.triggerMinute === clamped) return state;
          return {
            broadcast: {
              ...state.broadcast,
              queue: replaceVideo(state.broadcast.queue, videoId, (v) => ({ ...v, triggerMinute: clamped })),
            },
          };
        });
        get().tick();
      },

      startBroadcast: () => {
        set((state) => ({
          broadcast: { ...state.broadcast, isRunning: true, startTimeTimestamp: Date.now(), elapsedSeconds: 0 },
        }));
        get().tick();
      },

      stopBroadcast: () =>
        set((state) => {
          const { startTimeTimestamp } = state.broadcast;
          const elapsed = startTimeTimestamp !== null ? elapsedSecondsAt(startTimeTimestamp, Date.now()) : state.broadcast.elapsedSeconds;
          return { broadcast: { ...state.broadcast, isRunning: false, elapsedSeconds: elapsed } };
        }),

      resetBroadcast: () =>
        set((state) => ({ broadcast: { ...state.broadcast, isRunning: false, startTimeTimestamp: null, elapsedSeconds: 0 } })),

      tick: (now = Date.now()) => {
        const { broadcast } = get();
        const live = broadcast.isRunning && broadcast.startTimeTimestamp !== null ? broadcast.startTimeTimestamp : null;
        if (live !== null) {
          const elapsed = elapsedSecondsAt(live, now);
          if (elapsed !== broadcast.elapsedSeconds) {
            set((state) => ({ broadcast: { ...state.broadcast, elapsedSeconds: elapsed } }));
          }
        }
        // Los vídeos con fecha salen aunque no haya directo; los del directo, solo con el reloj en marcha.
        for (const video of getDueVideos(broadcast.queue, live, now)) {
          void get().publishVideo(video.id);
        }
      },

      publishVideo: async (videoId) => {
        if (inFlight.has(videoId)) return false;
        // Bloqueo atómico: la comprobación y el cambio a "uploading" ocurren en el
        // mismo `set` síncrono, así que dos tics nunca reclaman el mismo vídeo.
        let claimed: ScheduledVideo | null = null;
        set((state) => {
          const video = state.broadcast.queue.find((v) => v.id === videoId);
          if (!video || video.status !== "pending") return state;
          const next: ScheduledVideo = { ...video, status: "uploading", error: null };
          claimed = next;
          return { broadcast: { ...state.broadcast, queue: replaceVideo(state.broadcast.queue, videoId, () => next) } };
        });
        const video = claimed as ScheduledVideo | null;
        if (!video) return false;
        inFlight.add(videoId);

        try {
          // Solo se envía a las redes que aún no tienen una publicación correcta.
          const targets = video.platforms.filter((p) => video.results[p]?.ok !== true);
          const blob = await getBlob(video.videoBlobKey);
          // Si la portada se perdió, se publica igual con el fotograma automático.
          const cover = video.coverBlobKey ? await getBlob(video.coverBlobKey) : null;
          let newResults: PlatformPublishResult[];
          if (!blob) {
            const now = Date.now();
            newResults = targets.map((platform) => ({ platform, ok: false, postUrl: null, error: "El archivo de vídeo ya no está guardado.", finishedAt: now }));
          } else {
            const payload = buildPayload({
              videoId,
              video: blob,
              fileName: video.fileName,
              description: video.description,
              durationSeconds: video.durationSeconds,
              cover,
            });
            newResults = await publishToPlatforms(payload, targets, get().platforms);
          }

          set((state) => ({
            broadcast: {
              ...state.broadcast,
              queue: replaceVideo(state.broadcast.queue, videoId, (current) => {
                const results = { ...current.results };
                for (const r of newResults) results[r.platform] = r;
                const { status, error } = settleStatus(current, results);
                const anyOk = newResults.some((r) => r.ok);
                return { ...current, results, status, error, publishedAt: anyOk ? current.publishedAt ?? Date.now() : current.publishedAt };
              }),
            },
          }));
        } catch (error) {
          console.error("[CrisWorkspace] Error inesperado al publicar", error);
          set((state) => ({
            broadcast: {
              ...state.broadcast,
              queue: replaceVideo(state.broadcast.queue, videoId, (current) => ({
                ...current,
                status: "error",
                error: "Error inesperado al publicar. Pulsa «Reintentar».",
              })),
            },
          }));
        } finally {
          inFlight.delete(videoId);
        }
        return true;
      },
    }),
    {
      name: "crisworkspace:studio",
      version: 1,
      storage: createJSONStorage<PersistedStudio>(() => studioStorage),
      skipHydration: true,
      partialize: (state): PersistedStudio => ({
        platforms: state.platforms,
        mentionHistory: state.mentionHistory,
        broadcast: {
          isRunning: state.broadcast.isRunning,
          startTimeTimestamp: state.broadcast.startTimeTimestamp,
          // La URL de vista previa solo existe en memoria.
          queue: state.broadcast.queue.map((v) => ({ ...v, previewUrl: null, coverUrl: null })),
        },
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Record<keyof PersistedStudio, unknown>>;
        const b = (typeof p.broadcast === "object" && p.broadcast !== null ? p.broadcast : {}) as Record<string, unknown>;
        const start = typeof b.startTimeTimestamp === "number" ? b.startTimeTimestamp : null;
        const isRunning = b.isRunning === true && start !== null;
        return {
          ...current,
          platforms: mergePlatforms(p.platforms),
          mentionHistory: Array.isArray(p.mentionHistory)
            ? p.mentionHistory.filter((m): m is string => typeof m === "string").slice(0, MAX_MENTION_HISTORY)
            : [],
          broadcast: {
            isRunning,
            startTimeTimestamp: start,
            elapsedSeconds: start !== null && isRunning ? elapsedSecondsAt(start, Date.now()) : 0,
            queue: sanitizeQueue(b.queue),
          },
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error("[CrisWorkspace] No se pudo cargar el estudio", error);
        useStudioStore.setState({ hydrated: true });
        if (state) void restorePreviews(state.broadcast.queue);
      },
    },
  ),
);

/** Vuelve a crear las URLs de vista previa de los vídeos guardados y limpia blobs huérfanos de la cola. */
async function restorePreviews(queue: readonly ScheduledVideo[]): Promise<void> {
  const missing: Id[] = [];
  const urls = new Map<Id, string>();
  const coverUrls = new Map<Id, string>();
  await Promise.all(
    queue.map(async (video) => {
      try {
        const blob = await getBlob(video.videoBlobKey);
        if (blob) urls.set(video.id, createPreviewUrl(video.id, blob));
        else missing.push(video.id);
        const cover = video.coverBlobKey ? await getBlob(video.coverBlobKey) : null;
        if (cover) coverUrls.set(video.id, createCoverUrl(video.id, cover));
      } catch {
        missing.push(video.id);
      }
    }),
  );
  useStudioStore.setState((state) => ({
    broadcast: {
      ...state.broadcast,
      queue: state.broadcast.queue.map((v) => {
        const url = urls.get(v.id);
        const coverUrl = coverUrls.get(v.id) ?? null;
        if (url) return { ...v, previewUrl: url, coverUrl };
        if (missing.includes(v.id) && v.status === "pending") {
          return { ...v, status: "error", error: "El archivo de vídeo ya no está guardado en este navegador." };
        }
        return v;
      }),
    },
  }));
}
