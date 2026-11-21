import type { PlatformPublishResult, SocialPlatform, SocialPlatformId } from "@/types/workspace";
import { captionLength, extractMentions } from "@/lib/validation";

/**
 * Servicio de publicación multired.
 *
 * Cada red tiene un `PlatformPublisher`. Ahora mismo todos son SIMULADOS:
 * comprueban las mismas reglas que comprobaría la red (cuenta conectada,
 * longitud, menciones, duración), esperan un tiempo realista y responden,
 * pero no envían nada a internet. Para publicar de verdad hay que crear las
 * apps de desarrollador de cada red (OAuth) y una ruta de servidor que guarde
 * los tokens; después basta con registrar aquí un publisher real con la misma
 * interfaz, sin tocar el resto de la aplicación.
 */

export interface PublishPayload {
  videoId: string;
  video: Blob;
  fileName: string;
  description: string;
  mentions: string[];
  durationSeconds: number | null;
}

export interface PublishReceipt {
  postUrl: string | null;
}

export interface PlatformPublisher {
  readonly platform: SocialPlatformId;
  readonly simulated: boolean;
  publish: (payload: PublishPayload, account: SocialPlatform, signal: AbortSignal) => Promise<PublishReceipt>;
}

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new PublishError("Publicación cancelada."));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new PublishError("Publicación cancelada."));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function createSimulatedPublisher(platform: SocialPlatformId, minDelayMs: number, maxDelayMs: number): PlatformPublisher {
  return {
    platform,
    simulated: true,
    async publish(payload, account, signal) {
      if (!account.connected || !account.handle) {
        throw new PublishError("La cuenta no está conectada.");
      }
      const { limits } = account;
      const length = captionLength(payload.description);
      if (length > limits.maxCaptionChars) {
        throw new PublishError(`Descripción demasiado larga (${length}/${limits.maxCaptionChars}).`);
      }
      if (payload.mentions.length > limits.maxMentions) {
        throw new PublishError(`Demasiadas menciones (${payload.mentions.length}/${limits.maxMentions}).`);
      }
      if (payload.durationSeconds !== null && payload.durationSeconds > limits.maxVideoSeconds) {
        throw new PublishError(`Vídeo demasiado largo (${Math.round(payload.durationSeconds)} s / ${limits.maxVideoSeconds} s).`);
      }
      if (payload.video.size === 0) {
        throw new PublishError("El archivo de vídeo está vacío.");
      }
      // Tiempo de subida simulado, proporcional al tamaño y acotado.
      const sizeFactor = Math.min(1, payload.video.size / (200 * 1024 * 1024));
      await wait(minDelayMs + (maxDelayMs - minDelayMs) * sizeFactor, signal);
      return { postUrl: null };
    },
  };
}

const PUBLISHERS: Record<SocialPlatformId, PlatformPublisher> = {
  instagram: createSimulatedPublisher("instagram", 1_400, 4_000),
  facebook: createSimulatedPublisher("facebook", 1_200, 3_600),
  twitter: createSimulatedPublisher("twitter", 900, 2_800),
  tiktok: createSimulatedPublisher("tiktok", 1_600, 4_200),
  youtube: createSimulatedPublisher("youtube", 2_000, 5_000),
};

export const isSimulatedPublishing = (): boolean => Object.values(PUBLISHERS).some((p) => p.simulated);

const PUBLISH_TIMEOUT_MS = 120_000;

/**
 * Publica el mismo vídeo en varias redes A LA VEZ.
 * `Promise.allSettled` garantiza que el fallo (o el cuelgue, con tiempo límite)
 * de una red no afecta a las demás: siempre se devuelve un resultado por red.
 */
export async function publishToPlatforms(
  payload: PublishPayload,
  targets: readonly SocialPlatformId[],
  accounts: readonly SocialPlatform[],
  now: () => number = Date.now,
): Promise<PlatformPublishResult[]> {
  // Hora de fin de cada red, anotada en el momento en que esa red termina (no al final de todas).
  const finishedAt = new Map<SocialPlatformId, number>();
  const settled = await Promise.allSettled(
    targets.map(async (platformId) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);
      try {
        const account = accounts.find((a) => a.id === platformId);
        if (!account) throw new PublishError("Red desconocida.");
        return await PUBLISHERS[platformId].publish(payload, account, controller.signal);
      } finally {
        clearTimeout(timeout);
        finishedAt.set(platformId, now());
      }
    }),
  );

  return settled.map((outcome, index): PlatformPublishResult => {
    const platform = targets[index] as SocialPlatformId;
    const at = finishedAt.get(platform) ?? now();
    if (outcome.status === "fulfilled") {
      return { platform, ok: true, postUrl: outcome.value.postUrl, error: null, finishedAt: at };
    }
    const reason: unknown = outcome.reason;
    const message = reason instanceof Error ? reason.message : "Error desconocido al publicar.";
    return { platform, ok: false, postUrl: null, error: message, finishedAt: at };
  });
}

export function buildPayload(input: {
  videoId: string;
  video: Blob;
  fileName: string;
  description: string;
  durationSeconds: number | null;
}): PublishPayload {
  return { ...input, mentions: extractMentions(input.description) };
}
