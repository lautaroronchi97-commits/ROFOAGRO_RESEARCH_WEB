import { getVariacionSemanalDolarOficial } from "@/lib/informe-semanal";
import { getDolarOficialHistorico } from "@/lib/dolar-historico";
import { nfmt, pfmt } from "@/lib/format";
import { hoyCordobaISO } from "@/lib/dates";
import type { Meta } from "@/lib/market/types";
import { Panel, PanelHead } from "./panel";
import { QueEsEsto } from "./que-es-esto";
import { SourceStamp } from "./source-stamp";

/** Fuera del componente a propósito: `Date.now()` en el cuerpo de un Server Component
 * dispara la regla de pureza de React (react-hooks/purity) — mismo criterio que
 * `market/dolar-futuro.ts`, que arma su `meta` en una función de lib, no en el JSX. */
function metaOficial(actual: number | null): Meta {
  return {
    source: "BCRA",
    updatedAt: actual != null ? Date.now() : null,
    status: actual != null ? "real" : "parcial",
    problemas: actual == null ? ["Sin datos de BCRA A3500 disponibles"] : [],
  };
}
import { DolarOficialChart } from "./dolar-oficial-chart";
import { DolarOficialSemanalChart } from "./dolar-oficial-semanal-chart";
import { DolarOficialVolatilidadChart } from "./dolar-oficial-volatilidad-chart";

/**
 * Variación semanal del dólar oficial (ítem 13 del backlog viejo / P2 de PLAN_BACKLOG.md) —
 * el KPI + gráfico corto (`DolarOficialChart`, ~13 días) se resolvió al construir MP2 (informe
 * semanal), que necesitaba el mismo dato y el mismo componente — NO se toca, MP2 lo reusa tal
 * cual en la plantilla del PDF. Lo que sumó esta sesión (23/07, con Lautaro): la serie semanal
 * larga (26 semanas, combo nivel+variación) y el gráfico de volatilidad (semanal + diaria, con
 * toggle), ambos desde `dolar-historico.ts` (ventana propia, mucho más larga que la de MP2).
 */
export async function DolarOficialPanel() {
  const hoy = hoyCordobaISO();
  const [v, historico] = await Promise.all([
    getVariacionSemanalDolarOficial(hoy),
    getDolarOficialHistorico(),
  ]);
  const dir = v.deltaPct == null ? null : v.deltaPct >= 0 ? "up" : "down";
  const meta = metaOficial(v.actual);

  return (
    <Panel id="dolar-oficial-semanal">
      <PanelHead
        title="Dólar oficial — variación semanal"
        sub="BCRA A3500 (Comunicación 3500)"
        stamp={<SourceStamp meta={meta} />}
      />
      <div className="cbo-head">
        <span className="cbo-kpi">
          <span className="k">Último ({v.fechaActual ?? "—"})</span>
          <span className="v mono">{v.actual != null ? `$ ${nfmt(v.actual, 2)}` : "—"}</span>
          {dir && (
            <span className={`rd ${dir}`}>
              {pfmt(v.deltaPct, 2)} vs {v.fechaPrevia}
            </span>
          )}
        </span>
      </div>
      <DolarOficialChart serie={v.serie} />
      <DolarOficialSemanalChart semanas={historico.semanas} />
      <DolarOficialVolatilidadChart semanal={historico.volatilidadSemanal} diaria={historico.volatilidadDiaria} />
      <QueEsEsto
        paraQue="Cuánto se movió el dólar oficial en la última semana (arriba, último dato real vs el de ~7 días antes) y cómo viene el ritmo de devaluación en los últimos 6 meses (serie semanal) — más abajo, qué tan agitada estuvo esa suba o baja (volatilidad)."
        comoSeCalcula={
          <>
            BCRA A3500 (Comunicación 3500, variable 5 de la API de estadísticas del BCRA) — es
            la única fuente con historial diario real. No es el spot <code>UST$T</code> de MAE
            que usa el resto de la web para el oficial mayorista (ese no tiene historial
            consultable en ningún lado): la A3500 trae el spread bancario implícito, se usa
            igual porque es lo único medible semana a semana. La serie semanal toma el último
            dato hábil de cada semana calendario. La volatilidad tiene dos lecturas, elegibles
            con el botón Semanal/Diaria: semanal es el desvío estándar de las últimas 12
            variaciones % semanales (anualizado ×√52); diaria es el desvío de las últimas 60
            variaciones % rueda a rueda (anualizado ×√252, la convención de ruedas hábiles por
            año — no ×√365).
          </>
        }
      />
    </Panel>
  );
}
