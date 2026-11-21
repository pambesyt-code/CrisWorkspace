"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  AppWindow, Check, CircleAlert, CircleCheck, Clapperboard, Database, Download,
  History, House, Info, LoaderCircle, Monitor, NotebookPen, RefreshCw, RotateCcw,
  Settings, Share2, SlidersHorizontal, Trash2, Upload, type LucideIcon,
} from "lucide-react";
import type {
  DataActionResult, InstallPlatform, InterfaceSize, MotionLevel, SettingsSectionProps,
  StartSection, StorageUsage,
} from "@/types/workspace";

const sections = [
  { id: "apariencia", title: "Apariencia", description: "Ajusta la escala y el movimiento de tu espacio.", icon: SlidersHorizontal },
  { id: "inicio", title: "Inicio", description: "Elige cómo te recibe CrisWorkspace.", icon: House },
  { id: "aplicacion", title: "Aplicación", description: "Accede a tu espacio desde la pantalla de inicio.", icon: AppWindow },
  { id: "redes", title: "Redes", description: "Consulta las cuentas de tu Estudio de Vídeo.", icon: Share2 },
  { id: "datos", title: "Datos", description: "Consulta el almacenamiento y gestiona tus copias.", icon: Database },
  { id: "acerca", title: "Acerca de", description: "Información sobre tu aplicación.", icon: Info },
] as const;
type Section = (typeof sections)[number];

const devices: Record<InstallPlatform, string> = {
  "iphone-safari": "iPhone · Safari",
  "ipad-safari": "iPad · Safari",
  "iphone-otro": "iPhone · Otro navegador",
  "mac-safari": "Mac · Safari",
  "escritorio-instalable": "Ordenador · Chrome o Edge",
  "android-instalable": "Android",
  otro: "Otro navegador",
};
const sizes: { value: InterfaceSize; label: string; scale: number }[] = [
  { value: "compacto", label: "Compacto", scale: 0.8 },
  { value: "normal", label: "Normal", scale: 1 },
  { value: "grande", label: "Grande", scale: 1.2 },
];
const levels: { value: MotionLevel; label: string }[] = [
  { value: "completas", label: "Completas" }, { value: "reducidas", label: "Reducidas" },
];
const starts: { value: StartSection; label: string; icon: LucideIcon; color: string }[] = [
  { value: "organizacion", label: "Organización", icon: NotebookPen, color: "#A78BFA" },
  { value: "estudio", label: "Estudio de Vídeo", icon: Clapperboard, color: "#FB7185" },
  { value: "ultima", label: "Donde lo dejé", icon: History, color: "#2DD4BF" },
];
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101519]";
const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const labelStyle = "mb-3 text-sm font-semibold text-zinc-200";
const tileGrid = "grid grid-cols-2 gap-2.5 @min-[32rem]:grid-cols-3";
const sphere = "bg-[radial-gradient(circle_at_32%_25%,#dcfffa_0%,#5eead4_16%,#168b91_45%,#103b4b_70%,#07141e_100%)]";

function AppIcon() {
  return (
    <span aria-hidden="true" className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-teal-200/20 bg-linear-to-br from-[#245c61] via-[#102a31] to-[#091015] shadow-[inset_0_1px_1px_#99f6e433]">
      <span className={`size-8 rounded-full shadow-[0_4px_15px_#2dd4bf33] ${sphere}`} />
      <span className="absolute h-4 w-11 -rotate-35 rounded-[50%] border border-teal-100/55" />
    </span>
  );
}

function Card({ section, children, still }: { section: Section; children: ReactNode; still: boolean }) {
  const Icon = section.icon;
  return (
    <motion.section id={`ajustes-${section.id}`} data-settings-section={section.id} aria-labelledby={`titulo-${section.id}`}
      initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: still ? 0 : 0.2, delay: still ? 0 : sections.indexOf(section) * 0.035 }}
      className="scroll-mt-20 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl @min-[32rem]:p-6">
      <header className="mb-5 flex items-center gap-3 border-b border-white/[0.07] pb-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal-300/15 bg-teal-300/[0.07] text-teal-300"><Icon size={20} aria-hidden="true" /></span>
        <div><h2 id={`titulo-${section.id}`} className="text-xl font-semibold tracking-tight">{section.title}</h2>
          <p className="mt-0.5 text-sm text-zinc-400">{section.description}</p></div>
      </header>
      {children}
    </motion.section>
  );
}

function Choice({ label, current, select, children }: { label: string; current: boolean; select: () => void; children: ReactNode }) {
  return (
    <motion.button type="button" aria-pressed={current} onClick={select}
      animate={{ scale: current ? 1.008 : 1 }} whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.97 }}
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-xl border text-left ${focus} ${current
        ? "border-teal-300/65 bg-teal-300/[0.06] ring-1 ring-inset ring-teal-300/20"
        : "border-white/10 bg-white/[0.025] hover:border-white/25"}`}>
      <span aria-hidden="true" className="relative grid h-[4.6rem] w-full place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.07),transparent_72%)]">{children}</span>
      <span className="w-full border-t border-white/[0.06] px-3 py-2.5 text-sm font-medium">{label}</span>
      <span aria-hidden="true" className={`absolute right-2 top-2 grid size-4 place-items-center rounded-full border ${current ? "border-teal-300 bg-teal-300 text-zinc-950" : "border-white/20 bg-zinc-950/50"}`}>
        {current && <Check size={11} strokeWidth={3} />}
      </span>
    </motion.button>
  );
}

function MiniWindow({ scale }: { scale: number }) {
  return (
    <span style={{ transform: `scale(${scale})` }} className="flex h-11 w-20 overflow-hidden rounded-[5px] border border-teal-100/25 bg-[#19232a] shadow-md">
      <span className="flex w-4 flex-col items-center gap-1 border-r border-white/10 bg-teal-100/[0.05] pt-2">
        <span className="size-1.5 rounded-full bg-teal-300/80" /><span className="h-0.5 w-1.5 bg-white/25" /><span className="h-0.5 w-1.5 bg-white/25" />
      </span>
      <span className="flex flex-col justify-center gap-1 pl-2"><span className="text-base leading-none font-semibold tracking-tight text-teal-50">Aa</span>
        <span className="h-0.5 w-9 bg-white/30" /><span className="h-0.5 w-6 bg-white/15" /></span>
    </span>
  );
}

function SwitchRow({ label, hint, checked, toggle, children }: { label: string; hint?: string; checked: boolean; toggle: () => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={toggle}
      className={`flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-left hover:bg-white/[0.05] ${focus}`}>
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-black/20">{children}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{hint}</span>}</span>
      <span aria-hidden="true" className={`flex h-6 w-11 shrink-0 items-center rounded-full p-1 ${checked ? "bg-teal-400" : "bg-zinc-700"}`}>
        <motion.span initial={false} animate={{ x: checked ? 20 : 0 }} className="size-4 rounded-full bg-zinc-50 shadow-sm" />
      </span>
    </button>
  );
}

const numberFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB"];
  const index = value > 0 ? Math.min(3, Math.max(0, Math.floor(Math.log(value) / Math.log(1024)))) : 0;
  return `${numberFormat.format(value / 1024 ** index)} ${units[index]}`;
}

function StorageMeter({ storage, still }: { storage: StorageUsage | null; still: boolean }) {
  if (!storage) {
    return <div role="status" className="space-y-3"><span className="sr-only">Calculando el espacio usado…</span>
      <div className={`h-4 rounded-full bg-linear-to-r from-zinc-800 via-zinc-700 to-zinc-800 ${still ? "" : "motion-safe:animate-pulse"}`} />
      <div className="h-3 w-2/3 rounded bg-white/5" /></div>;
  }
  const used = Math.max(storage.usedBytes ?? 0, storage.attachmentsBytes + storage.videosBytes);
  const segments = [
    { label: "Notas y adjuntos", value: used - storage.videosBytes, color: "bg-violet-400" },
    { label: "Vídeos", value: storage.videosBytes, color: "bg-rose-400" },
  ];
  if (storage.quotaBytes !== null) {
    segments.push({ label: "Libre", value: Math.max(0, storage.quotaBytes - used), color: "bg-zinc-600" });
  }
  const count = (n: number, singular: string) => `${numberFormat.format(n)} ${singular}${n === 1 ? "" : "s"}`;
  return (
    <div>
      <p className="mb-3 font-mono text-xl font-semibold tabular-nums">{bytes(used)}
        {storage.quotaBytes !== null && <span className="ml-2 text-xs font-normal text-zinc-400">de {bytes(storage.quotaBytes)}</span>}</p>
      <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-zinc-900">
        {segments.map(segment => <span key={segment.label} style={{ flexGrow: segment.value }} className={segment.color} />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-300">
        {segments.map(segment => <li key={segment.label} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${segment.color}`} />{segment.label}<span className="font-mono tabular-nums">{bytes(segment.value)}</span>
        </li>)}
      </ul>
      <p className="mt-3 text-xs text-zinc-400 tabular-nums">{[count(storage.notes, "nota"), count(storage.folders, "carpeta"), count(storage.attachments, "adjunto"), count(storage.videos, "vídeo")].join(" · ")}</p>
    </div>
  );
}

const actions = [
  { id: "exportar", label: "Exportar copia de seguridad", icon: Download },
  { id: "importar", label: "Importar copia", icon: Upload },
  { id: "borrar", label: "Borrar todos los datos", icon: Trash2 },
] as const;
type DataAction = (typeof actions)[number]["id"];

function DataControls({ onExportBackup, onImportBackup, onDeleteAllData, still }: Pick<SettingsSectionProps, "onExportBackup" | "onImportBackup" | "onDeleteAllData"> & { still: boolean }) {
  const [busy, setBusy] = useState<DataAction | null>(null);
  const [result, setResult] = useState<DataActionResult | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const actionLock = useRef(false);
  const deleteId = useId();

  async function run(id: DataAction, callback: () => Promise<DataActionResult>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(id);
    setResult(null);
    try {
      const response = await callback();
      setResult(response);
      if (id === "borrar" && response.ok) {
        setDeleting(false);
        setConfirmation("");
      }
    } catch {
      setResult({ ok: false, message: "No se ha podido completar la operación. Vuelve a intentarlo." });
    } finally {
      actionLock.current = false;
      setBusy(null);
    }
  }

  function chooseAction(id: DataAction) {
    if (id === "exportar") {
      void run(id, onExportBackup);
    } else if (id === "importar") {
      fileInput.current?.click();
    } else {
      setConfirmation("");
      setDeleting(!deleting);
    }
  }

  return (
    <div className="mt-5 border-t border-white/[0.08] pt-5">
      <input ref={fileInput} hidden type="file" accept="application/json,.json" aria-label="Seleccionar una copia de seguridad" onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file && window.confirm("Se sustituirán tus notas y ajustes actuales por los de la copia. ¿Continuar?")) {
          void run("importar", () => onImportBackup(file));
        }
      }} />
      <div className="grid gap-2.5 @min-[32rem]:grid-cols-3">
        {actions.map(({ id, label, icon: Icon }) => (
          <motion.button key={id} type="button" disabled={busy !== null} aria-busy={busy === id}
            aria-expanded={id === "borrar" ? deleting : undefined} aria-controls={id === "borrar" && deleting ? deleteId : undefined}
            onClick={() => chooseAction(id)} whileHover={busy ? undefined : { y: -2, scale: 1.02 }} whileTap={busy ? undefined : { scale: 0.97 }}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium disabled:opacity-60 @min-[32rem]:flex-col @min-[32rem]:items-start ${focus} ${id === "borrar" ? "border-red-400/20 bg-red-400/[0.035] text-red-300" : "border-white/10 bg-white/[0.03] text-zinc-200"}`}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${id === "borrar" ? "bg-red-400/10" : "bg-teal-300/[0.07] text-teal-300"}`}>
              {busy === id ? <LoaderCircle aria-hidden="true" size={18} className={still ? "" : "motion-safe:animate-spin"} /> : <Icon size={18} aria-hidden="true" />}
            </span>{label}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {deleting && <motion.form id={deleteId} key="confirmar" initial={{ opacity: 0, y: still ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : 0.18 }}
          className="mt-3 rounded-xl border border-red-400/25 bg-red-400/[0.045] p-4"
          onSubmit={event => { event.preventDefault(); if (confirmation === "BORRAR") void run("borrar", onDeleteAllData); }}>
          <p className="text-sm font-semibold text-red-200">Se eliminarán tus notas, adjuntos, vídeos y conexiones.</p>
          <label className="mt-3 block text-sm text-zinc-300">Escribe <strong className="font-mono">BORRAR</strong> para confirmar.
            <input value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy !== null} autoComplete="off" spellCheck={false}
              className={`mt-2 block w-full rounded-lg border border-red-300/20 bg-zinc-950/60 px-3 py-2 font-mono text-zinc-100 ${focus}`} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={confirmation !== "BORRAR" || busy !== null} className={`rounded-lg bg-red-400 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-35 ${focus}`}>Borrar definitivamente</button>
            <button type="button" disabled={busy !== null} onClick={() => { setDeleting(false); setConfirmation(""); }}
              className={`rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 ${focus}`}>Cancelar</button>
          </div>
        </motion.form>}
      </AnimatePresence>
      <div role="status" aria-live="polite" aria-atomic="true">
        {result && <p className={`mt-3 flex items-center gap-2 rounded-xl border p-3 text-sm ${result.ok ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-red-400/20 bg-red-400/5 text-red-300"}`}>
          {result.ok ? <CircleCheck size={17} className="shrink-0" /> : <CircleAlert size={17} className="shrink-0" />}{result.message}
        </p>}
      </div>
    </div>
  );
}

export function SettingsSection(props: SettingsSectionProps) {
  const { settings, onChange, onRefreshStorage, platforms, install } = props;
  const systemReduced = useReducedMotion();
  const still = Boolean(systemReduced) || settings.motion === "reducidas";
  const root = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const requestedStorage = useRef(false);
  const [active, setActive] = useState<Section["id"]>("apariencia");

  useEffect(() => {
    if (!requestedStorage.current) {
      requestedStorage.current = true;
      onRefreshStorage();
    }
  }, [onRefreshStorage]);

  useEffect(() => {
    const container = root.current;
    const navigation = nav.current;
    if (!container || !navigation) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-settings-section]"));
    const end = container.querySelector<HTMLElement>("[data-settings-end]");
    function trackSection() {
      if (!container || !navigation) return;
      const atEnd = container.scrollTop > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
      const line = navigation.getBoundingClientRect().bottom + 18;
      const index = cards.filter(card => card.getBoundingClientRect().top <= line).length - 1;
      setActive(atEnd ? "acerca" : sections[Math.max(0, index)].id);
    }
    const observer = new IntersectionObserver(trackSection, { root: container, rootMargin: "-64px 0px -1px 0px", threshold: [0, 0.5, 1] });
    cards.forEach(card => observer.observe(card));
    if (end) observer.observe(end);
    // Keep the highlight aligned with the sticky bar even inside very tall cards.
    container.addEventListener("scroll", trackSection, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", trackSection);
    };
  }, []);

  useEffect(() => {
    const strip = nav.current;
    const pill = strip?.querySelector<HTMLElement>(`[data-pill="${active}"]`);
    if (!strip || !pill) return;
    const bounds = strip.getBoundingClientRect();
    const item = pill.getBoundingClientRect();
    const delta = item.left < bounds.left ? item.left - bounds.left - 5 : Math.max(0, item.right - bounds.right + 5);
    if (delta) strip.scrollBy({ left: delta, behavior: still ? "instant" : "smooth" });
  }, [active, still]);

  function jump(id: Section["id"]) {
    const container = root.current;
    const card = container?.querySelector<HTMLElement>(`#ajustes-${id}`);
    if (!container || !card || !nav.current) return;
    const top = container.scrollTop + card.getBoundingClientRect().top - container.getBoundingClientRect().top - nav.current.offsetHeight - 12;
    container.scrollTo({ top, behavior: still ? "instant" : "smooth" });
  }

  return (
    <MotionConfig reducedMotion={still ? "always" : "user"} transition={still ? { duration: 0 } : spring}>
      <div ref={root} className="@container h-full w-full overflow-y-auto bg-[#0A0A0F] text-zinc-100">
        <div className="mx-auto w-full max-w-[960px] px-4 pt-5 pb-8 @min-[36rem]:px-8 @min-[36rem]:pt-8">
          <header className="relative isolate flex min-h-28 items-center gap-4 overflow-hidden rounded-2xl border border-teal-200/10 bg-linear-to-r from-[#12252a] via-[#102024] to-[#0c161b] px-4 py-6 @min-[32rem]:px-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-1/3 overflow-hidden opacity-65 [mask-image:linear-gradient(to_right,transparent,black_45%)]">
              {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="absolute -top-12 -right-5 h-52 w-32 rotate-45 rounded-[50%] border border-teal-200/20" style={{ transform: `translateX(${-13 * i}px)` }} />)}
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-teal-200/25 bg-linear-to-br from-teal-300/25 to-cyan-500/10 text-teal-200 shadow-[0_0_30px_#2dd4bf18,inset_0_1px_0_#ffffff22]"><Settings aria-hidden="true" size={26} /></span>
            <div><h1 className="text-3xl font-semibold tracking-tight @min-[32rem]:text-4xl">Ajustes</h1>
              <p className="mt-1 text-sm text-zinc-300">Personaliza CrisWorkspace a tu manera</p></div>
          </header>
          <nav ref={nav} aria-label="Secciones de ajustes" className="sticky top-0 z-20 my-3 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#101317]/95 p-1.5 shadow-lg backdrop-blur-xl">
            {sections.map(({ id, title, icon: Icon }) => <button key={id} type="button" data-pill={id} aria-current={active === id ? "location" : undefined} aria-controls={`ajustes-${id}`} onClick={() => jump(id)}
              className={`flex shrink-0 grow items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap ${focus} ${active === id ? "bg-teal-300/15 text-teal-200 ring-1 ring-inset ring-teal-200/20" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"}`}>
              <Icon size={14} aria-hidden="true" />{title}</button>)}
          </nav>
          <div className="space-y-4">
            <Card section={sections[0]} still={still}>
              <fieldset><legend className={labelStyle}>Tamaño de la interfaz</legend>
                <div className={tileGrid}>{sizes.map(({ value, label, scale }) => <Choice key={value} label={label} current={settings.interfaceSize === value} select={() => onChange({ interfaceSize: value })}><MiniWindow scale={scale} /></Choice>)}</div>
              </fieldset>
              <fieldset className="mt-5"><legend className={labelStyle}>Animaciones</legend>
                <div className="grid grid-cols-2 gap-2.5">{levels.map(({ value, label }) => (
                  <Choice key={value} label={label} current={settings.motion === value} select={() => onChange({ motion: value })}>
                    <span className="relative grid h-6 w-16 -rotate-12 place-items-center rounded-[50%] border border-dashed border-teal-300/30">
                      <motion.span initial={false} animate={value === "completas" && !still ? { x: [-23, 0, 23, 0, -23], y: [0, -11, 0, 11, 0] } : { x: 0, y: 0 }}
                        transition={value === "completas" && !still ? { duration: 2.8, ease: "linear", repeat: Infinity } : { duration: 0 }}
                        className="size-3 rounded-full bg-teal-200 shadow-[0_0_12px_#2dd4bf66]" />
                    </span>
                  </Choice>
                ))}</div>
              </fieldset>
              <div className="mt-5"><SwitchRow label="Orbe 3D" hint="Muestra el orbe animado en la barra lateral. Desactívalo para ahorrar batería." checked={settings.show3DOrb} toggle={() => onChange({ show3DOrb: !settings.show3DOrb })}>
                <span className={`size-7 rounded-full ${sphere} ${settings.show3DOrb ? "shadow-[0_0_14px_#2dd4bf33]" : "grayscale"}`} />
              </SwitchRow></div>
            </Card>
            <Card section={sections[1]} still={still}>
              <fieldset><legend className={labelStyle}>Al abrir la app, empezar en</legend>
                <div className={tileGrid}>{starts.map(({ value, label, icon: Icon, color }) => (
                  <Choice key={value} label={label} current={settings.startSection === value} select={() => onChange({ startSection: value })}>
                    <span style={{ color, backgroundColor: color + "12", borderColor: color + "45" }} className="relative grid size-11 -rotate-6 place-items-center rounded-xl border shadow-md">
                      <Icon size={24} strokeWidth={1.6} /></span>
                  </Choice>
                ))}</div>
              </fieldset>
              <div className="mt-5"><SwitchRow label="Barra lateral contraída al empezar (en ordenador)" checked={settings.sidebarCollapsedByDefault} toggle={() => onChange({ sidebarCollapsedByDefault: !settings.sidebarCollapsedByDefault })}>
                <span className="relative h-6 w-8 overflow-hidden rounded border border-teal-100/30 bg-teal-100/5">
                  <motion.span initial={false} animate={{ scaleX: settings.sidebarCollapsedByDefault ? 0.45 : 1 }} className="absolute inset-y-0 left-0 w-3 origin-left border-r border-teal-200/50 bg-teal-300/35" />
                  <span className="absolute top-1.5 right-1 h-0.5 w-3 bg-zinc-500" /><span className="absolute top-3 right-2 h-0.5 w-2 bg-zinc-600" />
                </span>
              </SwitchRow></div>
            </Card>
            <Card section={sections[2]} still={still}>
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-teal-200/10 bg-linear-to-br from-teal-300/[0.06] to-transparent p-4">
                <AppIcon />
                <div className="min-w-[min(100%,12rem)] flex-1">
                  {install.isInstalled ? <p className="flex items-center gap-2 font-semibold text-emerald-300"><CircleCheck size={20} className="shrink-0" />CrisWorkspace está instalada en este dispositivo</p> :
                    <p className="text-sm leading-relaxed text-zinc-200">Úsala como una app de verdad: icono propio, pantalla completa y funciona sin conexión. Es gratis y no necesita la App Store.</p>}
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400"><Monitor size={14} />{devices[install.platform]}</p>
                </div>
              </div>
              {!install.isInstalled && <div className="mt-4 flex flex-wrap gap-2">
                {install.canPromptInstall && <button type="button" onClick={props.onPromptInstall} className={`flex items-center gap-2 rounded-xl bg-linear-to-r from-teal-400 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:brightness-110 ${focus}`}><Download size={16} />Instalar ahora</button>}
                <button type="button" onClick={props.onOpenInstallGuide} className={`rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium hover:bg-white/10 ${focus}`}>Ver cómo instalarla</button>
              </div>}
            </Card>
            <Card section={sections[3]} still={still}>
              {platforms.length > 0 ? <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2.5">
                {platforms.map(platform => <li key={platform.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                  <span aria-hidden="true" style={{ backgroundColor: platform.brandColor }} className="size-3 shrink-0 rounded-full ring-4 ring-white/5" />
                  <span className="min-w-0"><span className="block text-sm font-semibold">{platform.displayName}</span>
                    <span className={`block text-xs break-all ${platform.connected ? "text-emerald-300" : "text-zinc-400"}`}>
                      {platform.connected ? (platform.handle ? `Conectada como @${platform.handle.replace(/^@+/, "")}` : "Conectada") : "Sin conectar"}
                    </span></span>
                </li>)}
              </ul> : <p className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-400"><Share2 size={17} />Aún no hay redes disponibles.</p>}
              <p className="mt-4 text-sm text-zinc-400">Gestiona las conexiones desde el Estudio de Vídeo.</p>
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-300/[0.05] p-3 text-xs leading-relaxed text-amber-200"><Info size={15} className="mt-px shrink-0" />Las publicaciones están en modo simulación hasta conectar las cuentas reales.</p>
            </Card>
            <Card section={sections[4]} still={still}>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Espacio usado</h3>
                <button type="button" onClick={onRefreshStorage} aria-label="Actualizar espacio usado" title="Actualizar" className={`grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-teal-200 ${focus}`}><RefreshCw size={16} /></button></div>
              <StorageMeter storage={props.storage} still={still} />
              <DataControls onExportBackup={props.onExportBackup} onImportBackup={props.onImportBackup} onDeleteAllData={props.onDeleteAllData} still={still} />
            </Card>
            <Card section={sections[5]} still={still}>
              <div className="flex items-center gap-4"><AppIcon /><div><p className="text-lg font-semibold tracking-tight">CrisWorkspace</p>
                <p className="mt-1 font-mono text-xs text-teal-200 tabular-nums">Versión {props.appVersion}</p></div></div>
              <p className="mt-4 text-sm text-zinc-300">Hecho con Next.js, React Three Fiber y Framer Motion</p>
              <p className="mt-1 text-sm text-zinc-400">Tus datos se guardan solo en este dispositivo.</p>
              <button type="button" onClick={() => {
                if (window.confirm("¿Volver a los ajustes de fábrica? Tus notas y vídeos no se borran.")) props.onResetSettings();
              }} className={`mt-3 inline-flex items-center gap-1.5 rounded py-1.5 text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline ${focus}`}><RotateCcw size={13} />Restablecer ajustes</button>
            </Card>
          </div>
          <div data-settings-end aria-hidden="true" className="h-px" />
        </div>
      </div>
    </MotionConfig>
  );
}

export default SettingsSection;
