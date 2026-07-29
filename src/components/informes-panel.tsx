import Link from "next/link";
import { getEventos, fechaCorta, ORG_LABEL, type EventoCalendario } from "@/lib/calendario";
import { hoyCordobaISO } from "@/lib/dates";
import { sumarCorridos, parseYmd, ymd } from "@/lib/habiles";
import { Panel, PanelHead } from "./panel";

function IconCal() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </svg>
  );
}

/** Agrupa eventos por fecha ISO conservando el orden. */
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
 * Panel compacto de la home: próximos informes de alto/medio interés, agrupados por
 * día. Ventana de 7 días — "solo una semana como máximo" (relevamiento 29/07, punto
 * 22). El calendario completo (con contexto de mercado) vive en /produccion.
 */
export function InformesPanel() {
  const hoy = hoyCordobaISO();
  const hasta = ymd(sumarCorridos(parseYmd(hoy), 7));
  const eventos = getEventos(hoy, hasta).filter((e) => e.importancia !== "baja");
  const grupos = porFecha(eventos);

  return (
    <Panel id="informes">
      <PanelHead
        glyph={<IconCal />}
        title="Próximos informes"
        sub="Estimaciones de producción · próximos 7 días"
        stamp={
          <Link href="/produccion" className="cal-more">
            Calendario completo →
          </Link>
        }
      />
      <div className="cal-list">
        {grupos.length === 0 && (
          <div className="cal-empty">Sin informes de peso en los próximos 7 días.</div>
        )}
        {grupos.map(([fecha, evs]) => (
          <div className="cal-day" key={fecha}>
            <div className="cal-date">
              <span className="cal-date-txt">{fechaCorta(fecha)}</span>
            </div>
            <div className="cal-evs">
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
                      {e.importancia === "alta" && <span className="cal-hot" title="Mueve el mercado">●</span>}
                    </span>
                    <span className="cal-ev-sub">{e.region}</span>
                  </span>
                  <span className="cal-when">
                    {e.horaArg ? <span className="cal-hora">{e.horaArg}</span> : <span className="cal-hora dim">—</span>}
                    {e.tipo === "regla" && <span className="cal-est" title="Fecha estimada por regla (el organismo no publica calendario)">est.</span>}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="panel-note">
        <span>
          <span className="k">Calendario</span> Fechas oficiales (USDA, CONAB, NASS) + reglas para los que no
          publican agenda (BCBA jueves, GEA/SAGyP) — estas van marcadas <b>est.</b> Horarios en hora
          Argentina. Ver todo en{" "}
          <Link href="/produccion" className="cal-inline-link">
            Producción
          </Link>
          .
        </span>
      </div>
    </Panel>
  );
}
