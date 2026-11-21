/**
 * Genera los iconos de la app instalable a partir de un SVG.
 * Ejecutar: node scripts/generar-iconos.mjs
 * (usa `sharp`, que ya viene con Next.js).
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const svg = (rounded) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1B1235"/>
      <stop offset="0.55" stop-color="#0E0B1C"/>
      <stop offset="1" stop-color="#2A0F1A"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#8B5CF6" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#F43F5E" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#F43F5E" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbe" cx="0.36" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#E9D5FF"/>
      <stop offset="0.28" stop-color="#A78BFA"/>
      <stop offset="0.62" stop-color="#6366F1"/>
      <stop offset="0.86" stop-color="#E11D48"/>
      <stop offset="1" stop-color="#7C2D12"/>
    </radialGradient>
    <radialGradient id="brillo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="${rounded ? 228 : 0}" fill="url(#fondo)"/>
  <circle cx="512" cy="512" r="400" fill="url(#halo)"/>
  <ellipse cx="512" cy="512" rx="330" ry="120" fill="none" stroke="#C4B5FD" stroke-opacity="0.35" stroke-width="10" transform="rotate(-24 512 512)"/>
  <circle cx="512" cy="512" r="230" fill="url(#orbe)"/>
  <circle cx="512" cy="512" r="230" fill="none" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="6"/>
  <ellipse cx="440" cy="420" rx="88" ry="58" fill="url(#brillo)" transform="rotate(-30 440 420)"/>
  <path d="M 190 610 A 330 120 -24 0 0 834 414" fill="none" stroke="#FDA4AF" stroke-opacity="0.75" stroke-width="10" transform="rotate(0 512 512)"/>
</svg>`;

await mkdir("public/iconos", { recursive: true });
const tareas = [
  // iOS redondea solo las esquinas: el icono va cuadrado y sin transparencia.
  { archivo: "src/app/apple-icon.png", tam: 180, redondo: false },
  { archivo: "public/iconos/icono-192.png", tam: 192, redondo: false },
  { archivo: "public/iconos/icono-512.png", tam: 512, redondo: false },
  { archivo: "src/app/icon.png", tam: 64, redondo: true },
];
for (const t of tareas) {
  await sharp(Buffer.from(svg(t.redondo))).resize(t.tam, t.tam).png().toFile(t.archivo);
  console.log("✔", t.archivo);
}
await writeFile("public/iconos/icono.svg", svg(true));
console.log("✔ public/iconos/icono.svg");
