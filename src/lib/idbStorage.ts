import { createStore, del, get, set, type UseStore } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

/**
 * Almacenamiento para `zustand/persist` sobre IndexedDB con escritura diferida.
 *
 * - `setItem` no escribe al instante: espera `debounceMs` sin cambios (autosave
 *   con debounce). Si llega otro cambio antes, el temporizador se reinicia.
 * - Si el valor serializado no cambió respecto a lo último escrito, no escribe.
 * - `flush()` fuerza la escritura pendiente (se llama al ocultar o cerrar la pestaña).
 * - En el servidor (SSR) todas las operaciones son no-ops.
 */

export type PersistWriteStatus = "pending" | "saving" | "saved" | "error";

export interface DebouncedIdbStorage extends StateStorage {
  flush: () => Promise<void>;
}

let stateDb: UseStore | null = null;

function db(): UseStore | null {
  if (typeof indexedDB === "undefined") return null;
  stateDb ??= createStore("crisworkspace-state", "keyval");
  return stateDb;
}

export function createDebouncedIdbStorage(
  debounceMs: number,
  onStatus?: (status: PersistWriteStatus) => void,
): DebouncedIdbStorage {
  const lastWritten = new Map<string, string>();
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  const writeAll = async (): Promise<void> => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const store = db();
    if (!store || pending.size === 0) return;
    const batch = [...pending.entries()];
    pending.clear();
    onStatus?.("saving");
    // Encadena escrituras para que nunca se pisen fuera de orden.
    writing = writing.then(async () => {
      try {
        for (const [name, value] of batch) {
          await set(name, value, store);
          lastWritten.set(name, value);
        }
        if (pending.size === 0) onStatus?.("saved");
      } catch (error) {
        console.error("[CrisWorkspace] Error guardando en IndexedDB", error);
        // Devuelve el lote a la cola para el siguiente intento (sin pisar valores más nuevos).
        for (const [name, value] of batch) {
          if (!pending.has(name)) pending.set(name, value);
        }
        onStatus?.("error");
      }
    });
    await writing;
  };

  return {
    getItem: async (name) => {
      const store = db();
      if (!store) return null;
      const value: unknown = await get(name, store);
      if (typeof value !== "string") return null;
      lastWritten.set(name, value);
      return value;
    },
    setItem: (name, value) => {
      if (!db()) return;
      if (lastWritten.get(name) === value && !pending.has(name)) return;
      pending.set(name, value);
      onStatus?.("pending");
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        void writeAll();
      }, debounceMs);
    },
    removeItem: async (name) => {
      const store = db();
      if (!store) return;
      pending.delete(name);
      lastWritten.delete(name);
      await del(name, store);
    },
    flush: writeAll,
  };
}
