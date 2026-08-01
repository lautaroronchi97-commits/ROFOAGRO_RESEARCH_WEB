"use client";

import { useEffect } from "react";

/**
 * Último recurso: reemplaza TODO el root layout (incluido <html>/<body>) cuando el
 * error ocurre en el layout mismo, no en un route segment (ahí ya lo cubre
 * `error.tsx`). Por eso va con estilos inline — no puede asumir que `globals.css`
 * o `ThemeProvider` sigan montados.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0C130D",
          color: "#EDF2E3",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#EFBF2E",
              margin: "0 0 12px",
            }}
          >
            ROFO AGRO
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 12px" }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.5, margin: "0 0 20px" }}>
            Hubo un error inesperado. Reintentá en unos segundos.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#EFBF2E",
              color: "#17251B",
              border: "none",
              borderRadius: 6,
              padding: "10px 20px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
