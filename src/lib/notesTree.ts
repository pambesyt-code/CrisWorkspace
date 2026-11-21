import type {
  FolderItem,
  Id,
  NoteBlock,
  NoteBlockType,
  NoteItem,
  WorkspaceItem,
  WorkspaceTreeNode,
} from "@/types/workspace";
import { createId } from "@/lib/ids";

/**
 * Funciones puras sobre el árbol de carpetas y notas. El estado se guarda
 * plano (`Record<Id, WorkspaceItem>` con `parentId`) y el árbol recursivo se
 * deriva aquí. Sin efectos secundarios: se pueden probar en Node.
 */

export type ItemsMap = Record<Id, WorkspaceItem>;

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

const labelOf = (item: WorkspaceItem): string =>
  item.kind === "folder" ? item.name : item.title || "Sin título";

export function buildTree(items: ItemsMap): WorkspaceTreeNode[] {
  const childrenByParent = new Map<Id | null, WorkspaceItem[]>();
  for (const item of Object.values(items)) {
    // Un padre inexistente (dato corrupto) se trata como raíz para no perder la nota.
    const parent = item.parentId !== null && items[item.parentId]?.kind === "folder" ? item.parentId : null;
    const list = childrenByParent.get(parent);
    if (list) list.push(item);
    else childrenByParent.set(parent, [item]);
  }

  const visited = new Set<Id>();
  const build = (parentId: Id | null, depth: number): WorkspaceTreeNode[] => {
    const children = [...(childrenByParent.get(parentId) ?? [])].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return collator.compare(labelOf(a), labelOf(b)) || a.createdAt - b.createdAt;
    });
    const nodes: WorkspaceTreeNode[] = [];
    for (const child of children) {
      if (visited.has(child.id)) continue; // protección ante ciclos
      visited.add(child.id);
      if (child.kind === "folder") {
        nodes.push({ kind: "folder", folder: child, depth, children: build(child.id, depth + 1) });
      } else {
        nodes.push({ kind: "note", note: child, depth });
      }
    }
    return nodes;
  };
  return build(null, 0);
}

/** Ids de todos los descendientes (sin incluir el propio `rootId`). */
export function collectDescendantIds(items: ItemsMap, rootId: Id): Id[] {
  const result: Id[] = [];
  const queue: Id[] = [rootId];
  const seen = new Set<Id>([rootId]);
  const all = Object.values(items);
  while (queue.length > 0) {
    const current = queue.shift() as Id;
    for (const item of all) {
      if (item.parentId === current && !seen.has(item.id)) {
        seen.add(item.id);
        result.push(item.id);
        queue.push(item.id);
      }
    }
  }
  return result;
}

/** ¿Se puede mover `itemId` dentro de `targetFolderId`? */
export function canMove(items: ItemsMap, itemId: Id, targetFolderId: Id | null): boolean {
  const item = items[itemId];
  if (!item) return false;
  if (targetFolderId === null) return item.parentId !== null;
  const target = items[targetFolderId];
  if (!target || target.kind !== "folder") return false;
  if (targetFolderId === itemId) return false;
  if (item.parentId === targetFolderId) return false;
  if (item.kind === "folder" && collectDescendantIds(items, itemId).includes(targetFolderId)) return false;
  return true;
}

/** Cadena de carpetas desde la raíz hasta `id` (sin incluirlo). */
export function ancestorIds(items: ItemsMap, id: Id): Id[] {
  const chain: Id[] = [];
  const seen = new Set<Id>();
  let current = items[id]?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    chain.unshift(current);
    current = items[current]?.parentId ?? null;
  }
  return chain;
}

export function createBlock(type: NoteBlockType = "paragraph", text = ""): NoteBlock {
  return { id: createId(), type, text: type === "divider" ? "" : text, checked: false };
}

export function createNote(parentId: Id | null, now: number, partial?: Partial<Pick<NoteItem, "title" | "icon" | "blocks">>): NoteItem {
  return {
    kind: "note",
    id: createId(),
    parentId,
    title: partial?.title ?? "",
    icon: partial?.icon ?? null,
    blocks: partial?.blocks && partial.blocks.length > 0 ? partial.blocks : [createBlock()],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createFolder(parentId: Id | null, now: number, name = "Nueva carpeta"): FolderItem {
  return { kind: "folder", id: createId(), parentId, name, createdAt: now, updatedAt: now };
}

export function countItems(items: ItemsMap): { notes: number; folders: number } {
  let notes = 0;
  let folders = 0;
  for (const item of Object.values(items)) {
    if (item.kind === "note") notes += 1;
    else folders += 1;
  }
  return { notes, folders };
}

const BLOCK_TYPES: readonly NoteBlockType[] = ["paragraph", "heading1", "heading2", "todo", "bullet", "quote", "code", "divider"];

/**
 * Repara datos cargados de IndexedDB (guardados antiguos o corruptos) para que
 * cumplan el contrato: campos que faltan reciben valores por defecto.
 */
export function sanitizeItems(raw: unknown): ItemsMap {
  if (typeof raw !== "object" || raw === null) return {};
  const result: ItemsMap = {};
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const v = value as Record<string, unknown>;
    if (typeof v.id !== "string") continue;
    const parentId = typeof v.parentId === "string" ? v.parentId : null;
    const createdAt = typeof v.createdAt === "number" ? v.createdAt : 0;
    const updatedAt = typeof v.updatedAt === "number" ? v.updatedAt : createdAt;
    if (v.kind === "folder") {
      result[v.id] = { kind: "folder", id: v.id, parentId, name: typeof v.name === "string" ? v.name : "Carpeta", createdAt, updatedAt };
    } else if (v.kind === "note") {
      const blocks = Array.isArray(v.blocks)
        ? v.blocks.flatMap((b): NoteBlock[] => {
            if (typeof b !== "object" || b === null) return [];
            const blk = b as Record<string, unknown>;
            const type = BLOCK_TYPES.find((t) => t === blk.type) ?? "paragraph";
            return [{ id: typeof blk.id === "string" ? blk.id : createId(), type, text: typeof blk.text === "string" ? blk.text : "", checked: blk.checked === true }];
          })
        : [];
      const attachments = Array.isArray(v.attachments)
        ? v.attachments.flatMap((a) => {
            if (typeof a !== "object" || a === null) return [];
            const att = a as Record<string, unknown>;
            if (typeof att.id !== "string" || typeof att.blobKey !== "string") return [];
            return [{
              id: att.id,
              blobKey: att.blobKey,
              name: typeof att.name === "string" ? att.name : "archivo",
              mimeType: typeof att.mimeType === "string" ? att.mimeType : "application/octet-stream",
              sizeBytes: typeof att.sizeBytes === "number" ? att.sizeBytes : 0,
              createdAt: typeof att.createdAt === "number" ? att.createdAt : createdAt,
            }];
          })
        : [];
      result[v.id] = {
        kind: "note",
        id: v.id,
        parentId,
        title: typeof v.title === "string" ? v.title : "",
        icon: typeof v.icon === "string" ? v.icon : null,
        blocks: blocks.length > 0 ? blocks : [createBlock()],
        attachments,
        createdAt,
        updatedAt,
      };
    }
  }
  return result;
}
