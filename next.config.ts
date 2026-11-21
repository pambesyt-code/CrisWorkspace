import type { NextConfig } from "next";

/**
 * Publicación en GitHub Pages: el workflow define `PAGES_BASE_PATH=/crisworkspace`
 * y la app se exporta como archivos estáticos dentro de esa subcarpeta.
 * En local (sin la variable) funciona como siempre en la raíz.
 */
const basePath = process.env.PAGES_BASE_PATH ?? "";
const isStaticExport = basePath !== "";

const nextConfig: NextConfig = {
  // El renderizado parcial (PPR) no existe en la exportación estática; la app es
  // toda de navegador, así que en GitHub Pages se desactiva sin perder nada.
  cacheComponents: !isStaticExport,
  partialPrefetching: !isStaticExport,
  // Quita el botón «N» de herramientas de Next.js que aparecía abajo a la izquierda en desarrollo.
  devIndicators: false,
  ...(isStaticExport ? { output: "export" as const, basePath, trailingSlash: true, images: { unoptimized: true } } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Las cabeceras solo existen con servidor (no en la exportación estática).
  ...(isStaticExport
    ? {}
    : {
        async headers() {
          return [
            {
              // El service worker siempre se comprueba de nuevo, para que las actualizaciones lleguen.
              source: "/sw.js",
              headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
            },
          ];
        },
      }),
};

export default nextConfig;
