/**
 * Contrato central de CrisWorkspace.
 *
 * Este archivo es la frontera entre la lógica (stores, motor de reloj, servicio
 * de publicación) y la interfaz visual. Los componentes solo reciben datos y
 * callbacks con las formas definidas aquí: nunca importan los stores directamente.
 *
 * Reglas: cero `any`, ids como string, fechas como milisegundos epoch (number).
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Utilidades comunes                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export type Id = string;

/** Milisegundos desde epoch (resultado de `Date.now()`). */
export type EpochMs = number;

/** Secciones principales de la aplicación. */
export type WorkspaceSection = "organizacion" | "estudio" | "ajustes";

/** Estado del guardado automático (autosave con debounce de 500 ms). */
export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/* ────────────────────────────────────────────────────────────────────────── */
/* Sección 1 · Mini-Notion                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type NoteBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "todo"
  | "bullet"
  | "quote"
  | "code"
  | "divider";

/** Un bloque de contenido dentro de una nota. `checked` solo tiene efecto en `todo`. */
export interface NoteBlock {
  id: Id;
  type: NoteBlockType;
  text: string;
  checked: boolean;
}

/** Cambios parciales permitidos sobre un bloque. */
export type NoteBlockPatch = Partial<Pick<NoteBlock, "type" | "text" | "checked">>;

/**
 * Metadatos de un archivo adjunto. El `Blob` real vive en IndexedDB bajo la
 * clave `blobKey`; nunca se guarda dentro del estado serializado.
 */
export interface AttachmentMeta {
  id: Id;
  blobKey: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: EpochMs;
}

export interface NoteItem {
  kind: "note";
  id: Id;
  /** Carpeta contenedora, o `null` si está en la raíz. */
  parentId: Id | null;
  title: string;
  /** Emoji opcional mostrado junto al título. */
  icon: string | null;
  blocks: NoteBlock[];
  attachments: AttachmentMeta[];
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface FolderItem {
  kind: "folder";
  id: Id;
  /** Carpeta contenedora, o `null` si está en la raíz. Las carpetas pueden anidarse sin límite. */
  parentId: Id | null;
  name: string;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export type WorkspaceItem = NoteItem | FolderItem;

/** Nodo del árbol jerárquico (estructura recursiva derivada del estado plano). */
export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode;

export interface FolderTreeNode {
  kind: "folder";
  folder: FolderItem;
  /** Primero subcarpetas (orden alfabético) y después notas (orden alfabético). */
  children: WorkspaceTreeNode[];
  depth: number;
}

export interface NoteTreeNode {
  kind: "note";
  note: NoteItem;
  depth: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sección 2 · Estudio multired                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export type SocialPlatformId = "instagram" | "facebook" | "twitter" | "tiktok" | "youtube";

export interface PlatformLimits {
  /** Máximo de caracteres en la descripción (incluidas las menciones). */
  maxCaptionChars: number;
  /** Duración máxima del vídeo en segundos. */
  maxVideoSeconds: number;
  /** Máximo de @menciones admitidas. */
  maxMentions: number;
}

export interface SocialPlatform {
  id: SocialPlatformId;
  /** Nombre visible: "Instagram", "Facebook", "X", "TikTok", "YouTube". */
  displayName: string;
  connected: boolean;
  /** Usuario conectado (por ejemplo `@cris`), o `null` si no hay conexión. */
  handle: string | null;
  limits: PlatformLimits;
  /** Color de marca en hexadecimal, para la interfaz. */
  brandColor: string;
  /** La red permite elegir una portada propia. Si es false, usa un fotograma del vídeo. */
  supportsCustomCover: boolean;
}

/**
 * Cuándo se publica un vídeo:
 * - "directo": en el minuto `triggerMinute` del Reloj Maestro (solo con el directo en marcha).
 * - "fecha": en el instante `publishAt` del calendario, haya directo o no.
 *   («Publicar ahora» es una "fecha" igual al momento de programarlo.)
 */
export type ScheduleMode = "directo" | "fecha";

/** Portada del vídeo: imagen subida por el usuario o fotograma sacado del propio vídeo. */
export type CoverSource = "imagen" | "fotograma";

export type ScheduledVideoStatus = "pending" | "uploading" | "published" | "error";

export interface PlatformPublishResult {
  platform: SocialPlatformId;
  ok: boolean;
  /** Enlace a la publicación cuando `ok` es true. */
  postUrl: string | null;
  /** Mensaje legible cuando `ok` es false. */
  error: string | null;
  finishedAt: EpochMs;
}

export interface ScheduledVideo {
  id: Id;
  /** Clave del `Blob` del vídeo en IndexedDB. */
  videoBlobKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Duración leída de los metadatos del archivo, o `null` si no se pudo leer. */
  durationSeconds: number | null;
  /**
   * `blob:` URL para reproducir el vídeo. Solo existe en memoria (se crea al
   * cargar y se revoca al borrar); nunca se persiste.
   */
  previewUrl: string | null;
  description: string;
  /** Menciones sin la arroba, sin duplicados, en minúsculas. */
  mentions: string[];
  platforms: SocialPlatformId[];
  scheduleMode: ScheduleMode;
  /** Minuto del directo en el que se publica (0 = al iniciar). Entero ≥ 0. Se usa si `scheduleMode` es "directo". */
  triggerMinute: number;
  /** Fecha y hora de publicación. Se usa si `scheduleMode` es "fecha"; `null` en modo "directo". */
  publishAt: EpochMs | null;
  /** Clave del `Blob` de la portada en IndexedDB, o `null` si no tiene portada propia. */
  coverBlobKey: string | null;
  coverSource: CoverSource | null;
  /** `blob:` URL de la portada para mostrarla. Solo en memoria, nunca se persiste. */
  coverUrl: string | null;
  status: ScheduledVideoStatus;
  /** Resultado por plataforma del último intento. */
  results: Partial<Record<SocialPlatformId, PlatformPublishResult>>;
  /** Error general del último intento, o `null`. */
  error: string | null;
  createdAt: EpochMs;
  publishedAt: EpochMs | null;
}

export interface BroadcastState {
  isRunning: boolean;
  /** Segundos transcurridos, calculados siempre como `Date.now() - startTimeTimestamp`. */
  elapsedSeconds: number;
  /** Momento de inicio del directo, o `null` si nunca se inició o se reinició. */
  startTimeTimestamp: EpochMs | null;
  queue: ScheduledVideo[];
}

/** Datos que la interfaz entrega para programar un vídeo nuevo. */
export interface NewScheduledVideoInput {
  file: File;
  description: string;
  platforms: SocialPlatformId[];
  scheduleMode: ScheduleMode;
  /** Solo cuenta en modo "directo". */
  triggerMinute: number;
  /** Solo cuenta en modo "fecha". */
  publishAt: EpochMs | null;
  /** Portada elegida, o `null` para no poner portada propia. */
  cover: Blob | null;
  coverSource: CoverSource | null;
}

/** Datos del formulario que se validan en vivo. */
export interface DraftValidationInput {
  description: string;
  platforms: SocialPlatformId[];
  durationSeconds: number | null;
  scheduleMode: ScheduleMode;
  triggerMinute: number;
  publishAt: EpochMs | null;
  /** Portada elegida (tipo y tamaño), o `null`. */
  cover: { mimeType: string; sizeBytes: number } | null;
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Plataforma afectada, o `null` si el problema es general. */
  platform: SocialPlatformId | null;
  message: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Ajustes                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** Tamaño general de la interfaz (escala todo el texto y los espacios). */
export type InterfaceSize = "compacto" | "normal" | "grande";

/** Nivel de animaciones: "completas" = todas; "reducidas" = sin movimientos grandes ni bucles. */
export type MotionLevel = "completas" | "reducidas";

/** Sección que se abre al entrar en la app. */
export type StartSection = "organizacion" | "estudio" | "ultima";

export interface AppSettings {
  interfaceSize: InterfaceSize;
  motion: MotionLevel;
  /** Mostrar el orbe 3D de la barra lateral (desactivarlo ahorra batería). */
  show3DOrb: boolean;
  startSection: StartSection;
  /** Barra lateral contraída al abrir en ordenador. */
  sidebarCollapsedByDefault: boolean;
  /** La guía de instalación ya se mostró (o el usuario la cerró). */
  installGuideSeen: boolean;
}

/** Uso del almacenamiento del navegador, en bytes. `null` si el navegador no lo informa. */
export interface StorageUsage {
  usedBytes: number | null;
  quotaBytes: number | null;
  notes: number;
  folders: number;
  attachments: number;
  attachmentsBytes: number;
  videos: number;
  videosBytes: number;
}

/** Resultado de una acción de datos (exportar, importar, borrar). */
export interface DataActionResult {
  ok: boolean;
  message: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Instalación como app (PWA)                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Dispositivo y navegador detectados, para dar las instrucciones correctas:
 * - "iphone-safari" / "ipad-safari": Compartir → «Añadir a pantalla de inicio».
 * - "iphone-otro": navegador de iPhone que no es Safari (pedir que abra en Safari).
 * - "mac-safari": Archivo → «Añadir al Dock» (Safari 17 o posterior).
 * - "escritorio-instalable": Chrome/Edge en Mac o Windows con instalación de un clic.
 * - "android-instalable": Chrome en Android con instalación de un clic.
 * - "otro": navegador sin instalación conocida.
 */
export type InstallPlatform =
  | "iphone-safari"
  | "ipad-safari"
  | "iphone-otro"
  | "mac-safari"
  | "escritorio-instalable"
  | "android-instalable"
  | "otro";

export interface InstallState {
  platform: InstallPlatform;
  /** Ya se está usando como app instalada (pantalla completa, sin barra del navegador). */
  isInstalled: boolean;
  /** El navegador ofrece instalar con un botón (Chrome/Edge/Android). */
  canPromptInstall: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Props de los componentes visuales                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Sidebar3DProps {
  activeSection: WorkspaceSection;
  onSectionChange: (section: WorkspaceSection) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Si es false, en lugar del orbe 3D se muestra un logotipo plano (sin WebGL). */
  show3DOrb: boolean;
  stats: {
    notes: number;
    folders: number;
    scheduledVideos: number;
    isLive: boolean;
  };
}

export interface NotionSectionProps {
  /** Árbol completo ya ordenado. */
  tree: WorkspaceTreeNode[];
  selectedNote: NoteItem | null;
  expandedFolderIds: Id[];
  saveStatus: SaveStatus;
  /** `false` hasta que IndexedDB termina de cargar; mostrar esqueleto mientras tanto. */
  ready: boolean;

  onSelectNote: (noteId: Id) => void;
  onToggleFolder: (folderId: Id) => void;
  onCreateNote: (parentId: Id | null) => void;
  onCreateFolder: (parentId: Id | null) => void;
  onRenameFolder: (folderId: Id, name: string) => void;
  /** Borra la nota o la carpeta (con todo su contenido). */
  onDeleteItem: (itemId: Id) => void;
  /** Mueve a otra carpeta (`null` = raíz). Ignora movimientos inválidos (una carpeta dentro de sí misma). */
  onMoveItem: (itemId: Id, targetFolderId: Id | null) => void;

  onUpdateTitle: (noteId: Id, title: string) => void;
  onUpdateIcon: (noteId: Id, icon: string | null) => void;
  onUpdateBlock: (noteId: Id, blockId: Id, patch: NoteBlockPatch) => void;
  /** Inserta un bloque después de `afterBlockId` (o al final si es `null`) y devuelve su id para enfocarlo. */
  onAddBlock: (noteId: Id, afterBlockId: Id | null, type: NoteBlockType) => Id;
  onDeleteBlock: (noteId: Id, blockId: Id) => void;

  onUploadFiles: (noteId: Id, files: File[]) => void;
  onDownloadAttachment: (noteId: Id, attachmentId: Id) => void;
  onDeleteAttachment: (noteId: Id, attachmentId: Id) => void;
}

export interface VideoStudioSectionProps {
  platforms: SocialPlatform[];
  onConnectPlatform: (platformId: SocialPlatformId, handle: string) => void;
  onDisconnectPlatform: (platformId: SocialPlatformId) => void;

  broadcast: BroadcastState;
  /** Minuto final que debe mostrar el timeline (≥ 60). */
  timelineMaxMinute: number;
  /** `false` hasta que IndexedDB termina de cargar. */
  ready: boolean;

  /** Menciones usadas antes, sin arroba, para el autocompletado. */
  mentionSuggestions: string[];
  /** Validación en vivo del formulario (límites de cada red). */
  validateDraft: (draft: DraftValidationInput) => ValidationIssue[];
  /**
   * Saca un fotograma del vídeo como imagen JPEG para usarlo de portada.
   * `atSeconds` es el segundo del vídeo. Resuelve `null` si no se pudo.
   */
  captureFrame: (video: Blob, atSeconds: number) => Promise<Blob | null>;
  /** Hora actual (ms). Úsala como mínimo del selector de fecha; se actualiza cada segundo. */
  now: EpochMs;
  /** Programa el vídeo. Resuelve con los problemas que impidieron hacerlo (array vacío = éxito). */
  onScheduleVideo: (input: NewScheduledVideoInput) => Promise<ValidationIssue[]>;
  onRemoveVideo: (videoId: Id) => void;
  /** Vuelve a `pending` un vídeo con error; solo reintenta las redes que fallaron. */
  onRetryVideo: (videoId: Id) => void;
  onUpdateTriggerMinute: (videoId: Id, minute: number) => void;
  /** Cambia cuándo se publica un vídeo pendiente (modo y minuto o fecha). */
  onUpdateSchedule: (videoId: Id, schedule: { scheduleMode: ScheduleMode; triggerMinute: number; publishAt: EpochMs | null }) => void;
  /** Activa o desactiva una red para un vídeo pendiente. */
  onTogglePlatform: (videoId: Id, platformId: SocialPlatformId, enabled: boolean) => void;
  /** Pone, cambia o quita (`null`) la portada de un vídeo pendiente. */
  onUpdateCover: (videoId: Id, cover: Blob | null, source: CoverSource | null) => void;
  /** Publica ya un vídeo pendiente (cambia su programación a "fecha" = ahora). */
  onPublishNow: (videoId: Id) => void;

  /** Inicia el directo desde 00:00:00. */
  onStartBroadcast: () => void;
  onStopBroadcast: () => void;
  /** Detiene y pone el reloj a 00:00:00 (no borra la cola). */
  onResetBroadcast: () => void;
}

export interface SettingsSectionProps {
  settings: AppSettings;
  /** Cambia uno o varios ajustes; se guardan solos. */
  onChange: (patch: Partial<AppSettings>) => void;
  /** Vuelve a los ajustes de fábrica (no borra notas ni vídeos). */
  onResetSettings: () => void;

  platforms: SocialPlatform[];

  install: InstallState;
  /** Abre la guía de instalación paso a paso. */
  onOpenInstallGuide: () => void;
  /** Instalación de un clic (solo si `install.canPromptInstall`). */
  onPromptInstall: () => void;

  /** Uso del almacenamiento; `null` mientras se calcula. */
  storage: StorageUsage | null;
  onRefreshStorage: () => void;
  /** Descarga una copia de seguridad (.json) con notas, adjuntos y ajustes. */
  onExportBackup: () => Promise<DataActionResult>;
  /** Restaura una copia de seguridad elegida por el usuario. */
  onImportBackup: (file: File) => Promise<DataActionResult>;
  /** Borra TODOS los datos (notas, adjuntos, vídeos, conexiones). Pedir doble confirmación en la interfaz. */
  onDeleteAllData: () => Promise<DataActionResult>;

  appVersion: string;
}

export interface InstallGuideProps {
  open: boolean;
  onClose: () => void;
  install: InstallState;
  /** Instalación de un clic (solo si `install.canPromptInstall`). */
  onPromptInstall: () => void;
}
