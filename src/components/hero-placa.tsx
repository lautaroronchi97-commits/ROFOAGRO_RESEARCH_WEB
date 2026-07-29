"use client";

import * as React from "react";
import Link from "next/link";
import { nfmt } from "@/lib/format";
import { CountUp } from "./count-up";

export type PlacaPizarra = {
  underlying: string;
  nombre: string;
  usd: number;
  ars: number | null;
  estimativo: boolean;
};

/**
 * Placa del hero (relevamiento 29/07, punto 21): la pizarra de cada grano va
 * PASANDO con una transición suave (SOJ → MAI → TRI, ~6s por grano), con el USD
 * grande de siempre, el valor en PESOS destacado abajo (más que el meta, menos
 * que el USD) y la fecha de la pizarra. Con `prefers-reduced-motion` no rota
 * sola ni anima — queda la soja fija y se cambia a mano con los puntos. La
 * rotación se pausa con el mouse encima o el foco adentro (los puntos son
 * también el control manual, no hay dependencia del hover).
 */
export function HeroPlaca({
  placas,
  fecha,
  oficial,
}: {
  placas: PlacaPizarra[];
  fecha: string | null;
  oficial: number | null;
}) {
  const [idx, setIdx] = React.useState(0);
  const [pausada, setPausada] = React.useState(false);

  React.useEffect(() => {
    if (placas.length < 2 || pausada) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % placas.length), 6000);
    return () => window.clearInterval(t);
  }, [placas.length, pausada]);

  const p = placas[idx % Math.max(placas.length, 1)];
  if (!p) return null;

  // "2026-07-29" → "29/07" (la fecha a la que corresponde la pizarra publicada).
  const fechaCorta = fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : null;

  return (
    <aside
      className="hero-placa"
      aria-label="Pizarra Rosario del día"
      onMouseEnter={() => setPausada(true)}
      onMouseLeave={() => setPausada(false)}
      onFocus={() => setPausada(true)}
      onBlur={() => setPausada(false)}
    >
      {/* key = grano → remonta el bloque en cada rotación y dispara la animación
          de entrada (CSS .hp-rot, gated por prefers-reduced-motion). */}
      <div className="hp-rot" key={p.underlying}>
        <div className="hp-lbl">
          Pizarra Rosario · {p.nombre}
          {p.estimativo && (
            <span className="pz-estim" title="Valor estimado (CAC sin publicar todavía)">
              est.
            </span>
          )}
          {fechaCorta && <span className="hp-fecha">pizarra del {fechaCorta}</span>}
        </div>
        <div className="hp-big">
          <CountUp value={p.usd} decimals={1} />
          <small> US$/tn</small>
        </div>
        <div className="hp-ars">
          {p.ars != null ? (
            <>
              $ {nfmt(p.ars, 0)} <small>/tn</small>
            </>
          ) : (
            <span className="dim">— $/tn</span>
          )}
        </div>
      </div>

      <div className="hp-dots" role="tablist" aria-label="Elegir grano de la pizarra">
        {placas.map((pl, i) => (
          <button
            key={pl.underlying}
            type="button"
            role="tab"
            aria-selected={i === idx % placas.length}
            aria-label={pl.nombre}
            className={`hp-dot${i === idx % placas.length ? " on" : ""}`}
            onClick={() => setIdx(i)}
          >
            <span className="sr">{pl.nombre}</span>
          </button>
        ))}
      </div>

      <p className="hp-ctx">
        {oficial !== null && (
          <>
            Oficial mayorista <b>$ {nfmt(oficial, 2)}</b>
          </>
        )}
      </p>
      <Link href="/granos" className="hp-link">
        Arbitrajes y pases →
      </Link>
    </aside>
  );
}
