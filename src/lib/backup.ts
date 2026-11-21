import type { AppSettings, DataActionResult, StorageUsage } from "@/types/workspace";
import { clearAllBlobs, deleteBlobs, downloadBlob, getBlob, putBlob } from "@/lib/blobStore";
import { createId } from "@/lib/ids";
import { sanitizeItems, type ItemsMap } from "@/lib/notesTree";
import { notesStorage, useNotesStore } from "@/store/notesStore";
import { DEFAULT_SETTINGS, sanitizeSettings, settingsStorage, useSettingsStore } from "@/store/settingsStore";
import { studioStorage, useStudioStore } from "@/store/studioStore";
import { DEFAULT_PLATFORMS } from "@/lib/platforms";
import { revokeAllPreviewUrls } from "@/lib/media";

/**
 * Copias de seguridad, uso de almacenamiento y borrado total.
 *
 * La copia incluye notas, carpetas, adjuntos (en base64) y ajustes. Los vídeos
 * del estudio NO se incluyen: pesan demasiado para un archivo JSON y están
 * pensados para publicarse en el momento.
 */

const BACKUP_FORMAT = "crisworkspace-backup";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const BACKUP_VERSION = 1;

interface BackupAttachment {
  blobKey: string;
  mimeType: string;
  base64: string;
}

interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: number;
  items: ItemsMap;
  settings: AppSettings;
  attachments: BackupAttachment[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function exportBackup(): Promise<DataActionResult> {
  try {
    const { items } = useNotesStore.getState();
    const attachments: BackupAttachment[] = [];
    let missing = 0;
    for (const item of Object.values(items)) {
      if (item.kind !== "note") continue;
      for (const meta of item.attachments) {
        const blob = await getBlob(meta.blobKey);
        if (!blob) {
          missing += 1;
          continue;
        }
        attachments.push({ blobKey: meta.blobKey, mimeType: meta.mimeType, base64: await blobToBase64(blob) });
      }
    }
    const backup: BackupFile = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: Date.now(),
      items,
      settings: useSettingsStore.getState().settings,
      attachments,
    };
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }), `crisworkspace-copia-${date}.json`);
    const notes = Object.values(items).filter((i) => i.kind === "note").length;
    return {
      ok: true,
      message: `Copia descargada: ${plural(notes, "nota", "notas")} y ${plural(attachments.length, "adjunto", "adjuntos")}.${missing > 0 ? ` (${missing} adjuntos no se encontraron.)` : ""}`,
    };
  } catch (error) {
    console.error("[CrisWorkspace] Error al exportar", error);
    return { ok: false, message: "No se pudo crear la copia de seguridad." };
  }
}

export async function importBackup(file: File): Promise<DataActionResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, message: "El archivo no es una copia de CrisWorkspace válida." };
  }
  const data = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Partial<Record<keyof BackupFile, unknown>>;
  if (data.format !== BACKUP_FORMAT) {
    return { ok: false, message: "El archivo no es una copia de CrisWorkspace." };
  }
  if (typeof data.version !== "number" || data.version > BACKUP_VERSION) {
    return { ok: false, message: "Esta copia es de una versión más nueva de la app." };
  }
  try {
    const items = sanitizeItems(data.items);
    // Restaura los adjuntos con claves nuevas para no pisar archivos existentes.
    const rawAttachments = Array.isArray(data.attachments) ? data.attachments : [];
    const keyMap = new Map<string, string>();
    for (const raw of rawAttachments) {
      if (typeof raw !== "object" || raw === null) continue;
      const a = raw as Record<string, unknown>;
      if (typeof a.blobKey !== "string" || typeof a.base64 !== "string") continue;
      const newKey = `attachment:${createId()}`;
      await putBlob(newKey, base64ToBlob(a.base64, typeof a.mimeType === "string" ? a.mimeType : "application/octet-stream"));
      keyMap.set(a.blobKey, newKey);
    }
    let restored = 0;
    for (const item of Object.values(items)) {
      if (item.kind !== "note") continue;
      item.attachments = item.attachments.flatMap((meta) => {
        const newKey = keyMap.get(meta.blobKey);
        if (!newKey) return [];
        restored += 1;
        return [{ ...meta, blobKey: newKey }];
      });
    }
    // Los adjuntos actuales dejan de usarse: se borran tras sustituir las notas.
    const oldKeys = Object.values(useNotesStore.getState().items).flatMap((i) => (i.kind === "note" ? i.attachments.map((a) => a.blobKey) : []));
    const firstNote = Object.values(items).find((i) => i.kind === "note");
    useNotesStore.setState({
      items,
      selectedNoteId: firstNote?.id ?? null,
      expandedFolderIds: Object.values(items).filter((i) => i.kind === "folder").map((i) => i.id),
      seeded: true,
    });
    await deleteBlobs(oldKeys);
    useSettingsStore.setState({ settings: { ...sanitizeSettings(data.settings), installGuideSeen: true } });
    const notes = Object.values(items).filter((i) => i.kind === "note").length;
    return { ok: true, message: `Copia restaurada: ${plural(notes, "nota", "notas")} y ${plural(restored, "adjunto", "adjuntos")}.` };
  } catch (error) {
    console.error("[CrisWorkspace] Error al importar", error);
    return { ok: false, message: "No se pudo restaurar la copia (¿falta espacio?)." };
  }
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const { items } = useNotesStore.getState();
  const { queue } = useStudioStore.getState().broadcast;
  let notes = 0;
  let folders = 0;
  let attachments = 0;
  let attachmentsBytes = 0;
  for (const item of Object.values(items)) {
    if (item.kind === "folder") {
      folders += 1;
      continue;
    }
    notes += 1;
    attachments += item.attachments.length;
    attachmentsBytes += item.attachments.reduce((sum, a) => sum + a.sizeBytes, 0);
  }
  let usedBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
    }
  } catch {
    // Algunos navegadores (modo privado) no lo informan.
  }
  return {
    usedBytes,
    quotaBytes,
    notes,
    folders,
    attachments,
    attachmentsBytes,
    videos: queue.length,
    videosBytes: queue.reduce((sum, v) => sum + v.sizeBytes, 0),
  };
}

/**
 * Borra todo y recarga la página para empezar de cero (vuelve a salir la nota
 * de bienvenida). Se vacían los stores y se fuerza su escritura en lugar de
 * borrar las bases de datos, porque con conexiones abiertas el navegador deja
 * ese borrado bloqueado.
 */
export async function deleteAllData(): Promise<DataActionResult> {
  try {
    useStudioStore.getState().resetBroadcast();
    revokeAllPreviewUrls();
    useNotesStore.setState({ items: {}, selectedNoteId: null, expandedFolderIds: [], seeded: false });
    useStudioStore.setState((s) => ({
      platforms: DEFAULT_PLATFORMS.map((p) => ({ ...p })),
      mentionHistory: [],
      broadcast: { ...s.broadcast, isRunning: false, startTimeTimestamp: null, elapsedSeconds: 0, queue: [] },
    }));
    useSettingsStore.setState((s) => ({
      settings: { ...DEFAULT_SETTINGS, installGuideSeen: s.settings.installGuideSeen },
      lastSection: "organizacion",
    }));
    await Promise.all([clearAllBlobs(), notesStorage.flush(), studioStorage.flush(), settingsStorage.flush()]);
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("crisworkspace")).map((k) => caches.delete(k)));
    }
    window.setTimeout(() => window.location.reload(), 900);
    return { ok: true, message: "Datos borrados. La app se reiniciará en un momento." };
  } catch (error) {
    console.error("[CrisWorkspace] Error al borrar los datos", error);
    return { ok: false, message: "No se pudieron borrar todos los datos." };
  }
}
