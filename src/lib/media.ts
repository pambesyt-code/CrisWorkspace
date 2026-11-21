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

/** URL de la portada: misma lógica que la vista previa, con su propia clave. */
export const createCoverUrl = (videoId: Id, blob: Blob): string => createPreviewUrl(`portada:${videoId}`, blob);
export const revokeCoverUrl = (videoId: Id): void => revokePreviewUrl(`portada:${videoId}`);

/**
 * Saca el fotograma del segundo `atSeconds` como JPEG (para usarlo de portada).
 * Usa un `<video>` y un `<canvas>` temporales que se liberan al terminar.
 */
export function captureVideoFrame(video: Blob, atSeconds: number, timeoutMs = 10_000): Promise<Blob | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(video);
    const element = document.createElement("video");
    let settled = false;
    const finish = (value: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    element.preload = "auto";
    element.muted = true;
    element.playsInline = true;
    element.onerror = () => finish(null);
    element.onloadeddata = () => {
      const duration = Number.isFinite(element.duration) ? element.duration : atSeconds;
      // Un poco antes del final: el último instante a veces no tiene imagen.
      element.currentTime = Math.min(Math.max(0, atSeconds), Math.max(0, duration - 0.05));
    };
    element.onseeked = () => {
      const width = element.videoWidth;
      const height = element.videoHeight;
      if (!width || !height) {
        finish(null);
        return;
      }
      // Como mucho 1920 px de lado: suficiente para una portada y ligera.
      const scale = Math.min(1, 1920 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        finish(null);
        return;
      }
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.9);
    };
    element.src = url;
  });
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
