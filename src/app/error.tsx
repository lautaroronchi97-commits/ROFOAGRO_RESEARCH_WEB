"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary branded (500 — antes caía al genérico de Next en inglés, sin marca).
 * Cubre cualquier error de render/fetch dentro de un route segment (no el root layout
 * en sí: para eso está `global-error.tsx`, que reemplaza también <html>/<body>).
 * Mismo patrón visual que `not-found.tsx` (E3 H9): `.brand` + `.aviso-card`, hereda
 * tema claro/oscuro del root layout porque sigue anidado dentro de él.
 */
export default function ErrorBoundary({
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
    <main className="wrap" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
      <div className="col" style={{ textAlign: "center" }}>
        <Link
          href="/"
          className="brand"
          aria-label="ROFO AGRO — Inicio"
          style={{ justifyContent: "center", marginBottom: 20 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rofoagro-isotipo.svg" alt="" className="brand-iso" width={58} height={32} />
          <span className="wordmark">
            <span className="rf">ROFO</span>
            <span className="agro">AGRO</span>
          </span>
        </Link>
        <section className="aviso-card">
          <h1 className="aviso-title">Algo salió mal</h1>
          <p className="aviso-sub">
            Hubo un error inesperado cargando esta página. Podés reintentar o volver al tablero —
            el resto del sitio sigue funcionando.
          </p>
          <div className="aviso-acciones">
            <button type="button" onClick={() => reset()} className="auth-btn auth-btn-primary">
              Reintentar
            </button>
            <Link href="/" className="auth-btn auth-btn-ghost">
              Volver al inicio
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
