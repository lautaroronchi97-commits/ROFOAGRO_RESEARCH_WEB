"use client";

import { useMemo, useState } from "react";
import {
  fechaLarga,
  ORG_LABEL,
  type EventoCalendario,
  type Organismo,
} from "@/lib/calendario";

/** Agrupa por fecha ISO conservando orden. */
function porFecha(evs: EventoCalendario[]): Array<[string, EventoCalendario[]]> {
  const map = new Map<string, EventoCalendario[]>();
  for (const e of evs) {
    const arr = map.get(e.fechaISO) ?? [];
    arr.push(e);
    map.set(e.fechaISO, arr);
  }
  return [...map.entries()];
}

/**
 * Calendario cronológico completo con filtros (organismo + solo alto interés).
 * Recibe los eventos ya calculados en el server; el filtro es client-side.
 */
export function CalendarioCliente({
  eventos,
  organismos,
}: {
  eventos: EventoCalendario[];
  organismos: Organismo[];
}) {
  // Semántica de filtro (relevamiento web R7, punto 49): click en un chip deja SOLO ese
  // organismo; re-click sobre el mismo vuelve a mostrar todos. Antes el click EXCLUÍA
  // (semántica invertida — el pedido explícito era "queda filtrado ese", no "se apaga ese").
  const [solo, setSolo] = useState<Organismo | null>(null);
  const [soloAlto, setSoloAlto] = useState(false);

  const filtrados = useMemo(
    () =>
      eventos.filter(
        (e) => (solo === null || e.organismo === solo) && (!soloAlto || e.importancia === "alta"),
      ),
    [eventos, solo, soloAlto],
  );
  const grupos = useMemo(() => porFecha(filtrados), [filtrados]);

  function elegir(o: Organismo) {
    setSolo((prev) => (prev === o ? null : o));
  }

  return (
    <div>
      <div className="cal-filters" role="group" aria-label="Filtros del calendario">
        {organismos.map((o) => (
          <button
            key={o}
            type="button"
            className={`cal-fchip org-${o} ${solo !== null && solo !== o ? "is-off" : ""}`}
            aria-pressed={solo === o}
            onClick={() => elegir(o)}
          >
            {ORG_LABEL[o]}
          </button>
        ))}
        <button
          type="button"
          className={`cal-fchip cal-fchip-alto ${soloAlto ? "is-on" : ""}`}
          aria-pressed={soloAlto}
          onClick={() => setSoloAlto((v) => !v)}
        >
          ● Solo alto interés
        </button>
      </div>

      <div className="cal-full">
        {grupos.length === 0 && <div className="cal-empty">Nada para mostrar con estos filtros.</div>}
        {grupos.map(([fecha, evs]) => (
          <div className="cal-fday" key={fecha}>
            <div className="cal-fdate">{fechaLarga(fecha)}</div>
            <div className="cal-fevs">
              {evs.map((e, i) => (
                <a
                  className="cal-ev"
                  key={`${e.organismo}-${e.informe}-${i}`}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={`cal-org org-${e.organismo}`}>{ORG_LABEL[e.organismo]}</span>
                  <span className="cal-ev-body">
                    <span className="cal-ev-title">
                      {e.informe}
                      {e.importancia === "alta" && (
                        <span className="cal-hot" title="Mueve el mercado">
                          ●
                        </span>
                      )}
                    </span>
                    <span className="cal-ev-sub">
                      {e.region} · {e.granos}
                    </span>
                    {e.nota && <span className="cal-ev-note">{e.nota}</span>}
                  </span>
                  <span className="cal-when">
                    {e.horaArg ? (
                      <span className="cal-hora">{e.horaArg}</span>
                    ) : (
                      <span className="cal-hora dim">—</span>
                    )}
                    {e.tipo === "regla" ? (
                      <span className="cal-est" title="Fecha estimada por regla (el organismo no publica calendario)">
                        est.
                      </span>
                    ) : (
                      <span className="cal-of" title="Fecha oficial publicada por el organismo">
                        oficial
                      </span>
                    )}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
