import type { DraftValidationInput, SocialPlatform, ValidationIssue } from "@/types/workspace";

export const MAX_TRIGGER_MINUTE = 600;

/** Extrae las @menciones de un texto: sin arroba, en minúsculas y sin duplicados. */
export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  // La mención debe empezar el texto o ir tras un carácter que no sea de palabra (evita correos).
  const regex = /(^|[^\w@.])@([A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?)/g;
  for (const match of text.matchAll(regex)) {
    const handle = match[2];
    if (handle) found.add(handle.toLowerCase());
  }
  return [...found];
}

/** Longitud tal como la cuentan las redes (por puntos de código, no por unidades UTF-16). */
export function captionLength(text: string): number {
  return [...text].length;
}

export type DraftToValidate = DraftValidationInput;

export interface ValidationContext {
  platforms: readonly SocialPlatform[];
  /** Segundos de directo transcurridos si está en marcha, o `null`. */
  liveElapsedSeconds: number | null;
  /** Hora actual, para comprobar las fechas. */
  now: number;
}

/** Margen para aceptar «ahora» aunque pasen unos segundos entre elegir y programar. */
const PAST_TOLERANCE_MS = 2 * 60_000;
/** Como mucho se programa con un año de antelación. */
const MAX_AHEAD_MS = 366 * 24 * 60 * 60_000;
export const MAX_COVER_BYTES = 10 * 1024 * 1024;

export function validateDraft(draft: DraftToValidate, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const length = captionLength(draft.description);
  const mentions = extractMentions(draft.description);

  if (draft.scheduleMode === "directo") {
    if (!Number.isInteger(draft.triggerMinute) || draft.triggerMinute < 0 || draft.triggerMinute > MAX_TRIGGER_MINUTE) {
      issues.push({
        severity: "error",
        platform: null,
        message: `El minuto de publicación debe ser un número entero entre 0 y ${MAX_TRIGGER_MINUTE}.`,
      });
    } else if (ctx.liveElapsedSeconds !== null && draft.triggerMinute * 60 <= ctx.liveElapsedSeconds) {
      issues.push({
        severity: "warning",
        platform: null,
        message: `El directo ya pasó del minuto ${draft.triggerMinute}: el vídeo se publicará en cuanto lo programes.`,
      });
    } else if (ctx.liveElapsedSeconds === null) {
      issues.push({
        severity: "warning",
        platform: null,
        message: "Se publicará cuando inicies el directo y el reloj llegue a ese minuto.",
      });
    }
  } else if (draft.publishAt === null || !Number.isFinite(draft.publishAt)) {
    issues.push({ severity: "error", platform: null, message: "Elige la fecha y la hora de publicación." });
  } else if (draft.publishAt < ctx.now - PAST_TOLERANCE_MS) {
    issues.push({ severity: "error", platform: null, message: "Esa fecha ya ha pasado. Elige una hora futura o «Ahora»." });
  } else if (draft.publishAt > ctx.now + MAX_AHEAD_MS) {
    issues.push({ severity: "error", platform: null, message: "Solo se puede programar con hasta un año de antelación." });
  }

  if (draft.cover !== null) {
    if (!draft.cover.mimeType.startsWith("image/")) {
      issues.push({ severity: "error", platform: null, message: "La portada tiene que ser una imagen (JPG, PNG o WebP)." });
    } else if (draft.cover.sizeBytes > MAX_COVER_BYTES) {
      issues.push({ severity: "error", platform: null, message: "La portada pesa más de 10 MB. Usa una imagen más ligera." });
    } else if (draft.platforms.includes("youtube") && draft.cover.sizeBytes > 2 * 1024 * 1024) {
      issues.push({ severity: "warning", platform: "youtube", message: "YouTube: las miniaturas deben pesar menos de 2 MB; esta podría rechazarse." });
    }
  }

  if (draft.platforms.length === 0) {
    issues.push({ severity: "error", platform: null, message: "Elige al menos una red social." });
  }

  if (draft.description.trim().length === 0) {
    issues.push({ severity: "warning", platform: null, message: "El vídeo no lleva descripción." });
  }

  if (draft.durationSeconds === null) {
    issues.push({ severity: "warning", platform: null, message: "No se pudo leer la duración del vídeo; no se comprobarán los límites de duración." });
  }

  for (const id of draft.platforms) {
    const platform = ctx.platforms.find((p) => p.id === id);
    if (!platform) continue;
    const { limits, displayName } = platform;
    if (length > limits.maxCaptionChars) {
      issues.push({
        severity: "error",
        platform: id,
        message: `${displayName}: la descripción tiene ${length} caracteres y el máximo es ${limits.maxCaptionChars}.`,
      });
    }
    if (mentions.length > limits.maxMentions) {
      issues.push({
        severity: "error",
        platform: id,
        message: `${displayName}: admite como mucho ${limits.maxMentions} menciones (hay ${mentions.length}).`,
      });
    }
    if (draft.durationSeconds !== null && draft.durationSeconds > limits.maxVideoSeconds) {
      issues.push({
        severity: "error",
        platform: id,
        message: `${displayName}: el vídeo dura ${Math.round(draft.durationSeconds)} s y el máximo es ${limits.maxVideoSeconds} s.`,
      });
    }
    if (id === "youtube") {
      const firstLine = draft.description.split("\n")[0]?.trim() ?? "";
      if (captionLength(firstLine) > 100) {
        issues.push({
          severity: "warning",
          platform: id,
          message: "YouTube: la primera línea se usa como título y se recortará a 100 caracteres.",
        });
      }
    }
    if (!platform.connected) {
      issues.push({
        severity: "warning",
        platform: id,
        message: `${displayName} no está conectada: conéctala antes de la hora de publicación o en esa red fallará.`,
      });
    }
  }

  return issues;
}

export const hasBlockingIssues = (issues: readonly ValidationIssue[]): boolean =>
  issues.some((issue) => issue.severity === "error");
