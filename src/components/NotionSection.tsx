"use client";

import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  Check, ChevronRight, CircleAlert, CloudUpload, Code, Download, File, FileArchive,
  FileAudio, FileImage, FilePlus, FileText, FileVideo, Folder, FolderOpen, FolderPlus,
  GripVertical, Heading1, Heading2, Library, List, ListTodo, LoaderCircle, Minus,
  NotebookPen, Paperclip, Pencil, Plus, Quote, SmilePlus, Trash2, Type,
} from "lucide-react";
import type {
  AttachmentMeta, Id, NoteBlock, NoteBlockType, NoteItem, NotionSectionProps,
  SaveStatus, WorkspaceTreeNode,
} from "@/types/workspace";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const focus = "outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60";
const subtleButton = "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100";
const reveal = "[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity";
const treeMime = "application/x-crisworkspace-item";
const glow = "bg-violet-500/15 ring-1 ring-inset ring-violet-400 shadow-[0_0_16px_#8b5cf634]";
const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });
const numberFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const emojis = ["📝","📌","💡","✅","📚","🎯","🔥","⭐","🧠","🗂️","📅","💼","🎬","🎨","🧪","🚀","❤️","🌱","⚡","🔒","📈","🛠️","🎵","🏆"];
const blockTypes = {
  paragraph: { label: "Texto", icon: Type }, heading1: { label: "Título 1", icon: Heading1 },
  heading2: { label: "Título 2", icon: Heading2 }, todo: { label: "Lista de tareas", icon: ListTodo },
  bullet: { label: "Viñeta", icon: List }, quote: { label: "Cita", icon: Quote },
  code: { label: "Código", icon: Code }, divider: { label: "Separador", icon: Minus },
} satisfies Record<NoteBlockType, { label: string; icon: typeof Type }>;

function IconButton({ label, children, onClick, expanded }: {
  label: string; children: ReactNode; onClick: () => void; expanded?: boolean;
}) {
  return <motion.button type="button" aria-label={label} title={label} aria-expanded={expanded}
    onClick={onClick} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={spring}
    className={`grid size-7 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100 [&_svg]:size-4 ${focus}`}>
    {children}
  </motion.button>;
}

function EmptyState({ tree = false, create }: { tree?: boolean; create: () => void }) {
  return <div className="m-auto flex flex-col items-center px-4 py-8 text-center">
    <div aria-hidden="true" className="relative mb-5 grid size-16 place-items-center">
      <div className="absolute inset-2 -rotate-12 rounded-xl border border-violet-400/25 bg-violet-500/10" />
      <div className="relative grid size-12 rotate-3 place-items-center rounded-xl border border-violet-300/20 bg-[#231d35] text-violet-300 shadow-[0_8px_24px_#08060d,inset_0_1px_0_#ffffff14]">
        {tree ? <Library size={24} /> : <NotebookPen size={24} />}
      </div>
    </div>
    <p className="text-sm font-medium text-zinc-300">{tree ? "Tu espacio está vacío" : "Selecciona o crea una nota"}</p>
    <button type="button" onClick={create} className={`mt-3 inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-400/20 ${focus}`}>
      <Plus size={14} />{tree ? "Crear primera nota" : "Nueva nota"}
    </button>
  </div>;
}

function Skeleton() {
  const reduced = useReducedMotion();
  return <div role="status" aria-label="Cargando organización" className="space-y-3 p-4">
    {[72, 55, 81, 63, 48, 69].map((width, index) => <div key={width} className="flex items-center gap-3">
      <div className="size-5 rounded-md bg-white/[0.05]" />
      <motion.div style={{ width: width + "%", backgroundSize: "220% 100%" }}
        animate={reduced ? undefined : { backgroundPosition: ["180% 0%", "-40% 0%"] }}
        transition={{ duration: 1.6, repeat: Infinity, delay: index * 0.07 }}
        className="h-2.5 rounded bg-[linear-gradient(100deg,#ffffff08_30%,#ffffff18_50%,#ffffff08_70%)]" />
    </div>)}
  </div>;
}

function RenameInput({ name, finish }: { name: string; finish: (name?: string) => void }) {
  const done = useRef(false);
  function end(value?: string) {
    if (done.current) return;
    done.current = true;
    finish(value?.trim() || undefined);
  }
  return <input aria-label="Nombre de la carpeta" defaultValue={name} autoFocus
    onFocus={e => e.currentTarget.select()} onBlur={e => end(e.currentTarget.value)}
    onKeyDown={e => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); end(e.currentTarget.value); }
      if (e.key === "Escape") { e.preventDefault(); end(); }
    }}
    className={`min-w-0 flex-1 rounded border border-violet-400/40 bg-[#19171f] px-2 py-1 ${focus}`} />;
}

function treeDrop(target: Id | null, props: NotionSectionProps, highlight: (active: boolean) => void) {
  return {
    onDragOver(e: DragEvent<HTMLElement>) {
      if (!e.dataTransfer.types.includes(treeMime)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      highlight(true);
    },
    onDragLeave(e: DragEvent<HTMLElement>) {
      if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) highlight(false);
    },
    onDrop(e: DragEvent<HTMLElement>) {
      if (!e.dataTransfer.types.includes(treeMime)) return;
      e.preventDefault();
      highlight(false);
      const id = e.dataTransfer.getData(treeMime);
      if (id) props.onMoveItem(id, target);
    },
  };
}

function nodeId(node: WorkspaceTreeNode) {
  return node.kind === "folder" ? node.folder.id : node.note.id;
}

function TreeRow({ node, props, select }: {
  node: WorkspaceTreeNode; props: NotionSectionProps; select: (id: Id) => void;
}) {
  const reduced = useReducedMotion();
  const [renaming, setRenaming] = useState(false);
  const [over, setOver] = useState(false);
  const folder = node.kind === "folder" ? node.folder : null;
  const note = node.kind === "note" ? node.note : null;
  const id = nodeId(node);
  const expanded = !!folder && props.expandedFolderIds.includes(id);
  const selected = !!note && props.selectedNote?.id === id;
  const label = folder?.name || note?.title || "Sin título";
  return <li>
    <div style={{ marginInlineStart: node.depth * 12 }} className={node.depth ? "border-l border-white/[0.08] pl-1" : ""}>
      <div draggable={!renaming} onDragStart={e => {
        e.dataTransfer.setData(treeMime, id);
        e.dataTransfer.effectAllowed = "move";
      }} onDragEnd={() => setOver(false)} {...(folder ? treeDrop(id, props, setOver) : {})}
        className={`group relative flex min-h-9 items-center rounded-lg px-1 text-sm ${over ? glow : selected ? "bg-violet-500/[0.14] text-violet-200 shadow-[inset_2px_0_0_#a78bfa]" : "text-zinc-400 hover:bg-white/[0.04]"}`}>
        {renaming && folder ? <RenameInput name={folder.name} finish={value => {
          if (value && value !== folder.name) props.onRenameFolder(id, value);
          setRenaming(false);
        }} /> : <>
          <button type="button" title={label} aria-expanded={folder ? expanded : undefined}
            aria-current={selected ? "page" : undefined} onClick={() => folder ? props.onToggleFolder(id) : select(id)}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 pl-1.5 text-left ${focus}`}>
            {folder ? <>
              <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={reduced ? { duration: 0 } : spring}><ChevronRight size={12} /></motion.span>
              {expanded ? <FolderOpen size={16} className="shrink-0 text-violet-300" /> : <Folder size={16} className="shrink-0 text-zinc-400" />}
            </> : <span className="ml-1 grid w-5 shrink-0 place-items-center">{note?.icon || <FileText size={15} />}</span>}
            <span className={`truncate ${note && !note.title ? "text-zinc-500" : ""}`}>{label}</span>
          </button>
          <div className={`flex items-center rounded-md [@media(hover:hover)]:absolute [@media(hover:hover)]:right-1 [@media(hover:hover)]:bg-[#211e2a] [@media(hover:hover)]:pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto ${reveal}`}>
            {folder && <>
              <IconButton label={`Nueva nota en ${label}`} onClick={() => props.onCreateNote(id)}><FilePlus /></IconButton>
              <IconButton label={`Nueva subcarpeta en ${label}`} onClick={() => props.onCreateFolder(id)}><FolderPlus /></IconButton>
              <IconButton label={`Renombrar ${label}`} onClick={() => setRenaming(true)}><Pencil /></IconButton>
            </>}
            <IconButton label={`Borrar ${label}`} onClick={() => {
              if (window.confirm(folder ? "¿Borrar la carpeta y todo su contenido?" : "¿Borrar esta nota?")) props.onDeleteItem(id);
            }}><Trash2 /></IconButton>
          </div>
        </>}
      </div>
    </div>
    <AnimatePresence initial={false}>
      {node.kind === "folder" && expanded && <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }} transition={{ duration: reduced ? 0 : 0.18 }} className="overflow-hidden">
        {node.children.map(child => <TreeRow key={nodeId(child)} node={child} props={props} select={select} />)}
      </motion.ul>}
    </AnimatePresence>
  </li>;
}

function TreePanel({ props }: { props: NotionSectionProps }) {
  const [open, setOpen] = useState(true);
  const [over, setOver] = useState(false);
  const panelId = useId();
  function select(id: Id) {
    props.onSelectNote(id);
    setOpen(false);
  }
  return <aside className="flex max-h-[40%] min-h-0 shrink-0 flex-col border-b border-white/[0.08] bg-white/[0.025] md:h-full md:max-h-none md:w-[clamp(230px,25%,280px)] md:border-r md:border-b-0">
    <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
      <span className="grid size-8 place-items-center rounded-lg border border-violet-400/20 bg-linear-to-br from-violet-500/25 to-indigo-600/10 text-violet-300"><Library size={17} /></span>
      <h2 className="min-w-0 flex-1 text-sm font-semibold tracking-tight">
        <span className="hidden md:inline">Organización</span>
        <button type="button" aria-controls={panelId} aria-expanded={open} onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 rounded py-2 md:hidden ${focus}`}>Organización<ChevronRight size={14} className={open ? "rotate-90" : ""} /></button>
      </h2>
      <IconButton label="Nueva nota" onClick={() => props.onCreateNote(null)}><FilePlus /></IconButton>
      <IconButton label="Nueva carpeta" onClick={() => props.onCreateFolder(null)}><FolderPlus /></IconButton>
    </div>
    <div id={panelId} className={`min-h-0 flex-1 flex-col md:flex ${open ? "flex" : "hidden"}`}>
      {!props.ready ? <Skeleton /> : props.tree.length ? <>
        <nav aria-label="Notas y carpetas" className="min-h-0 flex-1 overflow-auto p-2">
          <ul>{props.tree.map(node => <TreeRow key={nodeId(node)} node={node} props={props} select={select} />)}</ul>
          <div {...treeDrop(null, props, setOver)} className={`mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-2 py-3 text-center text-[11px] text-zinc-400 ${over ? glow : ""}`}>
            <Folder size={13} />Soltar aquí para mover a la raíz
          </div>
        </nav>
      </> : <div className="overflow-y-auto"><EmptyState tree create={() => props.onCreateNote(null)} /></div>}
    </div>
  </aside>;
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const saving = status === "pending" || status === "saving";
  return <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1.5 text-xs">
    {saving && <><LoaderCircle size={13} className="text-violet-300 motion-safe:animate-spin" />Guardando…</>}
    {status === "saved" && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex items-center gap-1.5"><Check size={13} className="text-emerald-400" />Guardado</motion.span>}
    {status === "error" && <span className="flex items-center gap-1.5 text-red-400"><CircleAlert size={13} />Error al guardar</span>}
  </span>;
}

function EmojiPicker({ icon, update }: { icon: string | null; update: (value: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return <div className="relative w-fit" onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  }} onKeyDown={e => { if (open && e.key === "Escape") { e.preventDefault(); close(); } }}>
    <motion.button type="button" ref={trigger} aria-label="Cambiar icono de la nota" title="Cambiar icono de la nota"
      aria-expanded={open} onClick={() => setOpen(!open)} whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }} transition={spring}
      className={`grid size-14 place-items-center rounded-2xl border border-violet-400/20 bg-linear-to-br from-violet-400/15 to-indigo-400/[0.04] text-3xl text-violet-300 shadow-[inset_0_1px_0_#ffffff12] ${focus}`}>
      {icon || <SmilePlus size={25} strokeWidth={1.5} />}
    </motion.button>
    {open && <div role="group" aria-label="Iconos de la nota"
      className="absolute top-full left-0 z-30 mt-2 w-60 rounded-xl border border-white/10 bg-[#201d2a] p-2 shadow-2xl">
      <div className="grid grid-cols-6 gap-1">{emojis.map(emoji => <button key={emoji} type="button"
        aria-label={`Usar ${emoji}`} aria-pressed={icon === emoji} onClick={() => { update(emoji); close(); }}
        className={`rounded-md py-1 text-lg hover:bg-white/10 aria-pressed:bg-violet-500/20 ${focus}`}>{emoji}</button>)}</div>
      <button type="button" onClick={() => { update(null); close(); }} className={`mt-2 w-full border-t border-white/10 ${subtleButton} ${focus}`}>Quitar icono</button>
    </div>}
  </div>;
}

function TodoCheck({ checked, toggle }: { checked: boolean; toggle: () => void }) {
  const reduced = useReducedMotion();
  return <motion.button type="button" role="checkbox" aria-checked={checked}
    aria-label={checked ? "Marcar tarea como pendiente" : "Completar tarea"}
    whileTap={reduced ? undefined : { scale: 0.85 }} transition={spring} onClick={toggle}
    className={`mt-1.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border ${focus} ${checked ? "border-violet-400 bg-violet-500" : "border-zinc-600 bg-white/[0.03]"}`}>
    <svg viewBox="0 0 18 18" className="size-4" fill="none" aria-hidden="true">
      <motion.path d="m4 9 3.2 3.2L14 5.8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        initial={false} animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.18 }} />
    </svg>
  </motion.button>;
}

const textStyles: Record<NoteBlockType, string> = {
  paragraph: "", heading1: "text-3xl leading-tight font-bold tracking-tight", heading2: "text-2xl leading-tight font-semibold tracking-tight",
  todo: "", bullet: "", quote: "border-l-2 border-violet-400/70 pl-3 italic text-violet-100",
  code: "rounded-lg border border-white/[0.07] bg-black/30 p-3 font-mono text-sm leading-6 text-indigo-200",
  divider: "",
};

function BlockRow({ block, props, note, index, pendingFocus, requestFocus }: {
  block: NoteBlock; props: NotionSectionProps; note: NoteItem; index: number;
  pendingFocus: Id | null; requestFocus: (id: Id | null) => void;
}) {
  const reduced = useReducedMotion();
  const [menu, setMenu] = useState<"add" | "switch" | null>(null);
  const [focused, setFocused] = useState(false);
  function add(type: NoteBlockType) {
    requestFocus(props.onAddBlock(note.id, block.id, type));
  }
  function focusField(element: HTMLTextAreaElement | HTMLDivElement | null) {
    if (element && pendingFocus === block.id) {
      element.focus();
      if (element instanceof HTMLTextAreaElement) element.setSelectionRange(element.value.length, element.value.length);
      requestFocus(null);
    }
  }
  function remove() {
    const neighbor = note.blocks[index - 1] ?? note.blocks[index + 1];
    props.onDeleteBlock(note.id, block.id);
    requestFocus(neighbor?.id ?? null);
  }
  return <motion.div layout={reduced ? false : "position"} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.15 }}
    className="group relative rounded-lg py-1"
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setMenu(null); }}
    onKeyDown={e => {
      if (e.key === "Escape" && menu) { e.preventDefault(); setMenu(null); requestFocus(block.id); }
    }}>
    <div className="flex items-start gap-1.5">
      <div className={`flex shrink-0 items-center ${menu ? "" : reveal}`}>
        <IconButton label="Añadir bloque después" expanded={menu === "add"} onClick={() => setMenu(menu === "add" ? null : "add")}><Plus /></IconButton>
        <IconButton label="Cambiar tipo de bloque" expanded={menu === "switch"} onClick={() => setMenu(menu === "switch" ? null : "switch")}><GripVertical /></IconButton>
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {block.type === "todo" && <TodoCheck checked={block.checked} toggle={() => props.onUpdateBlock(note.id, block.id, { checked: !block.checked })} />}
        {block.type === "bullet" && <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-violet-300" />}
        {block.type === "divider" ? <div tabIndex={-1} ref={focusField} role="separator" aria-label="Separador" className={`flex h-8 w-full items-center rounded ${focus}`}><span className="h-px w-full bg-white/15" /></div>
          : <textarea rows={1} ref={focusField} aria-label={`${blockTypes[block.type].label}, bloque ${index + 1}`}
            placeholder={focused && block.type === "paragraph" ? "Escribe algo, o pulsa / para comandos" : undefined}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} value={block.text}
            onChange={e => {
              if (!block.text && e.target.value === "/") setMenu("switch");
              else props.onUpdateBlock(note.id, block.id, { text: e.target.value });
            }}
            onKeyDown={e => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add("paragraph"); }
              if (e.key === "Backspace" && !block.text && note.blocks.length > 1) { e.preventDefault(); remove(); }
              if (e.key === "/" && !block.text) { e.preventDefault(); setMenu("switch"); }
            }}
            className={`min-h-8 w-full min-w-0 resize-none bg-transparent py-0.5 leading-7 outline-none transition-colors placeholder:text-zinc-500 focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-violet-400/40 [field-sizing:content] ${textStyles[block.type]} ${block.type === "todo" && block.checked ? "text-zinc-500 line-through" : ""}`} />}
      </div>
      <div className={reveal}><IconButton label="Borrar bloque" onClick={remove}><Trash2 /></IconButton></div>
    </div>
    {menu && <div role="group" aria-label={menu === "add" ? "Añadir bloque" : "Cambiar tipo de bloque"}
      className="my-1 grid max-w-sm grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#1c1925] p-2 shadow-xl">
      {(Object.keys(blockTypes) as NoteBlockType[]).map((type, i) => {
        const { icon: Icon, label } = blockTypes[type];
        return <button key={type} type="button" autoFocus={i === 0} onClick={() => {
          if (menu === "add") add(type);
          else { props.onUpdateBlock(note.id, block.id, { type }); requestFocus(block.id); }
          setMenu(null);
        }} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/[0.06] ${focus}`}>
          <Icon size={15} className="text-violet-300" />{label}
          {menu === "switch" && block.type === type && <Check size={12} className="ml-auto text-violet-300" />}
        </button>;
      })}
    </div>}
  </motion.div>;
}

function AttachmentIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <FileImage size={18} />;
  if (mime.startsWith("video/")) return <FileVideo size={18} />;
  if (mime.startsWith("audio/")) return <FileAudio size={18} />;
  if (mime === "application/pdf") return <FileText size={18} />;
  if (/zip|compressed|archive|rar|tar|bzip|xz/.test(mime)) return <FileArchive size={18} />;
  return <File size={18} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return numberFormat.format(bytes) + " B";
  if (bytes < 1024 ** 2) return numberFormat.format(bytes / 1024) + " KB";
  return numberFormat.format(bytes / 1024 ** 2) + " MB";
}

function AttachmentCard({ file, index, download, remove }: {
  file: AttachmentMeta; index: number; download: () => void; remove: () => void;
}) {
  const reduced = useReducedMotion();
  return <motion.li layout={reduced ? false : "position"} initial={{ opacity: 0, y: reduced ? 0 : 5 }}
    animate={{ opacity: 1, y: 0, transition: { duration: 0.18, delay: reduced ? 0 : Math.min(index, 5) * 0.035 } }}
    exit={{ opacity: 0 }} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] p-2.5 shadow-[inset_0_1px_0_#ffffff0d] backdrop-blur-xl">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-400/10 text-indigo-300"><AttachmentIcon mime={file.mimeType} /></span>
    <div className="min-w-0 flex-1">
      <p title={file.name} className="truncate text-sm text-zinc-200">{file.name}</p>
      <p className="font-mono text-[10px] leading-4 text-zinc-400 tabular-nums">{formatSize(file.sizeBytes)} · {dateFormat.format(file.createdAt)}</p>
    </div>
    <IconButton label={`Descargar ${file.name}`} onClick={download}><Download /></IconButton>
    <IconButton label={`Borrar ${file.name}`} onClick={remove}><Trash2 /></IconButton>
  </motion.li>;
}

function Attachments({ note, props }: { note: NoteItem; props: NotionSectionProps }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const reduced = useReducedMotion();
  function upload(files: FileList | null) {
    if (files?.length) props.onUploadFiles(note.id, Array.from(files));
  }
  return <section aria-label="Archivos adjuntos" className="mt-10 border-t border-white/[0.08] pt-5">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300"><Paperclip size={15} className="text-zinc-400" />Adjuntos
      {!!note.attachments.length && <span className="font-mono text-xs text-zinc-500 tabular-nums">{note.attachments.length}</span>}
    </h3>
    <input type="file" multiple ref={input} aria-label="Subir archivos adjuntos" className="hidden"
      onChange={e => { upload(e.currentTarget.files); e.currentTarget.value = ""; }} />
    <motion.button type="button" onClick={() => input.current?.click()}
      onDragOver={e => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(true);
      }}
      onDragLeave={e => {
        if (e.dataTransfer.types.includes("Files") && !(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setOver(false);
      }}
      onDrop={e => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault(); setOver(false); upload(e.dataTransfer.files);
      }}
      animate={{ scale: over && !reduced ? 1.01 : 1 }} transition={spring}
      className={`relative isolate flex min-h-24 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed px-4 py-5 text-center text-xs transition-colors ${focus} ${over ? "border-violet-300 bg-violet-500/10 text-violet-200 shadow-[0_0_22px_#8b5cf62b]" : "border-violet-400/30 bg-violet-400/[0.035] text-zinc-400 hover:border-violet-400/60 hover:text-violet-200"}`}>
      {over && <motion.span aria-hidden="true" style={{ backgroundSize: "220% 100%" }}
        animate={reduced ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-[linear-gradient(105deg,#8b5cf6,#a78bfa33,#6366f1,#8b5cf6)] p-px [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [mask-composite:exclude]" />}
      <CloudUpload size={23} strokeWidth={1.5} className="pointer-events-none text-violet-300" />
      <span className="pointer-events-none">{over ? "Suelta los archivos aquí" : "Arrastra archivos o haz clic para subir"}</span>
    </motion.button>
    <ul className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-2">
      <AnimatePresence>{note.attachments.map((file, index) => <AttachmentCard key={file.id} file={file} index={index}
        download={() => props.onDownloadAttachment(note.id, file.id)} remove={() => props.onDeleteAttachment(note.id, file.id)} />)}</AnimatePresence>
    </ul>
  </section>;
}

function NoteEditor({ note, props }: { note: NoteItem; props: NotionSectionProps }) {
  const [pendingFocus, setPendingFocus] = useState<Id | null>(null);
  return <>
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 text-xs text-zinc-400 md:px-6">
      <div className="flex min-w-0 items-center gap-2"><Library size={14} className="shrink-0 text-violet-300" />
        <span>Organización</span><span className="text-zinc-600">/</span><span className="truncate text-zinc-300">{note.title || "Sin título"}</span>
      </div>
      <SaveIndicator status={props.saveStatus} />
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <article className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-7 md:py-10 xl:px-12">
        <EmojiPicker icon={note.icon} update={value => props.onUpdateIcon(note.id, value)} />
        <input value={note.title} onChange={e => props.onUpdateTitle(note.id, e.currentTarget.value)}
          aria-label="Título de la nota" placeholder="Sin título"
          className={`mt-4 w-full rounded-md bg-transparent py-1 text-3xl font-semibold tracking-tight text-zinc-100 placeholder:text-zinc-500 md:text-4xl ${focus}`} />
        <p title={`Creada el ${dateFormat.format(note.createdAt)}`} className="mt-2 text-xs text-zinc-500">
          Última edición · <time dateTime={new Date(note.updatedAt).toISOString()} className="font-mono tabular-nums">{dateFormat.format(note.updatedAt)}</time>
        </p>
        <div className="mt-6 border-t border-white/[0.08] pt-4">
          <AnimatePresence initial={false}>{note.blocks.map((block, index) => <BlockRow key={block.id}
            block={block} index={index} note={note} props={props} pendingFocus={pendingFocus} requestFocus={setPendingFocus} />)}</AnimatePresence>
          <button type="button" className={`mt-2 ${subtleButton} ${focus}`}
            onClick={() => setPendingFocus(props.onAddBlock(note.id, null, "paragraph"))}><Plus size={15} />Añadir bloque</button>
        </div>
        <Attachments note={note} props={props} />
      </article>
    </div>
  </>;
}

export function NotionSection(props: NotionSectionProps) {
  return <MotionConfig reducedMotion="user" transition={spring}>
    <section aria-label="Organización" className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0F] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:flex-row">
      <TreePanel props={props} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top_right,#8b5cf608,transparent_60%)]">
        {!props.ready ? <div className="mx-auto w-full max-w-xl pt-8"><Skeleton /></div>
          : props.selectedNote ? <NoteEditor key={props.selectedNote.id} note={props.selectedNote} props={props} />
          : <EmptyState create={() => props.onCreateNote(null)} />}
      </div>
    </section>
  </MotionConfig>;
}

export default NotionSection;
