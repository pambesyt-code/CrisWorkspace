/**
 * Simulación del motor lógico en Node (sin navegador).
 *
 * Ejecutar (necesita `fake-indexeddb` y `tsx` disponibles):
 *   node --import fake-indexeddb/auto --import tsx scripts/simular-motor.ts
 *
 * Comprueba: reloj maestro, disparo exacto en el segundo 00, ausencia de
 * duplicados con tics repetidos o atrasados, aislamiento de fallos por red,
 * reintento solo de las redes fallidas, validación y árbol de notas.
 */
import assert from "node:assert/strict";
import { dueTimestamp, elapsedSecondsAt, formatClock, getDueVideos, msUntilNextSecond, timelineMaxMinute } from "@/lib/broadcast/clock";
import { buildTree, canMove, createFolder, createNote, sanitizeItems, type ItemsMap } from "@/lib/notesTree";
import { extractMentions, validateDraft } from "@/lib/validation";
import { DEFAULT_PLATFORMS, mergePlatforms } from "@/lib/platforms";
import { useStudioStore } from "@/store/studioStore";
import { useNotesStore } from "@/store/notesStore";
import { getBlob } from "@/lib/blobStore";
import { detectInstallPlatform } from "@/lib/install";
import { initialSection, sanitizeSettings } from "@/store/settingsStore";
import type { ScheduledVideoStatus } from "@/types/workspace";

let passed = 0;
const ok = (label: string) => {
  passed += 1;
  console.log(`  ✔ ${label}`);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Reloj y utilidades");
  assert.equal(formatClock(0), "00:00:00");
  assert.equal(formatClock(3725), "01:02:05");
  assert.equal(elapsedSecondsAt(1_000, 60_999), 59);
  assert.equal(elapsedSecondsAt(1_000, 61_000), 60);
  assert.equal(elapsedSecondsAt(5_000, 1_000), 0);
  assert.equal(msUntilNextSecond(1_000, 1_250), 750);
  assert.equal(dueTimestamp(1_000, 20), 1_000 + 1_200_000);
  assert.equal(timelineMaxMinute([], 0), 60);
  ok("formato, tiempo transcurrido y alineación al segundo");

  console.log("Validación y menciones");
  assert.deepEqual(extractMentions("Hola @Ana y @ana, mira @pepe_1. correo: x@y.com"), ["ana", "pepe_1"]);
  const T = 1_800_000_000_000;
  const ctx = { platforms: DEFAULT_PLATFORMS, liveElapsedSeconds: null, now: T };
  const base = { scheduleMode: "directo" as const, publishAt: null, cover: null };
  const longX = validateDraft({ ...base, description: "a".repeat(281), platforms: ["twitter", "instagram"], durationSeconds: 30, triggerMinute: 20 }, ctx);
  assert.ok(longX.some((i) => i.severity === "error" && i.platform === "twitter"));
  assert.ok(!longX.some((i) => i.severity === "error" && i.platform === "instagram"));
  const badMinute = validateDraft({ ...base, description: "x", platforms: ["youtube"], durationSeconds: 10, triggerMinute: 2.5 }, ctx);
  assert.ok(badMinute.some((i) => i.severity === "error" && i.platform === null));
  const tooLong = validateDraft({ ...base, description: "x", platforms: ["instagram"], durationSeconds: 181, triggerMinute: 0 }, ctx);
  assert.ok(tooLong.some((i) => i.severity === "error" && i.platform === "instagram"));
  ok("límites por red, minuto inválido y duración");

  const dated = (publishAt: number | null) =>
    validateDraft({ ...base, scheduleMode: "fecha", publishAt, description: "x", platforms: ["instagram"], durationSeconds: 10, triggerMinute: 0 }, ctx).filter((i) => i.severity === "error");
  assert.equal(dated(T + 3_600_000).length, 0); // dentro de 1 hora
  assert.equal(dated(T - 30_000).length, 0); // «ahora» con unos segundos de retraso
  assert.equal(dated(T - 3_600_000).length, 1); // hace 1 hora
  assert.equal(dated(null).length, 1);
  assert.equal(dated(T + 400 * 86_400_000).length, 1); // más de un año
  const coverCheck = (mimeType: string, sizeBytes: number) =>
    validateDraft({ ...base, cover: { mimeType, sizeBytes }, description: "x", platforms: ["youtube"], durationSeconds: 10, triggerMinute: 0 }, ctx);
  assert.ok(coverCheck("application/pdf", 100).some((i) => i.severity === "error"));
  assert.ok(coverCheck("image/png", 11 * 1024 * 1024).some((i) => i.severity === "error"));
  assert.ok(coverCheck("image/jpeg", 3 * 1024 * 1024).some((i) => i.severity === "warning" && i.platform === "youtube"));
  ok("fechas pasadas, sin fecha o a más de un año, y portadas no válidas");

  const merged = mergePlatforms([{ id: "twitter", connected: true, handle: "cris", limits: { maxCaptionChars: 1 } }, { id: "nope" }]);
  assert.equal(merged.length, 5);
  assert.equal(merged.find((p) => p.id === "twitter")?.handle, "@cris");
  assert.equal(merged.find((p) => p.id === "twitter")?.limits.maxCaptionChars, 280);
  ok("guardados antiguos de redes conservan conexión y reciben límites actuales");

  console.log("Detección para instalar como app");
  const ua = {
    iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1",
    macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    firefoxWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  };
  assert.equal(detectInstallPlatform({ userAgent: ua.iphoneSafari, maxTouchPoints: 5, hasInstallPrompt: false }), "iphone-safari");
  assert.equal(detectInstallPlatform({ userAgent: ua.iphoneChrome, maxTouchPoints: 5, hasInstallPrompt: false }), "iphone-otro");
  assert.equal(detectInstallPlatform({ userAgent: ua.macSafari, maxTouchPoints: 0, hasInstallPrompt: false }), "mac-safari");
  assert.equal(detectInstallPlatform({ userAgent: ua.macSafari, maxTouchPoints: 5, hasInstallPrompt: false }), "ipad-safari");
  assert.equal(detectInstallPlatform({ userAgent: ua.macChrome, maxTouchPoints: 0, hasInstallPrompt: true }), "escritorio-instalable");
  assert.equal(detectInstallPlatform({ userAgent: ua.android, maxTouchPoints: 5, hasInstallPrompt: true }), "android-instalable");
  assert.equal(detectInstallPlatform({ userAgent: ua.firefoxWin, maxTouchPoints: 0, hasInstallPrompt: false }), "otro");
  ok("iPhone, iPad, Mac, Chrome, Android y navegadores sin instalación");

  console.log("Ajustes");
  const fixed = sanitizeSettings({ interfaceSize: "enorme", motion: "reducidas", show3DOrb: "si", startSection: "ultima" });
  assert.equal(fixed.interfaceSize, "normal");
  assert.equal(fixed.motion, "reducidas");
  assert.equal(fixed.show3DOrb, true);
  assert.equal(initialSection(fixed, "estudio"), "estudio");
  assert.equal(initialSection(fixed, "ajustes"), "organizacion");
  assert.equal(initialSection({ ...fixed, startSection: "estudio" }, "organizacion"), "estudio");
  ok("ajustes guardados se reparan y la sección de inicio se respeta");

  console.log("Árbol de notas");
  const a = createFolder(null, 1, "A");
  const b = createFolder(a.id, 2, "B");
  const n1 = createNote(b.id, 3, { title: "Nota" });
  const n2 = createNote("carpeta-borrada", 4, { title: "Huérfana" });
  const items: ItemsMap = { [a.id]: a, [b.id]: b, [n1.id]: n1, [n2.id]: n2 };
  const tree = buildTree(items);
  assert.equal(tree.length, 2); // A y la huérfana en la raíz
  assert.equal(tree[0]?.kind, "folder");
  assert.equal(canMove(items, a.id, b.id), false); // carpeta dentro de su hija
  assert.equal(canMove(items, a.id, a.id), false);
  assert.equal(canMove(items, n1.id, a.id), true);
  assert.equal(canMove(items, n1.id, n1.id), false);
  assert.equal(canMove(items, n2.id, null), true);
  const repaired = sanitizeItems({ x: { kind: "note", id: "x" }, y: 5 });
  assert.equal(repaired.x?.kind === "note" && repaired.x.blocks.length, 1);
  ok("árbol recursivo, movimientos inválidos rechazados, guardados reparados");

  console.log("Store de notas");
  const notes = useNotesStore.getState();
  const folderId = notes.createFolder(null);
  const noteId = notes.createNote(folderId);
  const blockId = useNotesStore.getState().addBlock(noteId, null, "todo");
  useNotesStore.getState().updateBlock(noteId, blockId, { checked: true, text: "Hecho" });
  await useNotesStore.getState().uploadFiles(noteId, [new File(["hola"], "hola.txt", { type: "text/plain" })]);
  let note = useNotesStore.getState().items[noteId];
  assert.ok(note?.kind === "note" && note.attachments.length === 1 && note.blocks.some((x) => x.checked));
  useNotesStore.getState().moveItem(folderId, folderId);
  assert.equal(useNotesStore.getState().items[folderId]?.parentId, null);
  useNotesStore.getState().deleteItem(folderId);
  note = useNotesStore.getState().items[noteId];
  assert.equal(note, undefined);
  assert.equal(useNotesStore.getState().selectedNoteId, null);
  ok("crear, editar, adjuntar, mover (inválido ignorado) y borrar en cascada");

  console.log("Reloj maestro: una hora de directo simulada");
  const studio = useStudioStore.getState();
  studio.connectPlatform("instagram", "cris");
  studio.connectPlatform("twitter", "@cris");
  // TikTok se deja SIN conectar a propósito para comprobar el aislamiento de fallos.
  const video = (name: string) => new File([new Uint8Array(1024)], name, { type: "video/mp4" });
  const schedule = async (name: string, minute: number) => {
    const issues = await useStudioStore.getState().scheduleVideo({
      file: video(name),
      description: `Directo ${name} con @invitado`,
      platforms: ["instagram", "twitter", "tiktok"],
      scheduleMode: "directo",
      triggerMinute: minute,
      publishAt: null,
      cover: null,
      coverSource: null,
    });
    assert.deepEqual(issues, [], `programar ${name}`);
  };
  await schedule("m0.mp4", 0);
  await schedule("m20.mp4", 20);
  await schedule("m40a.mp4", 40);
  await schedule("m40b.mp4", 40);
  await schedule("m59.mp4", 59);
  assert.equal(useStudioStore.getState().broadcast.queue.length, 5);
  assert.deepEqual(useStudioStore.getState().mentionHistory, ["invitado"]);

  // Registro de cada vez que un vídeo pasa a "uploading".
  const claims = new Map<string, number[]>();
  const lastStatus = new Map<string, ScheduledVideoStatus>();
  let simulatedSecond = 0;
  const unsubscribe = useStudioStore.subscribe((state) => {
    for (const v of state.broadcast.queue) {
      if (v.status === "uploading" && lastStatus.get(v.fileName) !== "uploading") {
        claims.set(v.fileName, [...(claims.get(v.fileName) ?? []), simulatedSecond]);
      }
      lastStatus.set(v.fileName, v.status);
    }
  });

  // Inicio sin disparar en tiempo real: fijamos el inicio y llamamos a tick(now) a mano.
  const start = Date.now();
  useStudioStore.setState((s) => ({ broadcast: { ...s.broadcast, isRunning: true, startTimeTimestamp: start, elapsedSeconds: 0 } }));

  // Fase 1 (min 0–30): un tic por segundo con tics duplicados y desfase aleatorio (< 1 s).
  for (let t = 0; t <= 30 * 60; t += 1) {
    simulatedSecond = t;
    const now = start + t * 1000 + Math.floor(Math.random() * 900);
    useStudioStore.getState().tick(now);
    if (t % 7 === 0) useStudioStore.getState().tick(now); // tic repetido
    if (t === 20 * 60 - 1) {
      assert.ok(!claims.has("m20.mp4"), "m20 no debe salir en el segundo 19:59");
    }
  }
  assert.deepEqual(claims.get("m0.mp4"), [0]);
  assert.deepEqual(claims.get("m20.mp4"), [1200]);
  assert.equal(useStudioStore.getState().broadcast.elapsedSeconds >= 1800, true);
  ok("min 0 al iniciar y min 20 exactamente en 00:20:00, sin duplicados");

  // Fase 2 (min 30–65): pestaña en segundo plano, tics cada ~61 s.
  for (let t = 30 * 60 + 61; t <= 65 * 60; t += 61) {
    simulatedSecond = t;
    useStudioStore.getState().tick(start + t * 1000);
    useStudioStore.getState().tick(start + t * 1000);
  }
  assert.equal(claims.get("m40a.mp4")?.length, 1);
  assert.equal(claims.get("m40b.mp4")?.length, 1);
  assert.equal(claims.get("m59.mp4")?.length, 1);
  assert.ok((claims.get("m40a.mp4")?.[0] ?? 0) >= 2400 && (claims.get("m40a.mp4")?.[0] ?? 0) < 2400 + 61);
  ok("con tics atrasados (pestaña oculta) los vídeos salen en el primer tic tras su minuto, una sola vez");

  // Las subidas simuladas tardan unos segundos de verdad.
  const deadline = Date.now() + 20_000;
  while (useStudioStore.getState().broadcast.queue.some((v) => v.status === "uploading") && Date.now() < deadline) {
    await sleep(200);
  }
  unsubscribe();
  for (const v of useStudioStore.getState().broadcast.queue) {
    assert.equal(v.status, "error", `${v.fileName} debe quedar con error parcial`);
    assert.equal(v.results.instagram?.ok, true);
    assert.equal(v.results.twitter?.ok, true);
    assert.equal(v.results.tiktok?.ok, false);
    assert.match(v.results.tiktok?.error ?? "", /no está conectada/);
    assert.match(v.error ?? "", /2 de 3/);
  }
  ok("Promise.allSettled: el fallo de TikTok no impide publicar en Instagram y X");

  // Reintento: se conecta TikTok y solo se reenvía a TikTok.
  useStudioStore.getState().connectPlatform("tiktok", "cris.tt");
  const before = useStudioStore.getState().broadcast.queue[0];
  const instagramFinishedAt = before?.results.instagram?.finishedAt;
  useStudioStore.getState().retryVideo(before?.id ?? "");
  const deadline2 = Date.now() + 20_000;
  while (useStudioStore.getState().broadcast.queue[0]?.status !== "published" && Date.now() < deadline2) {
    await sleep(200);
  }
  const after = useStudioStore.getState().broadcast.queue[0];
  assert.equal(after?.status, "published");
  assert.equal(after?.results.instagram?.finishedAt, instagramFinishedAt, "Instagram no se vuelve a publicar");
  assert.equal(after?.results.tiktok?.ok, true);
  ok("«Reintentar» solo reenvía a las redes que fallaron");

  // Concurrencia: dos publishVideo simultáneos sobre el mismo vídeo pendiente.
  await schedule("doble.mp4", 600);
  const doble = useStudioStore.getState().broadcast.queue.find((v) => v.fileName === "doble.mp4");
  const [r1, r2] = await Promise.all([
    useStudioStore.getState().publishVideo(doble?.id ?? ""),
    useStudioStore.getState().publishVideo(doble?.id ?? ""),
  ]);
  assert.equal([r1, r2].filter(Boolean).length, 1);
  ok("bloqueo atómico: dos intentos simultáneos, una sola publicación");

  // Detener y reiniciar.
  useStudioStore.getState().stopBroadcast();
  assert.equal(useStudioStore.getState().broadcast.isRunning, false);
  useStudioStore.getState().resetBroadcast();
  assert.equal(useStudioStore.getState().broadcast.elapsedSeconds, 0);
  assert.equal(getDueVideos(useStudioStore.getState().broadcast.queue, start, start + 1e9).length, 0);
  ok("detener y reiniciar el reloj");

  console.log("Agenda: publicar en una fecha, sin directo");
  const portada = (texto: string) => new Blob([texto], { type: "image/jpeg" });
  const blobExists = async (key: string | null) => (key ? (await getBlob(key)) !== null : false);
  const t0 = Date.now();
  const agendaIssues = await useStudioStore.getState().scheduleVideo({
    file: video("agenda.mp4"),
    description: "Vídeo con fecha",
    platforms: ["instagram", "twitter"],
    scheduleMode: "fecha",
    triggerMinute: 0,
    publishAt: t0 + 5_000,
    cover: portada("portada-1"),
    coverSource: "fotograma",
  });
  assert.deepEqual(agendaIssues, []);
  const agenda = () => useStudioStore.getState().broadcast.queue.find((v) => v.fileName === "agenda.mp4");
  assert.equal(useStudioStore.getState().broadcast.isRunning, false);
  assert.ok(await blobExists(agenda()?.coverBlobKey ?? null), "la portada se guarda");
  assert.equal(agenda()?.coverSource, "fotograma");
  useStudioStore.getState().tick(t0 + 4_000);
  assert.equal(agenda()?.status, "pending", "no sale antes de su hora");
  useStudioStore.getState().tick(t0 + 5_000);
  assert.equal(agenda()?.status, "uploading", "sale a su hora aunque no haya directo");
  useStudioStore.getState().tick(t0 + 6_000);
  const deadline3 = Date.now() + 20_000;
  while (agenda()?.status === "uploading" && Date.now() < deadline3) await sleep(200);
  assert.equal(agenda()?.status, "published");
  ok("un vídeo con fecha se publica a su hora, una vez, con su portada y sin directo");

  const sinDirectoIssues = await useStudioStore.getState().scheduleVideo({
    file: video("sin-directo.mp4"),
    description: "Espera al directo",
    platforms: ["instagram", "twitter"],
    scheduleMode: "directo",
    triggerMinute: 0,
    publishAt: null,
    cover: null,
    coverSource: null,
  });
  assert.deepEqual(sinDirectoIssues, []);
  const sd = () => useStudioStore.getState().broadcast.queue.find((v) => v.fileName === "sin-directo.mp4");
  useStudioStore.getState().tick(Date.now() + 1e9);
  assert.equal(sd()?.status, "pending");
  ok("un vídeo del directo no sale mientras el directo está parado");

  const id = sd()?.id ?? "";
  useStudioStore.getState().togglePlatform(id, "instagram", false);
  assert.deepEqual(sd()?.platforms, ["twitter"]);
  useStudioStore.getState().togglePlatform(id, "twitter", false);
  assert.deepEqual(sd()?.platforms, ["twitter"], "siempre queda una red");
  useStudioStore.getState().togglePlatform(id, "tiktok", true);
  assert.deepEqual(sd()?.platforms, ["twitter", "tiktok"]);
  ok("redes activables y desactivables, sin quedarse en cero");

  await useStudioStore.getState().updateCover(id, portada("a"), "imagen");
  const key1 = sd()?.coverBlobKey ?? null;
  assert.ok(await blobExists(key1));
  await useStudioStore.getState().updateCover(id, portada("b"), "fotograma");
  const key2 = sd()?.coverBlobKey ?? null;
  assert.ok(key2 !== key1 && (await blobExists(key2)));
  await sleep(50);
  assert.equal(await blobExists(key1), false, "la portada vieja se borra");
  await useStudioStore.getState().updateCover(id, null, null);
  assert.equal(sd()?.coverBlobKey, null);
  await sleep(50);
  assert.equal(await blobExists(key2), false);
  await useStudioStore.getState().updateCover(id, new Blob(["x"], { type: "text/plain" }), "imagen");
  assert.equal(sd()?.coverBlobKey, null, "un archivo que no es imagen se rechaza");
  ok("poner, cambiar y quitar la portada sin dejar archivos huérfanos");

  useStudioStore.getState().updateSchedule(id, { scheduleMode: "fecha", triggerMinute: 0, publishAt: Date.now() + 3_600_000 });
  assert.equal(sd()?.scheduleMode, "fecha");
  assert.equal(sd()?.status, "pending");
  useStudioStore.getState().publishNow(id);
  assert.equal(sd()?.status, "uploading", "«Publicar ya» sale al momento");
  ok("cambiar la programación y «Publicar ya»");

  const merge = useStudioStore.persist.getOptions().merge;
  assert.ok(merge);
  const restored = merge(
    { broadcast: { isRunning: false, startTimeTimestamp: null, queue: [{ id: "viejo", videoBlobKey: "video:viejo", platforms: ["instagram"], triggerMinute: 20, status: "pending" }] } },
    useStudioStore.getState(),
  );
  const viejo = restored.broadcast.queue[0];
  assert.equal(viejo?.scheduleMode, "directo");
  assert.equal(viejo?.publishAt, null);
  assert.equal(viejo?.coverBlobKey, null);
  assert.equal(viejo?.triggerMinute, 20);
  assert.equal(restored.platforms.find((p) => p.id === "twitter")?.supportsCustomCover, false);
  ok("los vídeos guardados con la versión anterior siguen cargando");

  console.log(`\n${passed} comprobaciones superadas.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
