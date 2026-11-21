import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AttachmentMeta, Id, NoteBlockPatch, NoteBlockType, NoteItem } from "@/types/workspace";
import { attachmentBlobKey, deleteBlobs, downloadBlob, getBlob, putBlob } from "@/lib/blobStore";
import { createDebouncedIdbStorage } from "@/lib/idbStorage";
import { createId } from "@/lib/ids";
import {
  ancestorIds,
  canMove,
  collectDescendantIds,
  createBlock,
  createFolder,
  createNote,
  sanitizeItems,
  type ItemsMap,
} from "@/lib/notesTree";
import { useSaveStatusStore } from "@/store/saveStatusStore";

/** Autoguardado: se escribe en IndexedDB 500 ms después del último cambio. */
export const AUTOSAVE_DEBOUNCE_MS = 500;

let savedTimer: ReturnType<typeof setTimeout> | null = null;

export const notesStorage = createDebouncedIdbStorage(AUTOSAVE_DEBOUNCE_MS, (status) => {
  const { setStatus } = useSaveStatusStore.getState();
  if (savedTimer !== null) {
    clearTimeout(savedTimer);
    savedTimer = null;
  }
  setStatus(status);
  // "Guardado" se muestra un momento y vuelve a reposo.
  if (status === "saved") {
    savedTimer = setTimeout(() => {
      savedTimer = null;
      if (useSaveStatusStore.getState().status === "saved") setStatus("idle");
    }, 1_800);
  }
});

interface PersistedNotes {
  items: ItemsMap;
  selectedNoteId: Id | null;
  expandedFolderIds: Id[];
  seeded: boolean;
}

export interface NotesState extends PersistedNotes {
  hydrated: boolean;

  selectNote: (noteId: Id | null) => void;
  toggleFolder: (folderId: Id) => void;
  createNote: (parentId: Id | null) => Id;
  createFolder: (parentId: Id | null) => Id;
  renameFolder: (folderId: Id, name: string) => void;
  deleteItem: (itemId: Id) => void;
  moveItem: (itemId: Id, targetFolderId: Id | null) => void;

  updateTitle: (noteId: Id, title: string) => void;
  updateIcon: (noteId: Id, icon: string | null) => void;
  updateBlock: (noteId: Id, blockId: Id, patch: NoteBlockPatch) => void;
  addBlock: (noteId: Id, afterBlockId: Id | null, type: NoteBlockType) => Id;
  deleteBlock: (noteId: Id, blockId: Id) => void;

  uploadFiles: (noteId: Id, files: readonly File[]) => Promise<void>;
  downloadAttachment: (noteId: Id, attachmentId: Id) => Promise<void>;
  deleteAttachment: (noteId: Id, attachmentId: Id) => void;
}

function welcomeItems(now: number): { items: ItemsMap; noteId: Id; folderId: Id } {
  const folder = createFolder(null, now, "Primeros pasos");
  const note = createNote(folder.id, now, {
    title: "Bienvenida a CrisWorkspace",
    icon: "👋",
    blocks: [
      createBlock("heading2", "Tu espacio de organización"),
      createBlock("paragraph", "Crea carpetas y notas desde el panel izquierdo. Arrastra cualquier elemento a una carpeta para moverlo."),
      createBlock("todo", "Escribe tu primera nota"),
      createBlock("todo", "Sube un archivo arrastrándolo a la zona de adjuntos"),
      createBlock("todo", "Programa un vídeo en el Estudio de Vídeo"),
      createBlock("quote", "Todo se guarda solo en este navegador, medio segundo después de cada cambio."),
    ],
  });
  return { items: { [folder.id]: folder, [note.id]: note }, noteId: note.id, folderId: folder.id };
}

/** Aplica `update` a la nota `noteId` si existe y es una nota. */
function patchNote(items: ItemsMap, noteId: Id, update: (note: NoteItem) => NoteItem | null): ItemsMap | null {
  const current = items[noteId];
  if (!current || current.kind !== "note") return null;
  const next = update(current);
  if (!next || next === current) return null;
  return { ...items, [noteId]: { ...next, updatedAt: Date.now() } };
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      items: {},
      selectedNoteId: null,
      expandedFolderIds: [],
      seeded: false,
      hydrated: false,

      selectNote: (noteId) => {
        if (noteId !== null && get().items[noteId]?.kind !== "note") return;
        set({ selectedNoteId: noteId });
      },

      toggleFolder: (folderId) =>
        set((state) => ({
          expandedFolderIds: state.expandedFolderIds.includes(folderId)
            ? state.expandedFolderIds.filter((id) => id !== folderId)
            : [...state.expandedFolderIds, folderId],
        })),

      createNote: (parentId) => {
        const { items } = get();
        const parent = parentId !== null && items[parentId]?.kind === "folder" ? parentId : null;
        const note = createNote(parent, Date.now());
        set((state) => ({
          items: { ...state.items, [note.id]: note },
          selectedNoteId: note.id,
          expandedFolderIds: parent ? [...new Set([...state.expandedFolderIds, ...ancestorIds(state.items, parent), parent])] : state.expandedFolderIds,
        }));
        return note.id;
      },

      createFolder: (parentId) => {
        const { items } = get();
        const parent = parentId !== null && items[parentId]?.kind === "folder" ? parentId : null;
        const folder = createFolder(parent, Date.now());
        set((state) => ({
          items: { ...state.items, [folder.id]: folder },
          expandedFolderIds: [...new Set([...state.expandedFolderIds, ...(parent ? [...ancestorIds(state.items, parent), parent] : []), folder.id])],
        }));
        return folder.id;
      },

      renameFolder: (folderId, name) => {
        const clean = name.trim().slice(0, 120);
        set((state) => {
          const folder = state.items[folderId];
          if (!folder || folder.kind !== "folder" || clean.length === 0 || clean === folder.name) return state;
          return { items: { ...state.items, [folderId]: { ...folder, name: clean, updatedAt: Date.now() } } };
        });
      },

      deleteItem: (itemId) => {
        const { items } = get();
        if (!items[itemId]) return;
        const doomed = new Set<Id>([itemId, ...collectDescendantIds(items, itemId)]);
        const blobKeys: string[] = [];
        const next: ItemsMap = {};
        for (const item of Object.values(items)) {
          if (doomed.has(item.id)) {
            if (item.kind === "note") blobKeys.push(...item.attachments.map((a) => a.blobKey));
          } else {
            next[item.id] = item;
          }
        }
        set((state) => ({
          items: next,
          selectedNoteId: state.selectedNoteId !== null && doomed.has(state.selectedNoteId) ? null : state.selectedNoteId,
          expandedFolderIds: state.expandedFolderIds.filter((id) => !doomed.has(id)),
        }));
        // Los archivos se borran después de quitar las notas: si falla, solo queda basura invisible.
        void deleteBlobs(blobKeys);
      },

      moveItem: (itemId, targetFolderId) =>
        set((state) => {
          if (!canMove(state.items, itemId, targetFolderId)) return state;
          const item = state.items[itemId];
          if (!item) return state;
          return {
            items: { ...state.items, [itemId]: { ...item, parentId: targetFolderId, updatedAt: Date.now() } },
            expandedFolderIds:
              targetFolderId !== null
                ? [...new Set([...state.expandedFolderIds, ...ancestorIds(state.items, targetFolderId), targetFolderId])]
                : state.expandedFolderIds,
          };
        }),

      updateTitle: (noteId, title) =>
        set((state) => {
          const items = patchNote(state.items, noteId, (n) => (n.title === title ? null : { ...n, title: title.slice(0, 300) }));
          return items ? { items } : state;
        }),

      updateIcon: (noteId, icon) =>
        set((state) => {
          const items = patchNote(state.items, noteId, (n) => (n.icon === icon ? null : { ...n, icon }));
          return items ? { items } : state;
        }),

      updateBlock: (noteId, blockId, patch) =>
        set((state) => {
          const items = patchNote(state.items, noteId, (n) => {
            let changed = false;
            const blocks = n.blocks.map((b) => {
              if (b.id !== blockId) return b;
              const next = { ...b, ...patch };
              if (next.type === "divider") next.text = "";
              if (next.text === b.text && next.type === b.type && next.checked === b.checked) return b;
              changed = true;
              return next;
            });
            return changed ? { ...n, blocks } : null;
          });
          return items ? { items } : state;
        }),

      addBlock: (noteId, afterBlockId, type) => {
        const block = createBlock(type);
        set((state) => {
          const items = patchNote(state.items, noteId, (n) => {
            const index = afterBlockId === null ? -1 : n.blocks.findIndex((b) => b.id === afterBlockId);
            const blocks = [...n.blocks];
            if (index === -1) blocks.push(block);
            else blocks.splice(index + 1, 0, block);
            return { ...n, blocks };
          });
          return items ? { items } : state;
        });
        return block.id;
      },

      deleteBlock: (noteId, blockId) =>
        set((state) => {
          const items = patchNote(state.items, noteId, (n) => {
            if (!n.blocks.some((b) => b.id === blockId)) return null;
            const blocks = n.blocks.filter((b) => b.id !== blockId);
            // Una nota nunca se queda sin bloques: siempre hay donde escribir.
            return { ...n, blocks: blocks.length > 0 ? blocks : [createBlock()] };
          });
          return items ? { items } : state;
        }),

      uploadFiles: async (noteId, files) => {
        if (get().items[noteId]?.kind !== "note" || files.length === 0) return;
        const { setStatus } = useSaveStatusStore.getState();
        setStatus("saving");
        const stored = await Promise.allSettled(
          files.map(async (file): Promise<AttachmentMeta> => {
            const id = createId();
            const blobKey = attachmentBlobKey(id);
            await putBlob(blobKey, file);
            return {
              id,
              blobKey,
              name: file.name || "archivo",
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              createdAt: Date.now(),
            };
          }),
        );
        const added = stored.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
        const failed = stored.length - added.length;
        let orphaned: string[] = [];
        set((state) => {
          // La nota pudo borrarse mientras se subían los archivos.
          const items = patchNote(state.items, noteId, (n) => ({ ...n, attachments: [...n.attachments, ...added] }));
          if (!items) orphaned = added.map((a) => a.blobKey);
          return items ? { items } : state;
        });
        if (orphaned.length > 0) void deleteBlobs(orphaned);
        if (failed > 0) {
          console.error(`[CrisWorkspace] ${failed} archivo(s) no se pudieron guardar.`);
          setStatus("error");
        }
      },

      downloadAttachment: async (noteId, attachmentId) => {
        const note = get().items[noteId];
        if (!note || note.kind !== "note") return;
        const meta = note.attachments.find((a) => a.id === attachmentId);
        if (!meta) return;
        const blob = await getBlob(meta.blobKey);
        if (!blob) {
          useSaveStatusStore.getState().setStatus("error");
          console.error(`[CrisWorkspace] El archivo «${meta.name}» ya no está en el almacenamiento.`);
          return;
        }
        downloadBlob(blob, meta.name);
      },

      deleteAttachment: (noteId, attachmentId) => {
        let blobKey: string | null = null;
        set((state) => {
          const items = patchNote(state.items, noteId, (n) => {
            const meta = n.attachments.find((a) => a.id === attachmentId);
            if (!meta) return null;
            blobKey = meta.blobKey;
            return { ...n, attachments: n.attachments.filter((a) => a.id !== attachmentId) };
          });
          return items ? { items } : state;
        });
        if (blobKey) void deleteBlobs([blobKey]);
      },
    }),
    {
      name: "crisworkspace:notes",
      version: 1,
      storage: createJSONStorage<PersistedNotes>(() => notesStorage),
      skipHydration: true,
      partialize: (state): PersistedNotes => ({
        items: state.items,
        selectedNoteId: state.selectedNoteId,
        expandedFolderIds: state.expandedFolderIds,
        seeded: state.seeded,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Record<keyof PersistedNotes, unknown>>;
        const items = sanitizeItems(p.items);
        const selected = typeof p.selectedNoteId === "string" && items[p.selectedNoteId]?.kind === "note" ? p.selectedNoteId : null;
        const expanded = Array.isArray(p.expandedFolderIds)
          ? p.expandedFolderIds.filter((id): id is string => typeof id === "string" && items[id]?.kind === "folder")
          : [];
        return { ...current, items, selectedNoteId: selected, expandedFolderIds: expanded, seeded: p.seeded === true };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error("[CrisWorkspace] No se pudieron cargar las notas", error);
        // Primera vez: una nota de bienvenida para que la pantalla no esté vacía.
        if (!error && state && !state.seeded && Object.keys(state.items).length === 0) {
          const welcome = welcomeItems(Date.now());
          useNotesStore.setState({
            items: welcome.items,
            selectedNoteId: welcome.noteId,
            expandedFolderIds: [welcome.folderId],
            seeded: true,
          });
        }
        useNotesStore.setState({ hydrated: true });
      },
    },
  ),
);
