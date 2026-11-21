import type { EpochMs } from "@/types/workspace";
import { msUntilNextSecond } from "@/lib/broadcast/clock";

/**
 * Temporizador del reloj maestro.
 *
 * Emite un "tic" justo después de cada cambio de segundo del directo
 * (alineado con el instante de inicio, no con el reloj del sistema). El tic
 * no lleva datos: quien lo recibe vuelve a leer `Date.now()`, así que un tic
 * retrasado nunca produce un tiempo incorrecto.
 *
 * Usa un Web Worker cuando está disponible: los navegadores ralentizan mucho
 * los temporizadores de las pestañas ocultas, pero bastante menos los de los
 * workers. Si no se puede crear el worker, cae a `setTimeout` en el hilo
 * principal (el store compensa además al volver a la pestaña).
 */

const SAFETY_MARGIN_MS = 4;

const WORKER_SOURCE = `
let timer = null;
let start = 0;
function next() {
  const now = Date.now();
  const offset = (now - start) % 1000;
  const wait = (offset < 0 ? -offset : 1000 - offset) + ${SAFETY_MARGIN_MS};
  timer = setTimeout(() => { postMessage(0); next(); }, wait);
}
onmessage = (event) => {
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (event.data && typeof event.data.start === "number") { start = event.data.start; next(); }
};
`;

export interface Ticker {
  stop: () => void;
}

export function startTicker(startTimestamp: EpochMs, onTick: () => void): Ticker {
  if (typeof window !== "undefined" && typeof Worker !== "undefined" && typeof Blob !== "undefined") {
    let workerUrl: string | null = null;
    try {
      workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      const worker = new Worker(workerUrl);
      // El worker ya cargó su código: la URL puede liberarse.
      URL.revokeObjectURL(workerUrl);
      workerUrl = null;
      worker.onmessage = () => onTick();
      worker.postMessage({ start: startTimestamp });
      return {
        stop: () => {
          worker.onmessage = null;
          worker.postMessage({ stop: true });
          worker.terminate();
        },
      };
    } catch {
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      // Continúa con el temporizador del hilo principal.
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const schedule = () => {
    if (stopped) return;
    const wait = msUntilNextSecond(startTimestamp, Date.now()) + SAFETY_MARGIN_MS;
    timer = setTimeout(() => {
      onTick();
      schedule();
    }, wait);
  };
  schedule();
  return {
    stop: () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
