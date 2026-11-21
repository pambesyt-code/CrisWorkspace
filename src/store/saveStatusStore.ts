import { create } from "zustand";
import type { SaveStatus } from "@/types/workspace";

/**
 * Estado del autoguardado de las notas. Vive en un store aparte, sin persistir:
 * si estuviera dentro del store persistido, cada cambio de estado provocaría
 * otra escritura y se entraría en un bucle.
 */
interface SaveStatusState {
  status: SaveStatus;
  setStatus: (status: SaveStatus) => void;
}

export const useSaveStatusStore = create<SaveStatusState>()((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
}));
