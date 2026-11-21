import type { Id } from "@/types/workspace";

/**
 * Registro de URLs `blob:` de los vídeos en cola. Cada vídeo tiene como mucho
 * una URL viva; al reemplazarla o al borrar el vídeo se revoca para no dejar
 * el archivo retenido en memoria.
 */
const previewUrls = new Map<Id, string>();

export function createPreviewUrl(videoId: Id, blob: Blob): string {
  revokePreviewUrl(videoId);
  const url = URL.createObjectURL(blob);
  previewUrls.set(videoId, url);
  return url;
}

export function revokePreviewUrl(videoId: Id): void {
  const url = previewUrls.get(videoId);
  if (url) {
    URL.revokeObjectURL(url);
    previewUrls.delete(videoId);
  }
}

export function revokeAllPreviewUrls(): void {
  for (const url of previewUrls.values()) URL.revokeObjectURL(url);
  previewUrls.clear();
}

/** Lee la duración de un vídeo desde sus metadatos (sin descargarlo entero). */
export function readVideoDuration(file: Blob, timeoutMs = 8_000): Promise<number | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}
