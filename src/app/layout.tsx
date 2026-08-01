import type { Metadata } from "next";
import { Source_Serif_4, Source_Sans_3, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

// Sistema tipográfico «Fundación» (rediseño premium 28/07/2026, elegido por
// Lautaro sobre 3 candidatos clásicos/sobrios renderizados sobre el sitio real):
// la superfamilia Source — Serif 4 para titulares/números protagonistas, Sans 3
// para UI/prosa, Code Pro para datos tabulares. Diseñadas para funcionar juntas;
// sobriedad institucional consistente en todos los tamaños. Las 3 se autohospedan
// vía next/font (build-time, cero red en runtime). Reemplaza al sistema
// «Argentina» (Piazzolla/Rosario/Plex Mono) de la 1ª vuelta de esta misma sesión.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-sserif",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-ssans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sourceCode = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-scode",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rofoagro.com.ar").replace(/\/$/, "");
const TITULO = "ROFO AGRO · Pizarra electrónica de granos";
const DESCRIPCION =
  "Research de mercado de granos de Argentina: arbitrajes pizarra vs A3, dólar futuro, tasas implícitas. ROFO AGRO — Consultora de granos.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITULO,
  description: DESCRIPCION,
  // El noindex global se sacó en E3 (fase 2) al conectar la pizarra real de CAC y quitar las
  // implícitas de granos de ejemplo (ya no queda dato falso a la vista). Las páginas de mesa
  // (admin, comercio/*, produccion, granos/view) mantienen su `robots: index:false` propio.
  // OG/Twitter (Fase 7, 01/08/2026): la imagen sale sola de opengraph-image.tsx (convención de
  // archivo de Next.js) — acá solo van los campos de texto, para que WhatsApp/Slack/etc. tengan
  // título+descripción propios en vez de repetir el <title> genérico.
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "ROFO AGRO",
    title: TITULO,
    description: DESCRIPCION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${sourceSerif.variable} ${sourceSans.variable} ${sourceCode.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
