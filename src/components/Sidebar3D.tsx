"use client";

import dynamic from "next/dynamic";
import { Component, Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { Color, Group, MeshPhysicalMaterial } from "three";
import {
  AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { Clapperboard, FolderTree, PanelLeftClose, PanelLeftOpen, Settings, type LucideIcon } from "lucide-react";
import type { Sidebar3DProps, WorkspaceSection } from "@/types/workspace";

const sections = {
  organizacion: {
    label: "Organización", icon: FolderTree, color: "#8B5CF6", emissive: "#6366F1", speed: 0.25, next: "estudio",
    pill: "border-violet-400/20 from-violet-500/20 to-indigo-400/[0.05]", iconColor: "text-violet-300",
  },
  estudio: {
    label: "Estudio de Vídeo", icon: Clapperboard, color: "#F43F5E", emissive: "#FB923C", speed: 1.1, next: "organizacion",
    pill: "border-rose-400/20 from-rose-500/20 to-orange-400/[0.04]", iconColor: "text-rose-300",
  },
  ajustes: {
    label: "Ajustes", icon: Settings, color: "#2DD4BF", emissive: "#14B8A6", speed: 0.6, next: "organizacion",
    pill: "border-[#2DD4BF]/20 from-[#2DD4BF]/20 to-teal-400/[0.04]", iconColor: "text-[#2DD4BF]",
  },
} as const satisfies Record<WorkspaceSection, {
  label: string; icon: LucideIcon; color: string; emissive: string; speed: number;
  next: WorkspaceSection; pill: string; iconColor: string;
}>;
const sectionOrder: WorkspaceSection[] = ["organizacion", "estudio", "ajustes"];
const spring = { type: "spring", stiffness: 400, damping: 32 } as const;
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400/60";

type SceneProps = {
  section: WorkspaceSection;
  live: boolean;
  reduced: boolean;
  hovered: MotionValue<number>;
  pitch: MotionValue<number>;
  yaw: MotionValue<number>;
};

function Orb({ section, live, reduced, hovered, pitch, yaw }: SceneProps) {
  const [initialSection] = useState(section);
  const group = useRef<Group>(null);
  const surface = useRef<MeshPhysicalMaterial>(null);
  const target = useRef(sections[section]);
  const animation = useRef({ speed: sections[section].speed as number, angle: 0.35, time: 0 });
  const colors = useRef<{ body: Color; glow: Color } | null>(null);

  useEffect(() => {
    target.current = sections[section];
    colors.current = { body: new Color(target.current.color), glow: new Color(target.current.emissive) };
  }, [section]);

  useFrame((_, delta) => {
    if (!group.current || !surface.current || !colors.current) return;
    const dt = Math.min(delta, 0.08);
    const blend = 1 - Math.exp(-6 * dt);
    const state = animation.current;
    const hover = hovered.get();
    const speed = target.current.speed * (1 + hover * 0.8);
    state.speed = reduced ? 0 : state.speed + (speed - state.speed) * blend;
    state.angle += state.speed * dt;
    state.time += dt;
    group.current.rotation.set(-0.16 + pitch.get(), state.angle + yaw.get(), -0.18);
    const pulse = live && !reduced ? 0.035 * Math.sin(state.time * 4) : 0;
    const scale = 1 + hover * 0.06 + pulse;
    group.current.scale.setScalar(group.current.scale.x + (scale - group.current.scale.x) * blend);
    surface.current.color.lerp(colors.current.body, blend);
    surface.current.emissive.lerp(colors.current.glow, blend);
  });

  return (
    <Float enabled={!reduced} speed={1.3} rotationIntensity={0.12} floatIntensity={0.2} floatingRange={[-0.12, 0.12]}>
      <group ref={group}>
        <mesh>
          <icosahedronGeometry args={[0.94, 1]} />
          <meshPhysicalMaterial ref={surface} color={sections[initialSection].color}
            emissive={sections[initialSection].emissive} emissiveIntensity={0.16}
            metalness={0.34} roughness={0.24} clearcoat={1} clearcoatRoughness={0.16} flatShading />
        </mesh>
        <mesh rotation={[0.12, 0.2, 0]}>
          <icosahedronGeometry args={[1.055, 1]} />
          <meshBasicMaterial color="#f2eaff" wireframe transparent opacity={0.21} depthWrite={false} />
        </mesh>
      </group>
    </Float>
  );
}

function OrbFallback() {
  return <span aria-hidden className="absolute inset-0 m-auto aspect-square h-[65%] rounded-full bg-[radial-gradient(circle_at_32%_24%,white,currentColor_32%,#171324_85%)]" />;
}

function FlatLogo({ reduced }: { reduced: boolean }) {
  return (
    <>
      <style>{`@keyframes cris-sidebar-logo-breathe {
        0%, 100% { transform: scale(1) }
        50% { transform: scale(1.035) }
      }`}</style>
      <span aria-hidden
        className={`absolute inset-0 m-auto aspect-square h-[65%] rounded-full bg-[radial-gradient(circle_at_32%_24%,white,currentColor_32%,#171324_85%)] shadow-[0_0_18px_color-mix(in_srgb,currentColor_35%,transparent)] ${reduced ? "" : "motion-safe:animate-[cris-sidebar-logo-breathe_5s_ease-in-out_infinite]"}`} />
    </>
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <OrbFallback /> : this.props.children; }
}

function Scene(props: SceneProps) {
  return (
    <SceneBoundary>
      <Canvas dpr={[1, 1.75]} gl={{ alpha: true, antialias: true }} frameloop="always"
        camera={{ position: [0, 0, 4.8], fov: 37 }} fallback={<OrbFallback />}>
        <ambientLight intensity={0.85} />
        <pointLight position={[-2.8, 3.6, 3.5]} intensity={46} color="#fff6fa" />
        <pointLight position={[3, 0.8, 2]} intensity={18} color="#c9d7ff" />
        <pointLight position={[0, -2.2, -1.6]} intensity={14} color="#ffd2dd" />
        <Orb {...props} />
      </Canvas>
    </SceneBoundary>
  );
}

const ClientScene = dynamic(() => Promise.resolve(Scene), { ssr: false, loading: OrbFallback });

function OrbControl({ section, collapsed, live, reduced, show3DOrb, onChange }: {
  section: WorkspaceSection; collapsed: boolean; live: boolean; reduced: boolean; show3DOrb: boolean;
  onChange: Sidebar3DProps["onSectionChange"];
}) {
  const hovered = useMotionValue(0);
  const pitch = useMotionValue(0);
  const yaw = useMotionValue(0);
  const drag = useRef<{ id: number; x: number; y: number; pitch: number; yaw: number } | null>(null);
  const dragged = useRef(false);
  const next = sections[section].next;
  const label = `Cambiar a ${sections[next].label}`;

  return (
    <div className={`relative isolate w-full overflow-hidden ${collapsed ? "h-14" : "h-[180px]"}`}
      style={{ color: sections[section].color }}>
      <motion.div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse closest-side, currentColor, transparent)" }}
        animate={{ opacity: reduced || !show3DOrb ? 0.22 : [0.16, 0.29, 0.16] }}
        transition={reduced || !show3DOrb ? { duration: 0 } : { duration: 5, ease: "easeInOut", repeat: Infinity }} />
      {!collapsed && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="absolute h-[68%] w-[78%] -rotate-[21deg] rounded-[50%] border border-current/15" />
          <span className="absolute h-[58%] w-[72%] rotate-[24deg] rounded-[50%] border border-white/[0.045]" />
        </div>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {show3DOrb
          ? <ClientScene section={section} live={live} reduced={reduced} hovered={hovered} pitch={pitch} yaw={yaw} />
          : <FlatLogo reduced={reduced} />}
      </div>
      <button type="button" title={label} aria-label={label}
        className={`absolute inset-0 m-auto aspect-square h-[84%] rounded-full ${show3DOrb ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${focus}`}
        onPointerEnter={() => hovered.set(1)} onPointerLeave={() => hovered.set(0)}
        onPointerDown={event => {
          if (!show3DOrb || !event.isPrimary || event.button !== 0) return;
          dragged.current = false;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pitch: pitch.get(), yaw: yaw.get() };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (!dragged.current && Math.hypot(dx, dy) < 5) return;
          dragged.current = true;
          pitch.set(start.pitch + dy * 0.012);
          yaw.set(start.yaw + dx * 0.012);
        }}
        onLostPointerCapture={event => {
          if (drag.current?.id === event.pointerId) drag.current = null;
        }}
        onClick={event => {
          if (!show3DOrb || event.detail === 0 || !dragged.current) onChange(next);
        }} />
    </div>
  );
}

function quantity(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function Sidebar3D({ activeSection, onSectionChange, collapsed, onToggleCollapsed, stats, show3DOrb }: Sidebar3DProps) {
  const reduced = Boolean(useReducedMotion());
  const layoutId = useId();
  const toggleLabel = collapsed ? "Expandir menú" : "Contraer menú";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: reduced ? 0 : 0.15 } };
  const notes = quantity(stats.notes, "nota", "notas");
  const folders = quantity(stats.folders, "carpeta", "carpetas");
  const queue = `${quantity(stats.scheduledVideos, "vídeo", "vídeos")} en cola`;
  const badges = {
    organizacion: { count: stats.notes, description: notes },
    estudio: { count: stats.scheduledVideos, description: queue },
    ajustes: null,
  } satisfies Record<WorkspaceSection, { count: number; description: string } | null>;

  return (
    <motion.aside aria-label="Menú del espacio de trabajo" initial={false}
      animate={{ width: collapsed ? 76 : 264 }} transition={reduced ? { duration: 0 } : spring}
      className="relative isolate flex h-full w-full max-w-full shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-white/[0.08] bg-[#0A0A0F] text-zinc-100">
      <div className="flex min-h-full flex-col bg-linear-to-b from-white/[0.045] via-transparent to-white/[0.02] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
        <header className="shrink-0 border-b border-white/[0.08] pb-4">
          <OrbControl section={activeSection} collapsed={collapsed} live={stats.isLive} reduced={reduced} show3DOrb={show3DOrb} onChange={onSectionChange} />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div key="brand" {...fade} className="whitespace-nowrap pb-1 text-center">
                <p className="text-[22px] font-semibold leading-tight tracking-[-0.055em]">CrisWorkspace</p>
                <p className="mt-1 text-xs text-zinc-400">Todo en uno</p>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
        <LayoutGroup id={layoutId}>
          <nav aria-label="Secciones" className="flex flex-1 flex-col gap-1.5 pt-5">
            {sectionOrder.map(section => {
              const { label, icon: Icon, pill, iconColor } = sections[section];
              const active = section === activeSection;
              const live = section === "estudio" && stats.isLive;
              const badge = badges[section];
              const description = badge ? `${label}, ${badge.description}${live ? ", en directo" : ""}` : label;
              return (
                <Fragment key={section}>
                {section === "ajustes" && <hr aria-hidden className="mt-auto border-0 border-t border-white/[0.08]" />}
                <motion.button type="button" aria-current={active ? "page" : undefined}
                  title={collapsed ? description : undefined} aria-label={description} onClick={() => onSectionChange(section)}
                  whileHover={reduced ? undefined : { scale: 1.02 }} whileTap={reduced ? undefined : { scale: 0.97 }}
                  transition={spring} className={`relative isolate flex min-h-12 items-center gap-3 rounded-xl px-3 text-left hover:bg-white/[0.03] ${focus}`}>
                  {active && (
                    <motion.span layoutId="section-highlight" aria-hidden transition={reduced ? { duration: 0 } : spring}
                      className={`absolute inset-0 -z-10 rounded-xl border bg-linear-to-r shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${pill}`} />
                  )}
                  <span className={`relative grid size-6 shrink-0 place-items-center ${active ? iconColor : "text-zinc-400"}`}>
                    <Icon size={19} strokeWidth={1.7} aria-hidden />
                    {collapsed && live && <span aria-hidden className="absolute -right-0.5 top-0 size-2 rounded-full bg-rose-400 motion-safe:animate-pulse" />}
                  </span>
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span key="label" {...fade} className="flex min-w-0 flex-1 items-center justify-between gap-2 whitespace-nowrap py-2">
                        <span className="flex flex-col items-start gap-1">
                          <span className={`text-sm font-medium ${active ? "text-zinc-100" : "text-zinc-300"}`}>{label}</span>
                          {live && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.09em] text-rose-300">
                            <span className="size-1.5 rounded-full bg-rose-400 motion-safe:animate-pulse" />EN DIRECTO
                          </span>}
                        </span>
                        {badge && <span className="rounded-md border border-white/[0.08] bg-white/[0.035] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-zinc-300">
                          {badge.count}
                        </span>}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                </Fragment>
              );
            })}
          </nav>
        </LayoutGroup>
        <footer className="mt-auto shrink-0 pt-4">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div key="stats" {...fade} className="mb-3 space-y-2.5 whitespace-nowrap rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-xs text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className="flex items-center gap-2.5"><FolderTree size={14} aria-hidden className="text-violet-300" /><span className="font-mono tabular-nums">{notes} · {folders}</span></p>
                <p className="flex items-center gap-2.5"><Clapperboard size={14} aria-hidden className="text-orange-300" /><span className="font-mono tabular-nums">{queue}</span></p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="border-t border-white/[0.08] pt-2">
            <motion.button type="button" onClick={onToggleCollapsed} title={toggleLabel} aria-label={toggleLabel}
              aria-expanded={!collapsed} whileHover={reduced ? undefined : { scale: 1.02 }} whileTap={reduced ? undefined : { scale: 0.97 }}
              transition={spring} className={`flex min-h-11 w-full items-center gap-3 whitespace-nowrap rounded-xl px-4 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100 ${focus}`}>
              <ToggleIcon aria-hidden size={18} className="shrink-0" />
              <AnimatePresence initial={false}>
                {!collapsed && <motion.span key="toggle-label" {...fade}>Contraer menú</motion.span>}
              </AnimatePresence>
            </motion.button>
          </div>
        </footer>
      </div>
    </motion.aside>
  );
}

export default Sidebar3D;
