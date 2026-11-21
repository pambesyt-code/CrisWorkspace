import type { SocialPlatform, SocialPlatformId, ValidationIssue } from "@/types/workspace";

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

export interface DraftToValidate {
  description: string;
  platforms: SocialPlatformId[];
  durationSeconds: number | null;
  triggerMinute: number;
}

export interface ValidationContext {
  platforms: readonly SocialPlatform[];
  /** Segundos de directo transcurridos si está en marcha, o `null`. */
  liveElapsedSeconds: number | null;
}

export function validateDraft(draft: DraftToValidate, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const length = captionLength(draft.description);
  const mentions = extractMentions(draft.description);

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
        message: `${displayName} no está conectada: conéctala antes del minuto ${draft.triggerMinute} o esa publicación fallará.`,
      });
    }
  }

  return issues;
}

export const hasBlockingIssues = (issues: readonly ValidationIssue[]): boolean =>
  issues.some((issue) => issue.severity === "error");
