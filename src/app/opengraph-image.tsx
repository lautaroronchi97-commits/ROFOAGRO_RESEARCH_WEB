import { ImageResponse } from "next/og";

/**
 * OG tags para WhatsApp/redes (Fase 7 del checklist de pre-lanzamiento) — los clientes agro
 * comparten TODO por WhatsApp, y hasta el 01/08/2026 el sitio no tenía ninguna imagen de
 * preview. Convención de archivo de Next.js: esto genera `/opengraph-image` (1200×630) y el
 * `<meta property="og:image">` correspondiente automáticamente, para TODAS las páginas que no
 * definan su propia imagen (no hay ninguna por ahora — un solo card genérico alcanza).
 *
 * Texto en vez del SVG del logo a propósito: el logo real es un auto-trace de ~285 paths — el
 * renderer de esta imagen (satori, vía `next/og`) no rasteriza SVGs complejos de forma
 * confiable dentro de un `<img>`. El wordmark tipográfico usa los mismos tokens de color que
 * el sitio (`--brand-rf`/`--brand-agro`/`--gold`).
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0F0B",
          backgroundImage:
            "radial-gradient(circle at 50% 35%, rgba(239,191,46,0.10), transparent 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={{ fontSize: 108, fontWeight: 700, color: "#2F6E34", letterSpacing: -1 }}>
            ROFO
          </span>
          <span style={{ fontSize: 108, fontWeight: 700, color: "#4E9C3A", letterSpacing: -1 }}>
            AGRO
          </span>
        </div>
        <div
          style={{
            display: "flex",
            width: 220,
            height: 2,
            marginTop: 28,
            marginBottom: 28,
            background:
              "linear-gradient(90deg, transparent, #EFBF2E 30%, #EFBF2E 70%, transparent)",
          }}
        />
        <div style={{ display: "flex", fontSize: 34, color: "#EDF2E3", opacity: 0.82 }}>
          Research de mercado de granos · Argentina
        </div>
      </div>
    ),
    { ...size }
  );
}
