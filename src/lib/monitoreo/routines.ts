import "server-only";
import { sbSelect } from "../supabase";
import { ROUTINES, type RoutineDef } from "./catalogo";
import {
  ventanaEsperada,
  evaluarInforme,
  evaluarView,
  evaluarPorTelemetria,
  type EstadoRoutine,
  type InformeRow,
} from "./routines-logica";

export { ventanaEsperada, evaluarInforme, evaluarView, evaluarPorTelemetria };
export type { EstadoRoutine };

/**
 * Estado de las 4 Routines de Claude Code (informe diario, informe semanal, view de mercado,
 * interpretaciones). No viven en el repo — se detectan por lo que ESCRIBEN: `informes_generados`
 * (diario/semanal) y `views_mercado` (3 filas esperadas, una por grano); interpretaciones no tiene
 * un "output esperado" fijo (un día sin reportes es un día legítimo sin filas nuevas), así que se
 * detecta por telemetría (`routine_runs`, N13). Requiere `SUPABASE_SERVICE_KEY` para ver filas en
 * `estado='borrador'` (RLS solo deja `enviado` a anon) y para leer `views_mercado`/`routine_runs`
 * (RLS admin-only) — `sbSelect` ya la prefiere cuando está configurada.
 */

export type RoutineEstado = RoutineDef & {
  fechaEsperada: string;
  vencio: boolean;
  estado: EstadoRoutine;
  detalle: string;
};

export async function getRoutines(hoyISO: string, ahoraMin: number): Promise<RoutineEstado[]> {
  const ventanas = ROUTINES.map((r) => ({ routine: r, ...ventanaEsperada(r, hoyISO, ahoraMin) }));
  const minFecha = ventanas.reduce((m, v) => (v.fechaEsperada < m ? v.fechaEsperada : m), hoyISO);

  const [informesRes, viewsRes, runsRes] = await Promise.all([
    sbSelect(`informes_generados?select=tipo,fecha,estado,path_png,path_pdf&fecha=gte.${minFecha}`, 0),
    sbSelect(`views_mercado?select=grano,fecha&fecha=gte.${minFecha}`, 0),
    sbSelect(`routine_runs?select=tipo,fecha&tipo=eq.interpretaciones&fecha=gte.${minFecha}`, 0),
  ]);
  const informes = informesRes.ok ? ((informesRes.data as (InformeRow & { tipo: string })[] | undefined) ?? []) : [];
  const views = viewsRes.ok ? ((viewsRes.data as { grano: string; fecha: string }[] | undefined) ?? []) : [];
  const runs = runsRes.ok ? ((runsRes.data as { tipo: string; fecha: string }[] | undefined) ?? []) : [];

  return ventanas.map(({ routine, fechaEsperada, vencio }) => {
    if (routine.id === "view-mercado") {
      const n = views.filter((v) => v.fecha === fechaEsperada).length;
      const { estado, detalle } = evaluarView(n, vencio);
      return { ...routine, fechaEsperada, vencio, estado, detalle };
    }
    if (routine.id === "interpretaciones") {
      const n = runs.filter((r) => r.fecha === fechaEsperada).length;
      const { estado, detalle } = evaluarPorTelemetria(n, vencio);
      return { ...routine, fechaEsperada, vencio, estado, detalle };
    }
    const tipo = routine.id === "informe-diario" ? "diario" : "semanal";
    const fila = informes.find((f) => f.tipo === tipo && f.fecha === fechaEsperada);
    const { estado, detalle } = evaluarInforme(fila, vencio);
    return { ...routine, fechaEsperada, vencio, estado, detalle };
  });
}
