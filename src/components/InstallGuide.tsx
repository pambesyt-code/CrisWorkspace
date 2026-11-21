"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown, ArrowDownToLine, BookOpen, ChevronLeft, ChevronRight, Compass,
  Copy, EllipsisVertical, Globe, LockKeyhole, MonitorDown, PanelsTopLeft, SquarePlus, X,
} from "lucide-react";
import type { InstallGuideProps } from "@/types/workspace";

const spring = { type: "spring", stiffness: 400, damping: 33 } as const;
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60";
const glass = "rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const chrome = "rounded-xl border border-white/15 bg-[#2b2c35] shadow-lg";
const blue = "text-[#0A84FF]";
const smallScreen = "(max-width: 639.98px)";

function subscribeScreen(update: () => void) {
  const query = window.matchMedia(smallScreen);
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}

const isSmallScreen = () => window.matchMedia(smallScreen).matches;
const serverScreen = () => false;

function AppIcon({ size = "size-[88px]" }: { size?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[25%] bg-[linear-gradient(145deg,#ab81ff_0%,#6653de_44%,#5048b5_60%,#ff947f_100%)] shadow-[inset_0_1px_2px_#ffffff80,0_5px_20px_#42359855] ${size}`}>
      <span className="size-[61%] rounded-full bg-[radial-gradient(ellipse_at_31%_23%,#fff_0%,#e5d6ff_8%,#b19aff_25%,#7662db_47%,#463a95_66%,#bd7baf_85%,#ffbd9e_100%)] shadow-[inset_-1px_-2px_3px_#ffd1c77a,2px_4px_7px_#24145366]" />
    </span>
  );
}

function Highlight({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <span className="relative inline-flex items-center justify-center rounded-lg bg-[#0A84FF]/15 px-2 py-1 text-[#79baff]">
      <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] border border-[#0A84FF]/70"
        animate={reduced === false ? { opacity: [0.8, 0.2, 0.8], scale: [1, 1.055, 1] } : { opacity: 0.65 }}
        transition={{ duration: 1.9, repeat: reduced === false ? Infinity : 0 }} />
      {children}
    </span>
  );
}

function SafariShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <path d="M8 8.5H5v13h14v-13h-3M12 15V2m-4 4 4-4 4 4" />
    </svg>
  );
}

function SafariBar({ ipad }: { ipad: boolean }) {
  return (
    <div className={`${chrome} flex w-full max-w-72 items-center justify-between gap-2 px-3 py-2 ${blue}`}>
      <ChevronLeft size={19} /><ChevronRight size={19} className="opacity-45" />
      {ipad ? <span className="min-w-0 flex-1 truncate rounded-md bg-white/10 px-2 py-1 text-center text-[11px] text-zinc-300">CrisWorkspace</span> : <Highlight><SafariShare /></Highlight>}
      <BookOpen size={18} />
      {ipad ? <Highlight><SafariShare /></Highlight> : <PanelsTopLeft size={18} />}
    </div>
  );
}

function Launcher({ dock = false }: { dock?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className={dock
      ? "flex items-end gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 shadow-lg"
      : "grid grid-cols-4 gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-linear-to-br from-[#494159] to-[#262532] px-4 py-3"}>
      {(dock ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6, 7]).map((slot) => slot === 2 ? (
        <motion.span key={slot} className="flex rounded-lg shadow-[0_0_14px_#a78bfa80]"
          animate={dock && reduced === false ? { y: [0, -4, 0] } : { y: 0 }}
          transition={{ duration: 0.65, repeat: dock && reduced === false ? Infinity : 0, repeatDelay: 1.2 }}>
          <AppIcon size={dock ? "size-8" : "size-6"} />
        </motion.span>
      ) : <span key={slot} className={`rounded-[25%] border border-white/10 bg-linear-to-br from-zinc-500 to-zinc-700 ${dock ? "size-8" : "size-6"}`} />)}
    </div>
  );
}

function Step({ number, title, children, note }: { number: number; title: string; children: ReactNode; note?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.li className={`${glass} overflow-hidden`}
      initial={reduced === false ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: reduced ? 0 : (number - 1) * 0.055 }}>
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-lg border border-violet-400/20 bg-violet-400/10 font-mono text-xs text-violet-200 tabular-nums">{number}</span>
        <div className="min-w-0">
          <p className="text-sm leading-6 font-medium">{title}</p>
          {note && <p className="mt-1 text-xs leading-5 text-zinc-400">{note}</p>}
        </div>
      </div>
      <div aria-hidden="true" className="mx-2 mb-2 flex min-h-[76px] items-center justify-center rounded-xl bg-[radial-gradient(ellipse_at_50%_100%,#312b43,#1a1922_78%)] px-3 py-3 text-xs">{children}</div>
    </motion.li>
  );
}

function IosSteps({ ipad = false }: { ipad?: boolean }) {
  return (
    <ol className="space-y-2.5">
      <Step number={1} title="Pulsa el botón Compartir" note={ipad ? "En el iPad está arriba a la derecha." : undefined}>
        <SafariBar ipad={ipad} />
      </Step>
      <Step number={2} title="Desliza y elige «Añadir a pantalla de inicio»">
        <div className={`${chrome} flex w-full max-w-72 items-center justify-between gap-2 px-3 py-2.5`}>
          Añadir a pantalla de inicio <Highlight><SquarePlus size={18} /></Highlight>
        </div>
      </Step>
      <Step number={3} title="Pulsa «Añadir» arriba a la derecha">
        <div className={`${chrome} flex w-full max-w-72 items-center justify-between gap-2 px-3 py-2`}>
          <span className="text-[#79baff]">Cancelar</span><span className="font-medium">Pantalla de inicio</span><Highlight>Añadir</Highlight>
        </div>
      </Step>
      <Step number={4} title="Abre CrisWorkspace desde tu pantalla de inicio"><Launcher /></Step>
    </ol>
  );
}

function MacSteps() {
  return (
    <>
      <ol className="space-y-2.5">
        <Step number={1} title="En la barra de menús, abre «Archivo»">
          <div className={`${chrome} flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 py-1.5`}>
            <b>Safari</b><Highlight>Archivo</Highlight><span>Edición</span><span>Visualización</span>
          </div>
        </Step>
        <Step number={2} title="Elige «Añadir al Dock…»">
          <div className={`${chrome} grid w-44 gap-1 p-1.5 text-left`}>
            <span className="px-2 text-zinc-400">Nueva ventana</span>
            <span className="my-0.5 border-t border-white/10" /><Highlight>Añadir al Dock…</Highlight>
          </div>
        </Step>
        <Step number={3} title="Pulsa «Añadir»">
          <div className={`${chrome} w-52 p-2.5`}>
            <span className="flex items-center gap-2 font-medium"><AppIcon size="size-7" /> CrisWorkspace</span>
            <div className="mt-2 flex items-center justify-end gap-3"><span className="text-zinc-400">Cancelar</span><Highlight>Añadir</Highlight></div>
          </div>
        </Step>
        <Step number={4} title="Ábrela desde el Dock o el Launchpad"><Launcher dock /></Step>
      </ol>
      <p className="mt-3 px-1 text-xs leading-5 text-zinc-400">Necesitas macOS Sonoma (14) o posterior. También puedes usar el botón Compartir → «Añadir al Dock».</p>
    </>
  );
}

function Action({ children, onClick, primary = false }: { children: ReactNode; onClick: () => void; primary?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.button type="button" onClick={onClick} whileHover={reduced ? undefined : { scale: 1.02 }}
      whileTap={reduced ? undefined : { scale: 0.97 }} transition={spring}
      className={`${focus} inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${primary ? "border-violet-400/35 bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-md" : "border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.08]"}`}>
      {children}
    </motion.button>
  );
}

function OpenInSafari() {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }
  return (
    <div className={`${glass} p-4`}>
      <Compass aria-hidden="true" className="mb-3 text-[#69b0ff]" size={30} />
      <h3 className="font-semibold">Abre esta página en Safari</h3>
      <p className="mt-1 mb-4 text-sm leading-5 text-zinc-400">En el iPhone, las apps web se añaden desde Safari. Copia el enlace y pégalo en su barra de direcciones.</p>
      <Action onClick={copyLink}><Copy aria-hidden="true" size={16} /><span aria-live="polite">{feedback === "copied" ? "¡Copiado!" : "Copiar enlace"}</span></Action>
      {feedback === "failed" && <p role="status" className="mt-2 text-xs text-amber-200">Copia el enlace desde la barra de direcciones.</p>}
      <details className="mt-3">
        <summary className={`${focus} cursor-pointer rounded-lg py-2.5 text-sm font-medium text-violet-300`}>Ver los pasos</summary>
        <IosSteps />
      </details>
    </div>
  );
}

function PlatformGuide({ install, onClose, onPromptInstall }: Omit<InstallGuideProps, "open">) {
  const reduced = useReducedMotion();
  if (install.isInstalled) {
    return (
      <div role="status" className={`${glass} flex flex-col items-center gap-3 p-5 text-center`}>
        <svg aria-hidden="true" viewBox="0 0 32 32" className="size-12 rounded-full border border-emerald-300/30 bg-emerald-400/10 p-2 text-emerald-300">
          <motion.path d="m6 16 7 7L26 9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"
            initial={reduced === false ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.28 }} />
        </svg>
        <h3 className="font-semibold">Ya la tienes instalada 🎉</h3>
      </div>
    );
  }
  switch (install.platform) {
    case "iphone-safari":
    case "ipad-safari":
      return <IosSteps ipad={install.platform === "ipad-safari"} />;
    case "iphone-otro":
      return <OpenInSafari />;
    case "mac-safari":
      return <MacSteps />;
    case "escritorio-instalable":
    case "android-instalable": {
      const android = install.platform === "android-instalable";
      return (
        <div className="space-y-3">
          {install.canPromptInstall && <Action primary onClick={onPromptInstall}><ArrowDownToLine aria-hidden="true" size={18} />Instalar ahora</Action>}
          <ol>
            <Step number={1} title={android ? "Menú ⋮ → «Instalar aplicación»" : "Pulsa el icono de instalar en la barra de direcciones"}>
              {android ? (
                <div className={`${chrome} flex items-center gap-3 px-3 py-2`}><EllipsisVertical size={16} /><Highlight>Instalar aplicación</Highlight></div>
              ) : (
                <div className={`${chrome} flex w-full max-w-72 items-center gap-2 px-3 py-1.5`}>
                  <LockKeyhole size={13} className="text-zinc-400" /><span className="flex-1 text-zinc-300">CrisWorkspace</span><Highlight><MonitorDown size={19} /></Highlight>
                </div>
              )}
            </Step>
          </ol>
        </div>
      );
    }
    case "otro":
      return (
        <div className={`${glass} space-y-3 p-4`}>
          <Globe aria-hidden="true" className="text-violet-300" size={28} />
          <p className="text-sm leading-6">Tu navegador no permite instalar apps web. Usa Safari en iPhone o Mac, o Chrome/Edge en ordenador.</p>
          <Action onClick={onClose}>Continuar en el navegador</Action>
        </div>
      );
  }
}

function GuideDialog({ install, onClose, onPromptInstall }: Omit<InstallGuideProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduced = useReducedMotion();
  const mobile = useSyncExternalStore(subscribeScreen, isSmallScreen, serverScreen);
  const hint = install.platform === "iphone-safari" && !install.isInstalled;
  const offset = reduced !== false ? {} : mobile ? { y: "100%" } : { scale: 0.94 };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    dialog.showModal();
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    dialog?.addEventListener("keydown", handleKey);
    return () => dialog?.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <motion.dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] m-0 h-full max-h-none w-full max-w-none overflow-hidden overscroll-none border-0 bg-black/70 p-0 text-zinc-100 backdrop-blur-md backdrop:bg-transparent">
      <div className="flex h-full w-full items-end justify-center sm:items-center sm:p-4"
        onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <motion.div ref={panelRef} tabIndex={-1} initial={offset} animate={{ y: 0, scale: 1 }} exit={offset} transition={spring}
          className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111117] shadow-[inset_0_1px_0_#ffffff12,0_24px_90px_#0009] outline-none sm:max-w-md sm:rounded-2xl ${hint ? "pb-[calc(3.25rem+env(safe-area-inset-bottom))] sm:mb-9 sm:max-h-[calc(100dvh-5rem)] sm:pb-0" : "pb-[env(safe-area-inset-bottom)] sm:pb-0"}`}>
          <span aria-hidden="true" className="absolute top-2.5 left-1/2 z-10 h-1 w-9 -translate-x-1/2 rounded-full bg-white/25 sm:hidden" />
          <motion.button type="button" aria-label="Cerrar" onClick={onClose} whileTap={reduced ? undefined : { scale: 0.97 }} transition={spring}
            className={`${focus} absolute top-3 right-3 z-10 grid size-11 place-items-center rounded-full text-zinc-300 hover:text-white`}>
            <span className="grid size-8 place-items-center rounded-full border border-white/10 bg-[#292830]"><X size={16} /></span>
          </motion.button>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6">
            <header className="relative isolate flex flex-col items-center pt-8 pb-5 text-center sm:pt-7">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_20%,#8b5cf626,transparent_65%)]" />
              <AppIcon />
              <h2 id={titleId} className="mt-4 text-[26px] leading-tight font-semibold tracking-tight">Instala CrisWorkspace</h2>
              <p className="mt-2 max-w-80 text-sm leading-[1.5] text-zinc-400">Gratis, sin App Store. Tendrás su icono, pantalla completa y funcionará sin conexión.</p>
            </header>
            <PlatformGuide install={install} onClose={onClose} onPromptInstall={onPromptInstall} />
            <footer className="mt-5 space-y-2.5 text-center">
              <Action onClick={onClose}>Ahora no</Action>
              <p className="text-xs leading-5 text-zinc-400">Puedes volver a ver esta guía en Ajustes → Aplicación.</p>
            </footer>
          </div>
        </motion.div>
      </div>
      {hint && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(0.45rem+env(safe-area-inset-bottom))] flex flex-col items-center gap-0.5 text-xs font-medium text-violet-200">
          <span>Compartir está aquí abajo</span>
          <motion.span aria-hidden="true" animate={reduced === false ? { y: [0, 4, 0] } : { y: 0 }}
            transition={{ duration: 1, repeat: reduced === false ? Infinity : 0 }}><ArrowDown size={19} /></motion.span>
        </div>
      )}
    </motion.dialog>
  );
}

export function InstallGuide({ open, install, onClose, onPromptInstall }: InstallGuideProps) {
  return (
    <AnimatePresence>
      {open && <GuideDialog key="install-guide" install={install} onClose={onClose} onPromptInstall={onPromptInstall} />}
    </AnimatePresence>
  );
}

export default InstallGuide;
