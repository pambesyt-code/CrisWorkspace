"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import type {
  CoverSource, DraftValidationInput, NewScheduledVideoInput, ScheduledVideo, ScheduledVideoStatus, ScheduleMode,
  SocialPlatform, SocialPlatformId, ValidationIssue, VideoStudioSectionProps,
} from "@/types/workspace";

const glass = "rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60";
const smallButton = `rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 ${focus}`;
const field = `rounded-lg border border-white/15 bg-[#121217] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 ${focus}`;
const chip = "inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs";
const gradient = "bg-linear-to-r from-[#F43F5E] to-[#FB923C] text-[#19090c]";
const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const number = new Intl.NumberFormat("es-ES", { useGrouping: "always", maximumFractionDigits: 1 });
const stamp = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Madrid" });
const statusText: Record<ScheduledVideoStatus, string> = {
  pending: "Pendiente", uploading: "Subiendo…", published: "Publicado", error: "Error",
};
const statusColor: Record<ScheduledVideoStatus, string> = {
  pending: "text-zinc-300", uploading: "text-amber-300", published: "text-emerald-300", error: "text-red-300",
};

function clock(seconds: number, short = false) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const parts = [Math.floor(total / 60) % 60, total % 60];
  if (!short || hours > 0) parts.unshift(hours);
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

function fileSize(bytes: number) {
  return bytes < 1_000_000 ? `${number.format(bytes / 1000)} kB` : `${number.format(bytes / 1_000_000)} MB`;
}

function Icon({ name, className = "size-4" }: {
  name: "video" | "upload" | "play" | "clock" | "check" | "queue" | "signal" | "calendar";
  className?: string;
}) {
  const shapes: Record<typeof name, ReactNode> = {
    video: <><rect x="2" y="5" width="14" height="14" rx="3" /><path d="m16 10 6-3v10l-6-3" /></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
    play: <path d="m7 4 13 8-13 8z" fill="currentColor" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    queue: <><rect x="3" y="3" width="18" height="13" rx="3" /><path d="m10 7 4 2.5-4 2.5zM6 20h12" /></>,
    signal: <><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9m9-9a6.4 6.4 0 0 1 0 9M4.5 4.5a10.7 10.7 0 0 0 0 15m15-15a10.7 10.7 0 0 1 0 15" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className}>{shapes[name]}</svg>;
}

function Logo({ platform }: { platform: SocialPlatform }) {
  const marks: Record<SocialPlatformId, ReactNode> = {
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.7" r="1.2" /></>,
    facebook: <path d="M14.2 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.8 1.8-1.8H18V2.3c-.7-.1-1.7-.3-2.8-.3-3 0-4.9 1.9-4.9 5.1v2.4H7V13h3.3v9z" />,
    twitter: <path fillRule="evenodd" d="M3 3h5.3l4.6 6.2L18.5 3H21l-7 7.7L22 21h-5.4l-5.3-7L5 21H2.5l7.6-8.4L3 3Zm3.1 1.6 11.4 14.8h1.6L7.7 4.6z" />,
    tiktok: <path d="M14 2h3a5 5 0 0 0 5 5v3.2a8 8 0 0 1-5-1.6v7.3a6.5 6.5 0 1 1-6.5-6.5h.7v3.4a3.2 3.2 0 1 0 2.8 3.1z" />,
    youtube: <path fillRule="evenodd" d="M2.5 6.3C3.1 4.8 5.2 4.5 12 4.5s8.9.3 9.5 1.8c.8 2 .8 9.4 0 11.4-.6 1.5-2.7 1.8-9.5 1.8s-8.9-.3-9.5-1.8c-.8-2-.8-9.4 0-11.4ZM10 8.4v7.2l6-3.6z" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5 shrink-0" style={{ color: platform.brandColor }}>{marks[platform.id]}</svg>;
}

const longDay = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const shortDay = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" });
const timeOfDay = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const pad = (n: number) => String(n).padStart(2, "0");

function localInput(epoch: number) {
  const d = new Date(epoch);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayLabel(epoch: number, now: number) {
  const day = new Date(epoch).toDateString();
  const today = new Date(now);
  if (day === today.toDateString()) return "Hoy";
  today.setDate(today.getDate() + 1);
  return day === today.toDateString() ? "Mañana" : longDay.format(epoch);
}

function countdown(epoch: number, now: number) {
  const minutes = Math.ceil((epoch - now) / 60_000);
  if (minutes <= 0) return "ahora";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`;
}

function relativeTime(epoch: number, now: number) {
  return epoch <= now ? "ahora" : `en ${countdown(epoch, now)}`;
}

function MasterControl({ broadcast, ready, now, onStartBroadcast, onStopBroadcast, onResetBroadcast }: Pick<VideoStudioSectionProps,
  "broadcast" | "ready" | "now" | "onStartBroadcast" | "onStopBroadcast" | "onResetBroadcast">) {
  const reduced = useReducedMotion();
  const { isRunning, elapsedSeconds, queue, startTimeTimestamp } = broadcast;
  let next: { video: ScheduledVideo; at: number } | null = null;
  for (const video of queue) {
    if (video.status !== "pending") continue;
    const at = video.scheduleMode === "fecha" ? video.publishAt
      : isRunning ? (startTimeTimestamp ?? now - elapsedSeconds * 1000) + video.triggerMinute * 60_000 : null;
    if (at !== null && (!next || at < next.at)) next = { video, at };
  }
  function toggle() {
    if (isRunning) onStopBroadcast();
    else if (!elapsedSeconds || window.confirm("Se reiniciará el reloj a 00:00:00. ¿Continuar?")) onStartBroadcast();
  }
  return (
    <section aria-label="Control del directo" className="sticky top-0 z-30 grid gap-3 overflow-hidden rounded-2xl border border-rose-300/20 bg-[#191419]/95 p-4 shadow-[0_8px_30px_#0006,inset_0_1px_0_#ffffff12] backdrop-blur-xl sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(244,63,94,0.12),transparent_60%)]" />
      <div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold tracking-[.16em] text-zinc-400">RELOJ DEL DIRECTO</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-bold tracking-wide ${isRunning ? "text-rose-300" : elapsedSeconds ? "text-amber-300" : "text-zinc-300"}`}>
            <span className={`size-1.5 rounded-full bg-current ${isRunning ? "motion-safe:animate-pulse" : ""}`} />{isRunning ? "EN DIRECTO" : elapsedSeconds ? "EN PAUSA" : "LISTO"}
          </span>
        </div>
        <div role="timer" aria-label="Tiempo de directo" title={startTimeTimestamp !== null ? `Inicio del directo: ${stamp.format(startTimeTimestamp)}` : undefined} className={`mt-1 font-mono text-[40px] leading-none font-semibold tracking-[-.06em] tabular-nums sm:text-[56px] ${isRunning ? "text-rose-100 [text-shadow:0_0_22px_#f43f5e70]" : "text-zinc-100"}`}>{clock(elapsedSeconds)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end" title={ready ? undefined : "Cargando el estudio…"}>
        <motion.button type="button" disabled={!ready} onClick={toggle} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={spring}
          className={`relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-xl px-4 text-xs font-bold tracking-wide disabled:opacity-45 ${focus} ${isRunning ? "border border-rose-400/50 bg-rose-950/40 text-rose-200" : gradient}`}>
          {!isRunning && !reduced && ready && <motion.span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/25 to-transparent" initial={{ x: "-150%" }} animate={{ x: "450%" }} transition={{ duration: 1, repeat: Infinity, repeatDelay: 5 }} />}
          {isRunning ? <span aria-hidden="true" className="size-3 rounded-sm bg-current" /> : <Icon name="play" />}
          {isRunning ? "DETENER DIRECTO" : "INICIAR Y SINCRONIZAR DIRECTO"}
        </motion.button>
        <button type="button" className={smallButton} onClick={onResetBroadcast} disabled={!ready || (!isRunning && elapsedSeconds === 0)}>Reiniciar reloj</button>
        {next && <p className="w-full text-xs text-zinc-300 sm:text-right">Próxima: {next.video.scheduleMode === "fecha" ? `${dayLabel(next.at, now).toLowerCase()} ${timeOfDay.format(next.at)}` : `Min ${next.video.triggerMinute}`} · <span className="font-mono tabular-nums">{relativeTime(next.at, now)}</span></p>}
      </div>
    </section>
  );
}

type Connections = Pick<VideoStudioSectionProps, "onConnectPlatform" | "onDisconnectPlatform">;

function PlatformCard({ platform: p, onConnectPlatform, onDisconnectPlatform }: Connections & { platform: SocialPlatform }) {
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState("");
  const username = handle.trim().replace(/^@+/, "").trim();
  function connect(event: FormEvent) {
    event.preventDefault();
    if (!username) return;
    onConnectPlatform(p.id, `@${username}`);
    setEditing(false);
    setHandle("");
  }
  return (
    <motion.article layout="position" className={`${glass} min-w-0 p-3.5`} style={p.connected ? { borderColor: `color-mix(in srgb, ${p.brandColor} 50%, transparent)`, boxShadow: `inset 0 1px 0 #ffffff10, 0 0 14px color-mix(in srgb, ${p.brandColor} 12%, transparent)` } : undefined}>
      <div className="flex items-center gap-2.5"><Logo platform={p} /><h3 className="text-sm font-semibold">{p.displayName}</h3></div>
      <p className="mt-2 text-xs leading-5 text-zinc-400" title={`Hasta ${p.limits.maxMentions} menciones`}>{number.format(p.limits.maxCaptionChars)} caracteres · {p.limits.maxVideoSeconds} s</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={p.connected ? "on" : editing ? "edit" : "off"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="mt-3">
          {p.connected ? <>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-emerald-300"><span className="size-1.5 shrink-0 rounded-full bg-emerald-400" /><span className="truncate" title={p.handle ?? undefined}>{p.handle ?? "Conectada"}</span></p>
            <button className={smallButton} type="button" onClick={() => onDisconnectPlatform(p.id)}>Desconectar</button>
          </> : editing ? <form onSubmit={connect} className="space-y-2">
            <input autoFocus aria-label={`Usuario de ${p.displayName}`} autoComplete="off" className={`${field} w-full`} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@usuario" onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }} />
            <div className="flex flex-wrap gap-1"><button type="submit" disabled={!username} className={smallButton}>Confirmar</button><button type="button" className={smallButton} onClick={() => setEditing(false)}>Cancelar</button></div>
          </form> : <>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-zinc-400"><span className="size-1.5 rounded-full bg-zinc-500" />Sin conectar</p>
            <button type="button" className={smallButton} onClick={() => setEditing(true)}>Conectar</button>
          </>}
        </motion.div>
      </AnimatePresence>
    </motion.article>
  );
}

function Heading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold tracking-tight sm:text-xl">{children}</h2>{aside && <span className="text-xs text-zinc-400">{aside}</span>}</div>;
}

function Mentions({ names }: { names: string[] }) {
  if (!names.length) return null;
  return <div className="mt-2 flex flex-wrap gap-1">{names.map((name) => <span key={name} className="max-w-full rounded bg-violet-400/10 px-1.5 py-0.5 text-xs break-all text-violet-200">@{name}</span>)}</div>;
}

function Description({ value, onChange, suggestions }: { value: string; onChange: (value: string) => void; suggestions: string[] }) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const token = caret === null ? null : /@([A-Za-z0-9_.]*)$/.exec(value.slice(0, caret));
  const options = token ? suggestions.filter((name) => name.toLowerCase().startsWith(token[1].toLowerCase())).slice(0, 6) : [];
  const index = Math.min(active, options.length - 1);
  function insert(name: string) {
    if (!token || caret === null) return;
    const prefix = value.slice(0, token.index) + `@${name} `;
    const suffix = value.slice(caret).replace(/^[A-Za-z0-9_.]*/, "");
    flushSync(() => onChange(prefix + suffix));
    input.current?.focus();
    input.current?.setSelectionRange(prefix.length, prefix.length);
    setCaret(null);
    setActive(0);
  }
  function keys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!options.length || event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insert(options[index]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setCaret(null);
    }
  }
  return <div>
    <label htmlFor={id} className="text-sm font-medium">Descripción</label>
    <div className="relative mt-2">
      <textarea id={id} ref={input} rows={4} value={value} placeholder="Escribe la descripción y menciona a @alguien…" className={`${field} block min-h-24 w-full resize-y`}
        aria-autocomplete="list" aria-controls={options.length ? id + "-lista" : undefined} aria-activedescendant={options.length ? id + "-op-" + index : undefined}
        onChange={(e) => { onChange(e.target.value); setCaret(e.target.selectionStart); setActive(0); }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart === e.currentTarget.selectionEnd ? e.currentTarget.selectionStart : null)}
        onBlur={() => setCaret(null)} onKeyDown={keys} />
      {options.length > 0 && <ul id={id + "-lista"} role="listbox" aria-label="Menciones sugeridas" className="absolute top-full left-0 z-20 mt-1 max-h-48 w-full max-w-xs overflow-y-auto rounded-xl border border-white/15 bg-[#202027] p-1 shadow-xl">
        {options.map((name, i) => <li key={name} id={id + "-op-" + i} role="option" aria-selected={i === index} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(name)} className={`cursor-pointer rounded-lg px-3 py-2 text-sm hover:bg-white/10 ${index === i ? "bg-white/10 text-rose-200" : ""}`}>@{name}</li>)}
      </ul>}
    </div>
    <Mentions names={Array.from(new Set((value.match(/@[A-Za-z0-9_.]+/g) ?? []).map((name) => name.slice(1).replace(/\.+$/, "")).filter(Boolean)))} />
  </div>;
}

type ScheduleForm = { mode: ScheduleMode | "ahora"; date: string; dateChosen: boolean; minute: string };
const shortcuts = ["En 1 hora", "Esta noche 21:00", "Mañana 10:00", "En 1 semana"] as const;
function shortcutDate(now: number, shortcut: typeof shortcuts[number]) {
  const date = new Date(now);
  if (shortcut === "En 1 hora") date.setTime(now + 3_600_000);
  if (shortcut === "En 1 semana") date.setDate(date.getDate() + 7);
  if (shortcut === "Esta noche 21:00") date.setHours(21, 0, 0, 0);
  if (shortcut === "Mañana 10:00") {
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
  }
  return localInput(date.getTime());
}

function initialSchedule(now: number, video?: ScheduledVideo): ScheduleForm {
  return {
    mode: video?.scheduleMode ?? "fecha",
    minute: String(video?.triggerMinute ?? 0),
    date: video?.publishAt != null ? localInput(video.publishAt) : shortcutDate(now, "En 1 hora"),
    dateChosen: video?.publishAt != null,
  };
}

function scheduleValues(form: ScheduleForm, now: number): Parameters<VideoStudioSectionProps["onUpdateSchedule"]>[1] {
  if (form.mode === "directo") return { scheduleMode: "directo", triggerMinute: form.minute === "" ? NaN : Number(form.minute), publishAt: null };
  const at = form.mode === "ahora" ? now : new Date(form.date).getTime();
  return { scheduleMode: "fecha", triggerMinute: 0, publishAt: Number.isFinite(at) ? at : null };
}

function ScheduleEditor({ value, now, onChange }: {
  value: ScheduleForm; now: number; onChange: (form: ScheduleForm) => void;
}) {
  const id = useId();
  const modes = [["ahora", "Ahora"], ["fecha", "Fecha y hora"], ["directo", "Minuto del directo"]] as const;
  const { publishAt } = scheduleValues(value, now);
  return <fieldset className="min-w-0 space-y-3">
    <legend className="mb-2 text-sm font-medium">Cuándo publicar</legend>
    <div className="grid grid-cols-[.7fr_1fr_1.2fr] rounded-xl border border-white/10 bg-black/30 p-1">
      {modes.map(([mode, label]) => <button key={mode} type="button" aria-pressed={value.mode === mode}
        className={`relative isolate min-w-0 rounded-lg px-1 py-2 text-xs leading-tight text-zinc-400 aria-pressed:text-rose-100 ${focus}`}
        onClick={() => onChange({ ...value, mode, dateChosen: value.dateChosen || mode === "fecha",
          date: mode === "fecha" && !value.dateChosen ? shortcutDate(now, "En 1 hora") : value.date })}>
        {value.mode === mode && <motion.span layoutId={id + "-modo"} transition={spring} className="absolute inset-0 -z-10 rounded-lg border border-rose-300/25 bg-rose-400/15" />}{label}
      </button>)}
    </div>
    {value.mode === "directo" && <div className="flex flex-wrap items-center gap-1.5">
      <input aria-label="Minuto de publicación en el directo" type="number" min={0} max={600} step={1} required value={value.minute} className={`${field} w-20 font-mono tabular-nums`}
        onChange={(e) => onChange({ ...value, minute: e.target.value })} />
      {[0, 20, 40, 60].map((n) => <button key={n} type="button" aria-pressed={value.minute === String(n)} className={`${smallButton} aria-pressed:border-orange-300/40 aria-pressed:text-orange-200`}
        onClick={() => onChange({ ...value, minute: String(n) })}>Min {n}</button>)}
    </div>}
    {value.mode === "fecha" && <div className="space-y-2.5">
      <input type="datetime-local" required aria-label="Fecha y hora de publicación" value={value.date} min={localInput(now)}
        className={`${field} block w-full min-w-0 font-mono tabular-nums [color-scheme:dark]`} onChange={(e) => onChange({ ...value, date: e.target.value, dateChosen: true })} />
      <div className="flex flex-wrap gap-1.5">{shortcuts.map((shortcut) => <button type="button" key={shortcut} className={smallButton}
        disabled={shortcut === "Esta noche 21:00" && new Date(now).getHours() >= 21}
        onClick={() => onChange({ ...value, date: shortcutDate(now, shortcut), dateChosen: true })}>{shortcut}</button>)}</div>
      {publishAt !== null && publishAt >= now && <p className="text-xs leading-relaxed text-rose-200">Se publicará el {longDay.format(publishAt)} a las {timeOfDay.format(publishAt)} (dentro de {countdown(publishAt, now)}).</p>}
      <p className="text-xs leading-relaxed text-zinc-400">La app tiene que estar abierta a esa hora (en el ordenador o el móvil). Si está cerrada, se publicará en cuanto la abras.</p>
    </div>}
  </fieldset>;
}

function PlatformSwitch({ platform, enabled, locked = false, compact = false, count = 0, onChange }: {
  platform: SocialPlatform; enabled: boolean; locked?: boolean; compact?: boolean; count?: number; onChange: (enabled: boolean) => void;
}) {
  const limit = platform.limits.maxCaptionChars;
  const reduced = useReducedMotion();
  const status = platform.connected ? (platform.handle ? `Conectada como ${platform.handle}` : "Conectada") : "Sin conectar";
  return <button type="button" role="switch" aria-checked={enabled} disabled={locked} aria-disabled={locked} aria-label={`Publicar en ${platform.displayName}`}
    title={locked ? "Debe quedar al menos una red" : status} onClick={() => { if (!locked) onChange(!enabled); }}
    className={`${focus} flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-left hover:bg-white/[0.06] aria-disabled:cursor-not-allowed ${compact ? "px-2 py-1.5" : "w-full px-3 py-2.5"}`}>
    <Logo platform={platform} />
    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{platform.displayName}</span>
      {!compact && <span className={`block truncate text-[11px] ${platform.connected ? "text-zinc-400" : "text-amber-300"}`}>{status}</span>}
      {!compact && enabled && <span className={`block font-mono text-[10px] tabular-nums ${count > limit ? "text-red-300" : count > limit * 0.9 ? "text-amber-300" : "text-zinc-400"}`}>{count}/{limit} caracteres</span>}
    </span>
    <span aria-hidden="true" className={`relative shrink-0 rounded-full bg-zinc-700 ring-1 ring-inset ring-white/20 ${compact ? "h-4 w-7" : "h-5 w-9"}`}
      style={enabled ? { backgroundColor: platform.brandColor } : undefined}>
      <motion.span initial={false} animate={{ x: enabled ? (compact ? 12 : 16) : 0 }} transition={reduced ? { duration: 0 } : spring}
        className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm ring-1 ring-black/20 ${compact ? "size-3" : "size-4"}`} />
    </span>
  </button>;
}

function ImagePicker({ onPick }: { onPick: (file: File) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  return <>
    <input type="file" accept="image/*" ref={picker} aria-label="Seleccionar imagen de portada" className="hidden" onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) onPick(file);
      e.target.value = "";
    }} />
    <button type="button" className={smallButton} onClick={() => picker.current?.click()}>Subir imagen</button>
  </>;
}

function Composer({ platforms, mentionSuggestions, validateDraft, onScheduleVideo, captureFrame, now, pickerId }: Pick<VideoStudioSectionProps,
  "platforms" | "mentionSuggestions" | "validateDraft" | "onScheduleVideo" | "captureFrame" | "now"> & { pickerId: string }) {
  const [clip, setClip] = useState<{ file: File; url: string } | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const latestUrl = useRef<string | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const coverUrl = useRef<string | null>(null);
  const captureVersion = useRef(0);
  const [cover, setCover] = useState<{ blob: Blob; url: string; source: CoverSource } | null>(null);
  const [frame, setFrame] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [coverError, setCoverError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<SocialPlatformId[]>([]);
  const [timing, setTiming] = useState(() => initialSchedule(now));
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<ValidationIssue[]>([]);
  const [requestFailed, setRequestFailed] = useState(false);
  const [success, setSuccess] = useState("");
  const scheduleFields = scheduleValues(timing, now);
  const { triggerMinute } = scheduleFields;
  const validMinute = Number.isInteger(triggerMinute) && triggerMinute >= 0 && triggerMinute <= 600;
  // Los avisos solo tienen sentido cuando ya hay un vídeo elegido.
  const validation: DraftValidationInput = { ...scheduleFields, description, platforms: selected, durationSeconds: duration,
    cover: cover ? { mimeType: cover.blob.type, sizeBytes: cover.blob.size } : null };
  const liveIssues = clip ? validateDraft(validation) : [];
  const issues = [...liveIssues, ...feedback].filter((issue, i, all) => all.findIndex((other) =>
    other.severity === issue.severity && other.platform === issue.platform && other.message === issue.message) === i);
  const disabled = sending || capturing || !clip || !selected.length || !validMinute || issues.some((issue) => issue.severity === "error");

  useEffect(() => () => {
    if (latestUrl.current) URL.revokeObjectURL(latestUrl.current);
    if (coverUrl.current) URL.revokeObjectURL(coverUrl.current);
    latestUrl.current = null;
    coverUrl.current = null;
  }, []);

  function clearFeedback() {
    setFeedback([]);
    setRequestFailed(false);
    setSuccess("");
  }
  function replaceCover(next: { blob: Blob; source: CoverSource } | null) {
    clearFeedback();
    captureVersion.current++;
    setCapturing(false);
    setCoverError("");
    const chosen = next ? { ...next, url: URL.createObjectURL(next.blob) } : null;
    if (coverUrl.current) URL.revokeObjectURL(coverUrl.current);
    coverUrl.current = chosen?.url ?? null;
    setCover(chosen);
  }
  function pickImage(file: File) {
    if (file.type.startsWith("image/")) replaceCover({ blob: file, source: "imagen" });
    else setCoverError("Selecciona un archivo de imagen.");
  }
  async function useFrame() {
    if (!clip) return;
    const version = ++captureVersion.current;
    const current = () => latestUrl.current === clip.url && version === captureVersion.current;
    setCapturing(true);
    setCoverError("");
    try {
      const blob = await captureFrame(clip.file, frame);
      if (!current()) return;
      if (blob) replaceCover({ blob, source: "fotograma" });
      else setCoverError("No se ha podido extraer el fotograma. Prueba con otro segundo o sube una imagen.");
    } catch {
      if (current()) setCoverError("No se ha podido extraer el fotograma.");
    } finally {
      if (current()) setCapturing(false);
    }
  }
  function replaceClip(file: File | null) {
    clearFeedback();
    if (file && !file.type.startsWith("video/") && (file.type || !/\.(mp4|webm|mov|m4v|mkv|avi|mpeg|mpg|3gp|ogv)$/i.test(file.name))) {
      setFeedback([{ severity: "error", platform: null, message: "Selecciona un archivo de vídeo." }]);
      return;
    }
    const next = file ? { file, url: URL.createObjectURL(file) } : null;
    if (next && !clip && !timing.dateChosen) setTiming({ ...timing, date: shortcutDate(now, "En 1 hora") });
    if (latestUrl.current) URL.revokeObjectURL(latestUrl.current);
    latestUrl.current = next?.url ?? null;
    setClip(next);
    setDuration(null);
    setFrame(0);
    replaceCover(null);
  }
  function hasFiles(event: DragEvent) {
    return !sending && event.dataTransfer.types.includes("Files");
  }
  async function schedule(event: FormEvent) {
    event.preventDefault();
    if (disabled || !clip) return;
    setSending(true);
    clearFeedback();
    const draft: NewScheduledVideoInput = { ...scheduleValues(timing, Date.now()), file: clip.file, description, platforms: selected,
      cover: cover?.blob ?? null, coverSource: cover?.source ?? null };
    try {
      const result = await onScheduleVideo(draft);
      if (result.length) setFeedback(result);
      else {
        replaceClip(null);
        setDescription("");
        setSelected([]);
        setTiming(initialSchedule(Date.now()));
        setSuccess(timing.mode === "directo" ? `Vídeo programado en el Min ${triggerMinute}`
          : timing.mode === "ahora" ? "Vídeo listo para publicarse ahora" : "Vídeo añadido a la agenda");
      }
    } catch {
      setRequestFailed(true);
    } finally {
      setSending(false);
    }
  }
  return <section className={`${glass} p-4 sm:p-6`}>
    <Heading>Programar un vídeo</Heading>
    <form onSubmit={schedule}>
      <fieldset disabled={sending} className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
        <div className="min-w-0">
          <div className="mb-2 text-sm font-medium">Archivo de vídeo</div>
          <input ref={picker} type="file" accept="video/*" aria-label="Seleccionar archivo de vídeo" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) replaceClip(file); e.target.value = ""; }} />
          <div onDragEnter={(e) => { if (hasFiles(e)) { e.preventDefault(); dragDepth.current++; setDragging(true); } }}
            onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
            onDragLeave={(e) => { if (hasFiles(e)) { e.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); setDragging(dragDepth.current > 0); } }}
            onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); dragDepth.current = 0; setDragging(false); const file = e.dataTransfer.files[0]; if (file) replaceClip(file); } }}
            className={`overflow-hidden rounded-xl border border-dashed transition-colors ${dragging ? "border-orange-300 bg-orange-400/10" : "border-rose-200/25 bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,.07),transparent)]"}`}>
            {clip ? <div className="space-y-3 p-3">
              <video key={clip.url} ref={player} src={clip.url} controls playsInline preload="metadata" aria-label={`Vista previa de ${clip.file.name}`} className="aspect-video max-h-60 w-full rounded-lg bg-black object-contain"
                onLoadedMetadata={(e) => { const length = e.currentTarget.duration; if (latestUrl.current === clip.url) setDuration(Number.isFinite(length) ? length : null); }} />
              <p className="truncate text-sm font-medium" title={clip.file.name}>{clip.file.name}</p>
              <p className="font-mono text-xs text-zinc-400 tabular-nums">{fileSize(clip.file.size)} · {duration === null ? "Duración sin determinar" : clock(duration, true)}</p>
              <div className="flex gap-2"><button id={pickerId} type="button" className={smallButton} onClick={() => picker.current?.click()}>Cambiar vídeo</button><button type="button" className={smallButton} onClick={() => replaceClip(null)}>Quitar</button></div>
            </div> : <button id={pickerId} type="button" onClick={() => picker.current?.click()} className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-6 hover:bg-rose-400/5 lg:min-h-60 ${focus}`}>
              <span className="mb-1 grid size-12 place-items-center rounded-xl border border-rose-300/20 bg-rose-400/10 text-rose-300"><Icon name="upload" className="size-6" /></span>
              <span className="text-sm font-semibold">{dragging ? "Suelta el vídeo aquí" : "Seleccionar vídeo"}</span>
              <span className="text-xs text-zinc-400">o arrastra el archivo aquí</span>
            </button>}
          </div>
          {clip && <fieldset className="mt-5 min-w-0 space-y-3">
            <legend className="mb-2 text-sm font-medium">Portada</legend>
            <div onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = sending ? "none" : "copy"; }}
              onDrop={(e) => { e.preventDefault(); const image = e.dataTransfer.files[0]; if (!sending && image) pickImage(image); }}
              className={`grid aspect-video max-h-52 w-full place-items-center overflow-hidden rounded-xl border border-white/15 bg-black/30 bg-contain bg-center bg-no-repeat text-center ${cover ? "" : "border-dashed"}`}
              style={cover ? { backgroundImage: `url("${cover.url}")` } : undefined}>
              {cover ? <span className="sr-only">Portada elegida</span> : <span className="px-4 text-xs text-zinc-400">Sin portada · se usará el primer fotograma</span>}
            </div>
            <div className="flex items-center justify-between text-xs"><label htmlFor={pickerId + "-fotograma"}>Elegir fotograma</label>
              <output htmlFor={pickerId + "-fotograma"} className="font-mono text-rose-200 tabular-nums">{number.format(frame)} s</output></div>
            <input id={pickerId + "-fotograma"} type="range" min={0} max={duration ?? 0} step={0.1} value={frame} disabled={!duration || capturing}
              className={`block w-full accent-rose-400 ${focus}`} onChange={(e) => {
                const seconds = e.currentTarget.valueAsNumber;
                if (player.current) { player.current.pause(); player.current.currentTime = seconds; }
                setFrame(seconds);
              }} />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={smallButton} disabled={!duration || capturing} onClick={useFrame}>{capturing ? "Extrayendo…" : "Usar este fotograma"}</button>
              <ImagePicker onPick={pickImage} />
              {cover && <button type="button" className={smallButton} onClick={() => replaceCover(null)}>Quitar portada</button>}
            </div>
            {coverError && <p role="alert" className="text-xs text-red-300">{coverError}</p>}
            <div className="flex flex-wrap gap-1">{platforms.filter((p) => selected.includes(p.id) && !p.supportsCustomCover).map((p) =>
              <span key={p.id} className={`${chip} text-zinc-400`}>{p.displayName} usará un fotograma automático</span>)}</div>
          </fieldset>}
        </div>
        <div className="min-w-0 space-y-4">
          <Description value={description} suggestions={mentionSuggestions} onChange={(text) => { clearFeedback(); setDescription(text); }} />
          <div role="group" aria-label="Redes donde publicar">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">Redes donde publicar</span>
              <button type="button" className={smallButton} onClick={() => {
                clearFeedback(); setSelected(selected.length === platforms.length ? [] : platforms.map((p) => p.id));
              }}>{selected.length === platforms.length ? "Ninguna" : "Todas"}</button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">{platforms.map((p) => <PlatformSwitch key={p.id} platform={p}
              enabled={selected.includes(p.id)} count={description.length} onChange={(enabled) => {
                clearFeedback(); setSelected(enabled ? [...selected, p.id] : selected.filter((id) => id !== p.id));
              }} />)}</div>
          </div>
          <ScheduleEditor value={timing} now={now} onChange={(form) => { clearFeedback(); setTiming(form); }} />
          {!validMinute && <p className="text-xs text-red-300">Introduce un minuto entero entre 0 y 600.</p>}
        </div>
      </fieldset>
      {issues.length > 0 && <ul aria-live="polite" className="mt-4 space-y-1.5">{issues.map((issue) => <li key={JSON.stringify([issue.platform, issue.severity, issue.message])} className={`rounded-lg px-3 py-2 text-xs ${issue.severity === "error" ? "bg-red-400/10 text-red-300" : "bg-amber-400/10 text-amber-300"}`}><strong>{issue.severity === "error" ? "Error" : "Aviso"}{issue.platform && ` · ${platforms.find((p) => p.id === issue.platform)?.displayName ?? issue.platform}`}</strong> · {issue.message}</li>)}</ul>}
      {requestFailed && <p role="alert" className="mt-3 text-sm text-red-300">No se ha podido programar el vídeo. Vuelve a intentarlo.</p>}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
        <div role="status">{success && <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 text-sm text-emerald-300"><Icon name="check" />{success}</motion.span>}</div>
        <motion.button type="submit" disabled={disabled} whileTap={disabled ? undefined : { scale: 0.97 }} whileHover={disabled ? undefined : { scale: 1.02 }} transition={spring} className={`${focus} ${gradient} flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45`}><Icon name="clock" />{sending ? "Programando…" : timing.mode === "ahora" ? "Publicar ahora" : timing.mode === "fecha" ? "Programar" : "Programar en el directo"}</motion.button>
      </div>
    </form>
  </section>;
}

function StatusMark({ status }: { status: ScheduledVideoStatus }) {
  if (status === "uploading") return <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />;
  if (status === "published") return <Icon name="check" className="size-3.5 shrink-0" />;
  if (status === "error") return <span aria-hidden="true">✕</span>;
  return <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />;
}

function VideoPreview({ video, controls = false }: { video: ScheduledVideo; controls?: boolean }) {
  if (video.coverUrl && (!controls || !video.previewUrl)) return <div role="img" aria-label={`Portada de ${video.fileName}`}
    className="size-full bg-black bg-cover bg-center" style={{ backgroundImage: `url("${video.coverUrl}")` }} />;
  return video.previewUrl
    ? <video key={video.videoBlobKey} src={video.previewUrl} poster={video.coverUrl ?? undefined} preload="metadata" muted={!controls} playsInline controls={controls} aria-label={`Vista previa de ${video.fileName}`} className="size-full bg-black object-contain" />
    : <div title="Vista previa no disponible" className="grid size-full place-items-center bg-linear-to-br from-rose-950 via-zinc-900 to-orange-950 text-rose-200/70"><Icon name="video" /></div>;
}

function Timeline({ videos, elapsed, maximum, platforms, rowPrefix }: {
  videos: ScheduledVideo[]; elapsed: number; maximum: number; platforms: SocialPlatform[]; rowPrefix: string;
}) {
  const width = Math.max(900, maximum * 12);
  const cardWidth = 132;
  const laneEnds: number[] = [];
  // Use the minimum track width for packing so adjacent clips also fit on narrow screens.
  const markers = videos.map((video) => {
    const fraction = Math.min(1, Math.max(0, video.triggerMinute / maximum));
    const left = fraction * (width - cardWidth);
    let lane = laneEnds.findIndex((end) => end + 6 <= left);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = left + cardWidth;
    return { video, lane, fraction };
  });
  const ticks = Array.from({ length: Math.floor(maximum / 5) + 1 }, (_, i) => i * 5);
  if (ticks[ticks.length - 1] !== maximum) ticks.push(maximum);
  const progress = Math.max(0, Math.min(1, elapsed / (maximum * 60))) * 100;
  return <section className={`${glass} min-w-0 p-4 sm:p-6`}>
    <Heading aside={`Min 00 – Min ${maximum}`}>Línea de sincronización</Heading>
    <div role="region" aria-label="Cronología desplazable" tabIndex={0} className={`overflow-x-auto rounded-xl border border-white/[0.07] bg-[#101015] ${focus}`}>
      <div className="px-6 pt-3 pb-4" style={{ minWidth: width + 48 }}>
        <div className="relative isolate" style={{ height: 71 + 59 * laneEnds.length }}>
          <div aria-hidden="true" className="absolute inset-0 -z-10 origin-left bg-linear-to-r from-rose-400/[0.03] to-rose-400/10 motion-safe:transition-transform motion-safe:duration-1000 motion-safe:ease-linear" style={{ transform: `scaleX(${progress / 100})` }} />
          <div className="absolute inset-x-0 top-9 h-px bg-zinc-600" />
          {ticks.map((n) => <div key={n} className="absolute top-9 bottom-0 border-l border-white/[0.06]" style={{ left: `${n / maximum * 100}%` }}>
            <div className={`w-px bg-zinc-500 ${n % 10 === 0 ? "h-2.5" : "h-1.5"}`} />
            {(n % 10 === 0 || n === maximum) && <span className={`absolute top-3 whitespace-nowrap font-mono text-[10px] text-zinc-400 tabular-nums ${n === maximum ? "-translate-x-full" : n === 0 ? "" : "-translate-x-1/2"}`}>Min {String(n).padStart(2, "0")}</span>}
          </div>)}
          {markers.map(({ video, lane, fraction }) => <a key={video.id} href={`#${rowPrefix}${encodeURIComponent(video.id)}`} title={video.description.slice(0, 160) || video.fileName}
            aria-label={`Min ${video.triggerMinute}, ${video.fileName}, ${statusText[video.status]}`}
            className={`absolute flex h-12 items-center gap-2 rounded-lg border border-current/25 bg-[#1a191f] px-2 hover:bg-[#252329] ${focus} ${statusColor[video.status]}`}
            style={{ width: cardWidth, left: `${fraction * 100}%`, transform: `translateX(-${fraction * 100}%)`, top: 67 + 59 * lane }}>
            <div className="size-7 shrink-0 overflow-hidden rounded"><VideoPreview video={video} /></div>
            <div className="min-w-0"><p className="truncate text-[11px] font-medium text-zinc-200">{video.fileName}</p>
              <div className="mt-1 flex items-center gap-1"><StatusMark status={video.status} />{video.platforms.map((id) => <span key={id} aria-label={platforms.find((p) => p.id === id)?.displayName} className="size-1.5 rounded-full" style={{ backgroundColor: platforms.find((p) => p.id === id)?.brandColor }} />)}</div>
            </div>
          </a>)}
          {elapsed > 0 && <div className="pointer-events-none absolute inset-y-0 z-10 w-0 motion-safe:transition-[left] motion-safe:duration-1000 motion-safe:ease-linear" style={{ left: `${progress}%` }}>
            <div className="absolute inset-y-1 left-0 w-0.5 bg-rose-400 shadow-[0_0_8px_#f43f5e]" />
            <span className={`absolute top-0 rounded bg-rose-400 px-1.5 py-1 font-mono text-[10px] font-bold text-zinc-950 tabular-nums ${progress > 95 ? "-translate-x-full" : progress > 5 ? "-translate-x-1/2" : ""}`}>{clock(elapsed)}</span>
          </div>}
        </div>
      </div>
    </div>
  </section>;
}

type QueueActions = Pick<VideoStudioSectionProps, "onRetryVideo" | "onRemoveVideo" | "onUpdateTriggerMinute" |
  "captureFrame" | "now" | "onUpdateCover" | "onUpdateSchedule" | "onTogglePlatform" | "onPublishNow">;

function QueueCoverEditor({ video, captureFrame, onUpdateCover, close }: Pick<QueueActions, "captureFrame" | "onUpdateCover"> & {
  video: ScheduledVideo; close: () => void;
}) {
  const [seconds, setSeconds] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  const at = Number(seconds);
  const valid = seconds !== "" && Number.isFinite(at) && at >= 0 && (video.durationSeconds === null || at <= video.durationSeconds);
  async function extract() {
    if (!valid || !video.previewUrl || busy) return;
    const request = ++version.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(video.previewUrl);
      if (!response.ok) throw new Error();
      const source = await response.blob();
      if (request !== version.current) return;
      const frame = await captureFrame(source, at);
      if (request !== version.current) return;
      if (!frame) throw new Error();
      onUpdateCover(video.id, frame, "fotograma");
      close();
    } catch {
      if (request === version.current) setError("No se ha podido extraer el fotograma. Prueba con otro segundo o sube una imagen.");
    } finally {
      if (request === version.current) setBusy(false);
    }
  }
  return <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <ImagePicker onPick={(file) => {
        if (!file.type.startsWith("image/")) { setError("Selecciona un archivo de imagen."); return; }
        version.current++;
        onUpdateCover(video.id, file, "imagen");
        close();
      }} />
      <label className="flex items-center gap-2 text-xs text-zinc-300">Segundo
        <input type="number" min={0} max={video.durationSeconds ?? undefined} step={0.1} value={seconds} disabled={busy || !video.previewUrl}
          className={`${field} w-20 font-mono tabular-nums`} onChange={(e) => setSeconds(e.target.value)} />
      </label>
      <button type="button" className={smallButton} disabled={!valid || !video.previewUrl || busy} onClick={extract}>
        {busy ? "Extrayendo…" : `Usar fotograma del segundo ${valid ? number.format(at) : "…"}`}</button>
      <button type="button" className={smallButton} onClick={close}>Cancelar</button>
    </div>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}

function QueueScheduleEditor({ video, now, onUpdateSchedule, close }: Pick<QueueActions, "now" | "onUpdateSchedule"> & {
  video: ScheduledVideo; close: () => void;
}) {
  const [form, setForm] = useState(() => initialSchedule(now, video));
  function save(event: FormEvent) {
    event.preventDefault();
    if (form.mode === "ahora" && !window.confirm("¿Publicar este vídeo ahora en todas sus redes activas?")) return;
    onUpdateSchedule(video.id, scheduleValues(form, form.mode === "ahora" ? Date.now() : now));
    close();
  }
  const at = scheduleValues(form, now).publishAt;
  return <form className="mt-3 max-w-xl space-y-3 rounded-xl border border-white/10 bg-black/20 p-3" onSubmit={save}>
    <ScheduleEditor value={form} onChange={setForm} now={now} />
    <div className="flex gap-2"><button type="submit" disabled={form.mode === "fecha" && (at === null || at <= now)}
      className={`${smallButton} text-rose-200`}>Guardar cambios</button>
      <button type="button" className={smallButton} onClick={close}>Cancelar</button></div>
  </form>;
}

function Agenda({ videos, platforms, now, rowPrefix, pickerId }: {
  videos: ScheduledVideo[]; platforms: SocialPlatform[]; now: number; rowPrefix: string; pickerId: string;
}) {
  const days = new Map<string, { at: number; video: ScheduledVideo }[]>();
  for (const video of videos) {
    if (video.scheduleMode !== "fecha" || video.publishAt === null) continue;
    const key = localInput(video.publishAt).slice(0, 10);
    const entries = days.get(key) ?? [];
    entries.push({ at: video.publishAt, video });
    days.set(key, entries);
  }
  return <section className={`${glass} p-4 sm:p-6`}>
    <Heading>Agenda</Heading>
    {days.size ? <div className="space-y-4">{Array.from(days, ([key, entries]) => <div key={key}>
      <h3 className="mb-1.5 text-xs font-semibold text-rose-200 first-letter:uppercase">{dayLabel(entries[0].at, now)}</h3>
      <ul className="divide-y divide-white/[0.07]">{entries.map(({ at, video }) => <li key={video.id}>
        <a href={`#${rowPrefix}${encodeURIComponent(video.id)}`} className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 rounded-lg py-2 text-xs hover:bg-white/[0.04] sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:px-2 ${focus}`}>
          <time dateTime={new Date(at).toISOString()} className="font-mono tabular-nums text-rose-200">{timeOfDay.format(at)}</time>
          <span className="aspect-video w-12 overflow-hidden rounded"><VideoPreview video={video} /></span>
          <span className="min-w-0"><span className="block truncate font-medium" title={video.fileName}>{video.fileName}</span>
            <span className="mt-1.5 flex gap-1">{platforms.filter((p) => video.platforms.includes(p.id)).map((p) =>
              <span key={p.id} title={p.displayName} className="size-2 rounded-full ring-1 ring-inset ring-white/20" style={{ backgroundColor: p.brandColor }}><span className="sr-only">{p.displayName}</span></span>)}</span>
          </span>
          <span className={`col-start-3 inline-flex items-center gap-1.5 sm:col-start-auto ${statusColor[video.status]}`}><StatusMark status={video.status} />{statusText[video.status]}</span>
        </a>
      </li>)}</ul>
    </div>)}</div> : <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 p-6 text-center">
      <Icon name="calendar" className="size-6 text-rose-300/80" /><p className="text-sm text-zinc-400">No hay vídeos programados por fecha</p>
      <button type="button" className={smallButton} onClick={() => document.getElementById(pickerId)?.focus()}>Programar un vídeo</button>
    </div>}
  </section>;
}

function QueueRow({ video, platforms, rowId, onRetryVideo, onRemoveVideo, onUpdateTriggerMinute, onUpdateSchedule, onUpdateCover,
  onTogglePlatform, onPublishNow, captureFrame, now }: QueueActions & {
  video: ScheduledVideo; platforms: SocialPlatform[]; rowId: string;
}) {
  const results = Object.values(video.results);
  const reduced = useReducedMotion();
  const [editor, setEditor] = useState<"portada" | "horario" | null>(null);
  const pending = video.status === "pending";
  function platformName(id: SocialPlatformId) {
    return platforms.find((p) => p.id === id)?.displayName ?? id;
  }
  return <motion.li id={rowId} layout="position" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
    className="scroll-mt-56 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 sm:p-4">
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative aspect-video w-full max-w-64 shrink-0 self-start overflow-hidden rounded-lg border border-white/10 sm:w-36"><VideoPreview video={video} controls />
        {video.coverUrl && <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">Portada</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {video.scheduleMode === "fecha" ? <span className={`${chip} flex-wrap border-rose-400/25 bg-rose-400/5 text-rose-200`}>
            <Icon name="calendar" className="size-3.5" />
            {video.publishAt !== null ? <><span className="first-letter:uppercase">{shortDay.format(video.publishAt)} · {timeOfDay.format(video.publishAt)}</span>
              {pending && <span className="font-mono text-zinc-400 tabular-nums">· {relativeTime(video.publishAt, now)}</span>}</> : "Sin fecha"}
          </span> : pending ? <label className={`${chip} border-rose-400/25 bg-rose-400/5 font-mono text-rose-200`}>Min
            <input key={video.triggerMinute} type="number" aria-label={`Minuto de publicación de ${video.fileName}`} min={0} max={600} step={1} defaultValue={video.triggerMinute} className={`w-14 rounded bg-transparent tabular-nums ${focus}`}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              onBlur={(e) => {
                const value = e.currentTarget.valueAsNumber;
                if (!Number.isInteger(value) || value < 0 || value > 600) e.currentTarget.value = String(video.triggerMinute);
                else if (value !== video.triggerMinute) onUpdateTriggerMinute(video.id, value);
              }} />
          </label> : <span className={`${chip} font-mono tabular-nums text-rose-200`}>Min {video.triggerMinute}</span>}
          {pending && <button type="button" aria-label={`Cambiar la programación de ${video.fileName}`} aria-expanded={editor === "horario"}
            className={smallButton} onClick={() => setEditor(editor === "horario" ? null : "horario")}>Cambiar</button>}
          <span className={`${chip} relative overflow-hidden ${statusColor[video.status]}`}><StatusMark status={video.status} />{statusText[video.status]}
            {video.status === "uploading" && !reduced && <motion.span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-transparent via-amber-200/20 to-transparent" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.4, repeat: Infinity }} />}
          </span>
        </div>
        <h3 className="mt-2 truncate text-sm font-semibold" title={video.fileName}>{video.fileName}</h3>
        <p title={`Añadido el ${stamp.format(video.createdAt)}${video.publishedAt !== null ? ` · Publicado el ${stamp.format(video.publishedAt)}` : ""}`} className="mt-1 text-xs text-zinc-400">{fileSize(video.sizeBytes)}{video.durationSeconds !== null && ` · ${clock(video.durationSeconds, true)}`}{video.mimeType && ` · ${video.mimeType}`}</p>
        {video.description && <p className="mt-2 line-clamp-2 text-sm break-words text-zinc-300">{video.description}</p>}
        <Mentions names={video.mentions} />
        <div role="group" aria-label={`Redes de ${video.fileName}`} className="mt-2 flex flex-wrap gap-1">
          {pending ? platforms.map((p) => <PlatformSwitch key={p.id} platform={p} enabled={video.platforms.includes(p.id)} compact
            locked={video.platforms.length === 1 && video.platforms[0] === p.id} onChange={(enabled) => onTogglePlatform(video.id, p.id, enabled)} />)
            : video.platforms.map((id) => <span key={id} className={chip}><span className="size-1.5 rounded-full" style={{ backgroundColor: platforms.find((p) => p.id === id)?.brandColor }} />{platformName(id)}</span>)}
        </div>
      </div>
    </div>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        {pending && <>
          <button type="button" className={`${smallButton} border-rose-400/25 text-rose-200`} onClick={() => {
            if (window.confirm("¿Publicar este vídeo ahora en todas sus redes activas?")) onPublishNow(video.id);
          }}>Publicar ya</button>
          <button type="button" className={smallButton} aria-expanded={editor === "portada"} onClick={() => setEditor(editor === "portada" ? null : "portada")}>Cambiar portada</button>
          {(video.coverBlobKey || video.coverUrl) && <button type="button" className={smallButton} onClick={() => {
            setEditor(null); onUpdateCover(video.id, null, null);
          }}>Quitar portada</button>}
        </>}
        {(video.status === "error" || results.some((r) => !r.ok)) && <button type="button" className={smallButton} onClick={() => onRetryVideo(video.id)}>Reintentar</button>}
        <button type="button" disabled={video.status === "uploading"} className={`${smallButton} hover:text-red-300`} onClick={() => { if (window.confirm("¿Eliminar este vídeo de la cola?")) onRemoveVideo(video.id); }}>Eliminar</button>
      </div>
    {pending && editor === "horario" && <QueueScheduleEditor video={video} now={now} onUpdateSchedule={onUpdateSchedule} close={() => setEditor(null)} />}
    {pending && editor === "portada" && <QueueCoverEditor video={video} captureFrame={captureFrame} onUpdateCover={onUpdateCover} close={() => setEditor(null)} />}
    {video.error && <p className="mt-3 break-words text-xs text-red-300">{video.error}</p>}
    {results.length > 0 && <ul aria-label="Resultados por plataforma" className="mt-3 grid gap-1.5 border-t border-white/[0.08] pt-3">{results.map((result) => <li key={result.platform} title={stamp.format(result.finishedAt)} className={`flex flex-wrap items-baseline gap-1.5 text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}>
      <span aria-label={result.ok ? "Publicado" : "Error"}>{result.ok ? "✓" : "✕"}</span><strong>{platformName(result.platform)}</strong>
      {result.ok ? result.postUrl ? <a className={`rounded underline underline-offset-2 ${focus}`} href={result.postUrl} target="_blank" rel="noopener noreferrer">Ver publicación</a> : "Publicado" : (result.error ?? "No se ha podido publicar.")}
    </li>)}</ul>}
  </motion.li>;
}

function LoadingStudio() {
  return <div role="status" className="space-y-5 motion-safe:animate-pulse"><span className="sr-only">Cargando el estudio de vídeo…</span>
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`${glass} h-28 p-4`}><div className="h-4 w-2/3 rounded bg-white/10" /><div className="mt-3 h-2 w-3/4 rounded bg-white/5" /></div>)}</div>
    <div aria-hidden="true" className={`${glass} h-64 p-5`}><div className="h-5 w-44 rounded bg-white/10" /><div className="mt-5 h-36 rounded-xl bg-white/[0.025]" /></div>
  </div>;
}

export function VideoStudioSection(props: VideoStudioSectionProps) {
  const { broadcast, platforms, ready } = props;
  const prefix = useId();
  const pickerId = prefix + "-archivo";
  const rowPrefix = prefix + "-video-";
  const dated = broadcast.queue.filter((v) => v.scheduleMode === "fecha").sort((a, b) => (a.publishAt ?? Infinity) - (b.publishAt ?? Infinity) || a.createdAt - b.createdAt);
  const live = broadcast.queue.filter((v) => v.scheduleMode !== "fecha").sort((a, b) => a.triggerMinute - b.triggerMinute || a.createdAt - b.createdAt);
  const sorted = [...dated, ...live];
  return <MotionConfig reducedMotion="user" transition={spring}>
    <div lang="es" className="h-full w-full overflow-x-hidden overflow-y-auto bg-[#0A0A0F] text-zinc-100 [color-scheme:dark]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 p-4 sm:gap-6 sm:p-6 xl:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3"><span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300"><Icon name="signal" className="size-6" /></span>
            <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Estudio de Vídeo</h1><p className="mt-1 text-sm text-zinc-400">Publica en tus redes ahora, a una hora concreta o durante el directo.</p></div>
          </div>
          <p className="flex max-w-sm items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs leading-relaxed text-amber-200"><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-400" />Modo simulación: las publicaciones no salen todavía a las redes reales</p>
        </header>
        <MasterControl broadcast={broadcast} ready={ready} now={props.now} onStartBroadcast={props.onStartBroadcast} onStopBroadcast={props.onStopBroadcast} onResetBroadcast={props.onResetBroadcast} />
        {!ready ? <LoadingStudio /> : <>
          <section><Heading aside={`${platforms.filter((p) => p.connected).length} de ${platforms.length} conectadas`}>Conexiones</Heading>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] items-start gap-3">{platforms.map((p) => <PlatformCard key={p.id} platform={p} onConnectPlatform={props.onConnectPlatform} onDisconnectPlatform={props.onDisconnectPlatform} />)}</div>
          </section>
          <Composer pickerId={pickerId} platforms={platforms} now={props.now} captureFrame={props.captureFrame} mentionSuggestions={props.mentionSuggestions} validateDraft={props.validateDraft} onScheduleVideo={props.onScheduleVideo} />
          <Timeline videos={live} elapsed={broadcast.elapsedSeconds} maximum={props.timelineMaxMinute} platforms={platforms} rowPrefix={rowPrefix} />
          <Agenda videos={dated} platforms={platforms} now={props.now} rowPrefix={rowPrefix} pickerId={pickerId} />
          <section className={`${glass} p-4 sm:p-6`}><Heading aside={`${sorted.length} ${sorted.length === 1 ? "vídeo" : "vídeos"}`}>Cola de publicación</Heading>
            <ul className="space-y-3"><AnimatePresence initial={false}>{sorted.map((video) => <QueueRow key={video.id} rowId={rowPrefix + encodeURIComponent(video.id)} video={video} platforms={platforms}
              now={props.now} captureFrame={props.captureFrame} onTogglePlatform={props.onTogglePlatform} onPublishNow={props.onPublishNow}
              onUpdateSchedule={props.onUpdateSchedule} onUpdateCover={props.onUpdateCover} onRemoveVideo={props.onRemoveVideo} onRetryVideo={props.onRetryVideo} onUpdateTriggerMinute={props.onUpdateTriggerMinute} />)}</AnimatePresence></ul>
            {!sorted.length && <div className="flex flex-col items-center rounded-xl border border-dashed border-white/10 px-4 py-8 text-center"><Icon name="queue" className="mb-3 size-8 text-rose-300/80" />
              <p className="text-sm font-medium">Aún no hay vídeos programados</p><p className="mt-1 text-xs text-zinc-400">Añade un vídeo en el formulario y elige cuándo publicarlo.</p>
              <button type="button" className={`${smallButton} mt-3`} onClick={() => document.getElementById(pickerId)?.focus()}>Ir al formulario</button>
            </div>}
          </section>
        </>}
      </div>
    </div>
  </MotionConfig>;
}

export default VideoStudioSection;
