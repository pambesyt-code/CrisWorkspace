import { clear, createStore, del, get, set, type UseStore } from "idb-keyval";

/**
 * Almacén de archivos binarios (adjuntos y vídeos) en IndexedDB.
 *
 * Los `Blob` se guardan tal cual (IndexedDB usa structured clone), sin pasar
 * por JSON, así que no hay límite práctico como en `localStorage`.
 */

let blobDb: UseStore | null = null;

function db(): UseStore {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB no está disponible en este entorno.");
  }
  blobDb ??= createStore("crisworkspace-blobs", "blobs");
  return blobDb;
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  await set(key, blob, db());
}

export async function getBlob(key: string): Promise<Blob | null> {
  const value: unknown = await get(key, db());
  return value instanceof Blob ? value : null;
}

export async function deleteBlob(key: string): Promise<void> {
  await del(key, db());
}

/** Borra varios blobs sin interrumpir si alguno falla. */
export async function deleteBlobs(keys: readonly string[]): Promise<void> {
  await Promise.allSettled(keys.map((key) => deleteBlob(key)));
}

/** Borra todos los archivos guardados (adjuntos y vídeos). */
export async function clearAllBlobs(): Promise<void> {
  await clear(db());
}

export const attachmentBlobKey = (attachmentId: string): string => `attachment:${attachmentId}`;
export const videoBlobKey = (videoId: string): string => `video:${videoId}`;
export const coverBlobKey = (id: string): string => `portada:${id}`;

/**
 * Descarga un blob como archivo. La URL temporal se revoca en cuanto el
 * navegador ha tenido ocasión de iniciar la descarga.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}
