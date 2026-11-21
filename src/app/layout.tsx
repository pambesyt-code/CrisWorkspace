import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CrisWorkspace",
  description: "Organización tipo Notion y estudio de vídeo multired sincronizado con tu directo.",
  applicationName: "CrisWorkspace",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`,
  // iPhone/iPad: al añadirla a la pantalla de inicio se abre a pantalla completa, como una app.
  appleWebApp: {
    capable: true,
    title: "CrisWorkspace",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Ocupa también la zona de la isla dinámica / muesca; los márgenes seguros se aplican en CSS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden bg-[#0A0A0F] text-zinc-100">{children}</body>
    </html>
  );
}
