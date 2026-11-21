import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppSettings, InterfaceSize, MotionLevel, StartSection, WorkspaceSection } from "@/types/workspace";
import { createDebouncedIdbStorage } from "@/lib/idbStorage";

export const DEFAULT_SETTINGS: AppSettings = {
  interfaceSize: "normal",
  motion: "completas",
  show3DOrb: true,
  startSection: "organizacion",
  sidebarCollapsedByDefault: false,
  installGuideSeen: false,
};

export const settingsStorage = createDebouncedIdbStorage(150);

interface PersistedSettings {
  settings: AppSettings;
  lastSection: WorkspaceSection;
}

export interface SettingsState extends PersistedSettings {
  hydrated: boolean;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
  rememberSection: (section: WorkspaceSection) => void;
}

const SIZES: readonly InterfaceSize[] = ["compacto", "normal", "grande"];
const MOTIONS: readonly MotionLevel[] = ["completas", "reducidas"];
const STARTS: readonly StartSection[] = ["organizacion", "estudio", "ultima"];
const SECTIONS: readonly WorkspaceSection[] = ["organizacion", "estudio", "ajustes"];

/** Repara ajustes guardados (versiones antiguas o datos corruptos) campo a campo. */
export function sanitizeSettings(raw: unknown): AppSettings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    interfaceSize: SIZES.find((s) => s === r.interfaceSize) ?? DEFAULT_SETTINGS.interfaceSize,
    motion: MOTIONS.find((m) => m === r.motion) ?? DEFAULT_SETTINGS.motion,
    show3DOrb: typeof r.show3DOrb === "boolean" ? r.show3DOrb : DEFAULT_SETTINGS.show3DOrb,
    startSection: STARTS.find((s) => s === r.startSection) ?? DEFAULT_SETTINGS.startSection,
    sidebarCollapsedByDefault:
      typeof r.sidebarCollapsedByDefault === "boolean" ? r.sidebarCollapsedByDefault : DEFAULT_SETTINGS.sidebarCollapsedByDefault,
    installGuideSeen: r.installGuideSeen === true,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      lastSection: "organizacion",
      hydrated: false,
      update: (patch) => set((state) => ({ settings: sanitizeSettings({ ...state.settings, ...patch }) })),
      // Restablecer no vuelve a mostrar la guía de instalación por sorpresa.
      reset: () => set((state) => ({ settings: { ...DEFAULT_SETTINGS, installGuideSeen: state.settings.installGuideSeen } })),
      rememberSection: (section) => set({ lastSection: section }),
    }),
    {
      name: "crisworkspace:settings",
      version: 1,
      storage: createJSONStorage<PersistedSettings>(() => settingsStorage),
      skipHydration: true,
      partialize: (state): PersistedSettings => ({ settings: state.settings, lastSection: state.lastSection }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Record<keyof PersistedSettings, unknown>>;
        return {
          ...current,
          settings: sanitizeSettings(p.settings),
          lastSection: SECTIONS.find((s) => s === p.lastSection) ?? "organizacion",
        };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error("[CrisWorkspace] No se pudieron cargar los ajustes", error);
        useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Sección con la que arranca la app según los ajustes. */
export function initialSection(settings: AppSettings, lastSection: WorkspaceSection): WorkspaceSection {
  if (settings.startSection === "ultima") return lastSection === "ajustes" ? "organizacion" : lastSection;
  return settings.startSection;
}

/** Tamaño de letra raíz (Tailwind usa rem, así que escala toda la interfaz). */
export const ROOT_FONT_SIZE: Record<InterfaceSize, string> = {
  compacto: "14px",
  normal: "16px",
  grande: "18px",
};
