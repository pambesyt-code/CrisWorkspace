/**
 * Genera public/manifest.webmanifest (la ficha de la app instalable).
 * Se ejecuta solo antes de `npm run dev` y `npm run build`. Usa PAGES_BASE_PATH
 * para que funcione igual en local ("/") que en GitHub Pages ("/crisworkspace/").
 */
import { writeFile } from "node:fs/promises";

const base = process.env.PAGES_BASE_PATH ?? "";
const manifest = {
  id: `${base}/`,
  name: "CrisWorkspace",
  short_name: "CrisWorkspace",
  description: "Notas tipo Notion y estudio de vídeo multired sincronizado con tu directo.",
  lang: "es",
  start_url: `${base}/`,
  scope: `${base}/`,
  display: "standalone",
  orientation: "any",
  background_color: "#0A0A0F",
  theme_color: "#0A0A0F",
  categories: ["productivity", "social"],
  icons: [
    { src: `${base}/iconos/icono-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: `${base}/iconos/icono-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: `${base}/iconos/icono-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

await writeFile("public/manifest.webmanifest", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✔ manifest.webmanifest (base: "${base || "/"}")`);
