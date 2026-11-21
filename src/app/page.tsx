"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useIsClient, useMediaQuery } from "@/hooks/useMediaQuery";
import { useInstall } from "@/hooks/useInstall";
import { Sidebar3D } from "@/components/Sidebar3D";
import { NotionSection } from "@/components/NotionSection";
import { VideoStudioSection } from "@/components/VideoStudioSection";
import { SettingsSection } from "@/components/SettingsSection";
import { InstallGuide } from "@/components/InstallGuide";
import { useBroadcastEngine, useNow, usePersistence, useServiceWorker } from "@/hooks/useWorkspaceEngine";
import { captureVideoFrame } from "@/lib/media";
import { deleteAllData, exportBackup, getStorageUsage, importBackup } from "@/lib/backup";
import { timelineMaxMinute } from "@/lib/broadcast/clock";
import { buildTree, countItems } from "@/lib/notesTree";
import { APP_VERSION } from "@/lib/version";
import { useNotesStore } from "@/store/notesStore";
import { useSaveStatusStore } from "@/store/saveStatusStore";
import { initialSection, ROOT_FONT_SIZE, useSettingsStore } from "@/store/settingsStore";
import { useStudioStore } from "@/store/studioStore";
import type { Id, NoteItem, StorageUsage, WorkspaceSection } from "@/types/workspace";

const SECTION_TITLES: Record<WorkspaceSection, string> = {
  organizacion: "Organización",
  estudio: "Estudio de Vídeo",
  ajustes: "Ajustes",
};

export default function WorkspacePage() {
  usePersistence();
  useBroadcastEngine();
  useServiceWorker();

  /* ── Ajustes ──────────────────────────────────────────────────────────── */
  const settings = useSettingsStore((s) => s.settings);
  const lastSection = useSettingsStore((s) => s.lastSection);
  const settingsReady = useSettingsStore((s) => s.hydrated);
  const settingsActions = useSettingsStore.getState();

  // Tamaño de la interfaz: Tailwind usa rem, así que cambiar la letra raíz escala todo.
  useEffect(() => {
    document.documentElement.style.fontSize = ROOT_FONT_SIZE[settings.interfaceSize];
  }, [settings.interfaceSize]);

  /* ── Navegación y disposición ─────────────────────────────────────────── */
  const [sectionChoice, setSectionChoice] = useState<WorkspaceSection | null>(null);
  const section: WorkspaceSection = sectionChoice ?? (settingsReady ? initialSection(settings, lastSection) : "organizacion");
  const changeSection = useCallback((next: WorkspaceSection) => {
    setSectionChoice(next);
    useSettingsStore.getState().rememberSection(next);
  }, []);

  // Móvil: la barra lateral es un menú deslizante. Pantallas medianas: empieza contraída.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isCompact = useMediaQuery("(max-width: 1179px)");
  const isClient = useIsClient();
  const [collapsedChoice, setCollapsedChoice] = useState<boolean | null>(null);
  const collapsed = collapsedChoice ?? (settings.sidebarCollapsedByDefault || isCompact);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ── Instalación como app ─────────────────────────────────────────────── */
  const { install, promptInstall } = useInstall();
  const [guideRequested, setGuideRequested] = useState(false);
  // La primera vez se enseña sola (si se puede instalar y aún no lo está).
  const guideAuto = isClient && settingsReady && !settings.installGuideSeen && !install.isInstalled && install.platform !== "otro";
  const guideOpen = guideRequested || guideAuto;
  const closeGuide = useCallback(() => {
    setGuideRequested(false);
    useSettingsStore.getState().update({ installGuideSeen: true });
  }, []);

  /* ── Organización ─────────────────────────────────────────────────────── */
  const items = useNotesStore((s) => s.items);
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId);
  const expandedFolderIds = useNotesStore((s) => s.expandedFolderIds);
  const notesReady = useNotesStore((s) => s.hydrated);
  const saveStatus = useSaveStatusStore((s) => s.status);
  const notes = useNotesStore.getState();

  const tree = useMemo(() => buildTree(items), [items]);
  const counts = useMemo(() => countItems(items), [items]);
  const selected = selectedNoteId !== null ? items[selectedNoteId] : undefined;
  const selectedNote: NoteItem | null = selected?.kind === "note" ? selected : null;

  /* ── Estudio de vídeo ─────────────────────────────────────────────────── */
  const platforms = useStudioStore((s) => s.platforms);
  const broadcast = useStudioStore((s) => s.broadcast);
  const mentionHistory = useStudioStore((s) => s.mentionHistory);
  const studioReady = useStudioStore((s) => s.hydrated);
  const studio = useStudioStore.getState();

  const mentionSuggestions = useMemo(() => {
    const handles = platforms.flatMap((p) => (p.handle ? [p.handle.replace(/^@/, "").toLowerCase()] : []));
    return [...new Set([...mentionHistory, ...handles])];
  }, [platforms, mentionHistory]);

  const maxMinute = timelineMaxMinute(broadcast.queue, broadcast.elapsedSeconds);
  // Reloj para las cuentas atrás de la agenda (solo mientras se ve el Estudio).
  const now = useNow(section === "estudio");
  const scheduledVideos = broadcast.queue.filter((v) => v.status === "pending" || v.status === "uploading").length;

  /* ── Datos (Ajustes) ──────────────────────────────────────────────────── */
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const refreshStorage = useCallback(() => {
    void getStorageUsage().then(setStorage);
  }, []);

  const sidebarStats = { notes: counts.notes, folders: counts.folders, scheduledVideos, isLive: broadcast.isRunning };

  return (
    <MotionConfig reducedMotion={settings.motion === "reducidas" ? "always" : "user"}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#0A0A0F] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-zinc-100 md:flex-row md:pt-[env(safe-area-inset-top)]">
        {isMobile ? (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] bg-white/[0.02] px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
              <div className="flex h-14 w-full items-center gap-3">
                <button
                  type="button"
                  aria-label="Abrir menú"
                  aria-expanded={drawerOpen}
                  onClick={() => setDrawerOpen(true)}
                  className="grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-200 transition focus-visible:ring-2 focus-visible:ring-violet-400/60 focus-visible:outline-none active:scale-95"
                >
                  <Menu className="size-4" aria-hidden />
                </button>
                <span className="text-sm font-semibold">{SECTION_TITLES[section]}</span>
                {broadcast.isRunning && (
                  <span className="ml-auto flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-rose-300">
                    <span className="size-1.5 animate-pulse rounded-full bg-rose-400" />
                    EN DIRECTO
                  </span>
                )}
              </div>
            </header>
            <AnimatePresence>
              {drawerOpen && (
                <>
                  <motion.div
                    key="fondo"
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setDrawerOpen(false)}
                  />
                  <motion.div
                    key="menu"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Menú"
                    className="fixed inset-y-0 left-0 z-50 h-dvh bg-[#0A0A0F] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "spring", stiffness: 380, damping: 36 }}
                  >
                    <Sidebar3D
                      activeSection={section}
                      onSectionChange={(next) => {
                        changeSection(next);
                        setDrawerOpen(false);
                      }}
                      collapsed={false}
                      onToggleCollapsed={() => setDrawerOpen(false)}
                      show3DOrb={settings.show3DOrb}
                      stats={sidebarStats}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        ) : !isClient ? null : (
          // Se monta ya en el navegador, con el ancho correcto desde el primer fotograma
          // (si se renderizara en el servidor, en pantallas medianas se vería contraerse al cargar).
          <Sidebar3D
            activeSection={section}
            onSectionChange={changeSection}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsedChoice(!collapsed)}
            show3DOrb={settings.show3DOrb}
            stats={sidebarStats}
          />
        )}

        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              className="h-full w-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {section === "organizacion" && (
                <NotionSection
                  tree={tree}
                  selectedNote={selectedNote}
                  expandedFolderIds={expandedFolderIds}
                  saveStatus={saveStatus}
                  ready={notesReady}
                  onSelectNote={notes.selectNote}
                  onToggleFolder={notes.toggleFolder}
                  onCreateNote={(parentId: Id | null) => {
                    notes.createNote(parentId);
                  }}
                  onCreateFolder={(parentId: Id | null) => {
                    notes.createFolder(parentId);
                  }}
                  onRenameFolder={notes.renameFolder}
                  onDeleteItem={notes.deleteItem}
                  onMoveItem={notes.moveItem}
                  onUpdateTitle={notes.updateTitle}
                  onUpdateIcon={notes.updateIcon}
                  onUpdateBlock={notes.updateBlock}
                  onAddBlock={notes.addBlock}
                  onDeleteBlock={notes.deleteBlock}
                  onUploadFiles={(noteId, files) => {
                    void notes.uploadFiles(noteId, files);
                  }}
                  onDownloadAttachment={(noteId, attachmentId) => {
                    void notes.downloadAttachment(noteId, attachmentId);
                  }}
                  onDeleteAttachment={notes.deleteAttachment}
                />
              )}
              {section === "estudio" && (
                <VideoStudioSection
                  platforms={platforms}
                  onConnectPlatform={studio.connectPlatform}
                  onDisconnectPlatform={studio.disconnectPlatform}
                  broadcast={broadcast}
                  timelineMaxMinute={maxMinute}
                  ready={studioReady}
                  mentionSuggestions={mentionSuggestions}
                  validateDraft={studio.validateDraft}
                  onScheduleVideo={studio.scheduleVideo}
                  onRemoveVideo={studio.removeVideo}
                  onRetryVideo={studio.retryVideo}
                  onUpdateTriggerMinute={studio.updateTriggerMinute}
                  onUpdateSchedule={studio.updateSchedule}
                  onTogglePlatform={studio.togglePlatform}
                  onUpdateCover={(videoId, cover, source) => {
                    void studio.updateCover(videoId, cover, source);
                  }}
                  onPublishNow={studio.publishNow}
                  captureFrame={captureVideoFrame}
                  now={now}
                  onStartBroadcast={studio.startBroadcast}
                  onStopBroadcast={studio.stopBroadcast}
                  onResetBroadcast={studio.resetBroadcast}
                />
              )}
              {section === "ajustes" && (
                <SettingsSection
                  settings={settings}
                  onChange={settingsActions.update}
                  onResetSettings={settingsActions.reset}
                  platforms={platforms}
                  install={install}
                  onOpenInstallGuide={() => setGuideRequested(true)}
                  onPromptInstall={promptInstall}
                  storage={storage}
                  onRefreshStorage={refreshStorage}
                  onExportBackup={exportBackup}
                  onImportBackup={async (file) => {
                    const result = await importBackup(file);
                    refreshStorage();
                    return result;
                  }}
                  onDeleteAllData={deleteAllData}
                  appVersion={APP_VERSION}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <InstallGuide open={guideOpen} onClose={closeGuide} install={install} onPromptInstall={promptInstall} />
      </div>
    </MotionConfig>
  );
}
