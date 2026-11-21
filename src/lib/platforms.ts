import type { SocialPlatform, SocialPlatformId } from "@/types/workspace";

/** Orden fijo en que se muestran las redes. */
export const PLATFORM_IDS: readonly SocialPlatformId[] = ["instagram", "facebook", "twitter", "tiktok", "youtube"];

/**
 * Valores por defecto de cada red. Los límites son los habituales para subir
 * vídeo en 2026 (cuentas estándar); si una red los cambia, se ajustan aquí.
 */
export const DEFAULT_PLATFORMS: readonly SocialPlatform[] = [
  {
    id: "instagram",
    displayName: "Instagram",
    connected: false,
    handle: null,
    brandColor: "#E1306C",
    supportsCustomCover: true,
    limits: { maxCaptionChars: 2_200, maxVideoSeconds: 180, maxMentions: 20 },
  },
  {
    id: "facebook",
    displayName: "Facebook",
    connected: false,
    handle: null,
    brandColor: "#1877F2",
    supportsCustomCover: true,
    limits: { maxCaptionChars: 63_206, maxVideoSeconds: 14_400, maxMentions: 50 },
  },
  {
    id: "twitter",
    displayName: "X",
    connected: false,
    handle: null,
    brandColor: "#E7E9EA",
    supportsCustomCover: false,
    limits: { maxCaptionChars: 280, maxVideoSeconds: 140, maxMentions: 10 },
  },
  {
    id: "tiktok",
    displayName: "TikTok",
    connected: false,
    handle: null,
    brandColor: "#25F4EE",
    supportsCustomCover: false,
    limits: { maxCaptionChars: 4_000, maxVideoSeconds: 600, maxMentions: 20 },
  },
  {
    id: "youtube",
    displayName: "YouTube",
    connected: false,
    handle: null,
    brandColor: "#FF0033",
    supportsCustomCover: true,
    limits: { maxCaptionChars: 5_000, maxVideoSeconds: 43_200, maxMentions: 15 },
  },
];

export function isPlatformId(value: unknown): value is SocialPlatformId {
  return typeof value === "string" && (PLATFORM_IDS as readonly string[]).includes(value);
}

/** Normaliza un usuario: quita espacios y garantiza la arroba inicial. */
export function normalizeHandle(raw: string): string | null {
  const clean = raw.trim().replace(/^@+/, "").replace(/\s+/g, "");
  return clean.length > 0 ? `@${clean}` : null;
}

/**
 * Reconstruye la lista de redes desde los valores por defecto aplicando solo
 * lo que el usuario puede cambiar (conexión y usuario). Así un guardado antiguo
 * siempre recibe los límites y colores actuales.
 */
export function mergePlatforms(saved: unknown): SocialPlatform[] {
  const savedList = Array.isArray(saved) ? saved : [];
  return DEFAULT_PLATFORMS.map((base) => {
    const match: unknown = savedList.find(
      (p: unknown) => typeof p === "object" && p !== null && (p as { id?: unknown }).id === base.id,
    );
    if (typeof match !== "object" || match === null) return { ...base };
    const m = match as { connected?: unknown; handle?: unknown };
    const handle = typeof m.handle === "string" ? normalizeHandle(m.handle) : null;
    const connected = m.connected === true && handle !== null;
    return { ...base, connected, handle: connected ? handle : null };
  });
}
