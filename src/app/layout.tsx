import type { Metadata } from "next";
import { Piazzolla, Rosario, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

// Sistema tipográfico "Argentina" (rediseño premium, 27-28/07/2026): Piazzolla
// (Huerta Tipográfica, Buenos Aires) para titulares/números protagonistas,
// Rosario (Omnibus-Type) para UI/prosa, IBM Plex Mono para datos tabulares.
// Las 3 se autohospedan vía next/font (build-time, cero red en runtime).
const piazzolla = Piazzolla({
  subsets: ["latin"],
  variable: "--font-piazzolla",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const rosario = Rosario({
  subsets: ["latin"],
  variable: "--font-rosario",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plexmono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ROFO AGRO · Pizarra electrónica de granos",
  description:
    "Research de mercado de granos de Argentina: arbitrajes pizarra vs A3, dólar futuro, tasas implícitas. ROFO AGRO — Consultora de granos.",
  // El noindex global se sacó en E3 (fase 2) al conectar la pizarra real de CAC y quitar las
  // implícitas de granos de ejemplo (ya no queda dato falso a la vista). Las páginas de mesa
  // (admin, comercio/*, produccion, granos/view) mantienen su `robots: index:false` propio.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${piazzolla.variable} ${rosario.variable} ${plexMono.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
