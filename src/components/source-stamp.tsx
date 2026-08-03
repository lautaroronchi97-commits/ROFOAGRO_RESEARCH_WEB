import type { Meta } from "@/lib/market";
import { horaCordoba } from "@/lib/format";
import { FrescuraDot } from "./frescura-dot";

/**
 * Sello de frescura de un panel (de cara al cliente): origen del dato +
 * "Actualizado HH:MM" (hora Córdoba). Los paneles que aún no son 100% firmes
 * llevan una marca discreta "provisorio". No se nombra ningún proveedor técnico
 * intermedio: `meta.source` ya trae solo la institución/mercado de origen.
 *
 * `ocultarFuente` (opt-in, relevamiento web R9 punto 53): suprime SOLO el nombre de la
 * fuente (queda el "Actualizado HH:MM" + el ⚠ si corresponde) — pedido puntual de Lautoro
 * para no destacar la marca de un tercero arriba de un panel. Sin esta prop, sigue igual.
 *
 * `revalidateSeg` (opt-in, C29/Fase 2): agrega el semáforo `FrescuraDot` — punto verde/
 * ámbar/rojo que recalcula la edad del dato con el reloj del navegador, relativo al ISR de
 * la página. Sin esta prop, el comportamiento es idéntico al de siempre.
 */
export function SourceStamp({
  meta,
  ocultarFuente = false,
  revalidateSeg,
}: {
  meta: Meta;
  ocultarFuente?: boolean;
  revalidateSeg?: number;
}) {
  return (
    <span className="stamp">
      {revalidateSeg !== undefined && meta.updatedAt !== null && meta.status !== "ejemplo" && (
        <FrescuraDot updatedAt={meta.updatedAt} revalidateSeg={revalidateSeg} />
      )}
      {meta.status !== "real" && <span className="st-prov">provisorio</span>}
      {meta.source && !ocultarFuente && <span>{meta.source}</span>}
      {meta.updatedAt !== null && meta.status !== "ejemplo" && (
        <span>· Actualizado {horaCordoba(new Date(meta.updatedAt), false)}</span>
      )}
      {meta.problemas.length > 0 && (
        <span className="st-warn" title="Algún dato puede estar demorado">
          ⚠
        </span>
      )}
    </span>
  );
}

/** Meta constante para módulos que todavía muestran datos provisorios. */
export function metaEjemplo(source: string): Meta {
  return { source, updatedAt: null, status: "ejemplo", problemas: [] };
}
