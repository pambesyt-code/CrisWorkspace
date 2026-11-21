import type { Id } from "@/types/workspace";

/** Genera un id único. Usa `crypto.randomUUID` cuando existe (contextos seguros). */
export function createId(): Id {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}
