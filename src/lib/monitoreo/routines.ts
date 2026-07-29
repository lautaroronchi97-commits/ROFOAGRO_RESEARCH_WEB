import "server-only";
import { sbSelect } from "../supabase";
import { ROUTINES, type RoutineDef } from "./catalogo";
import {
  ventanaEsperada,
  evaluarInforme,
  evaluarView,
  type EstadoRoutine,
  type InformeRow,
} from "./routines-logica";

export { ventanaEsperada, evaluarInforme, evaluarView };
export type { EstadoRoutine };

/**
 * Estado de las 3 Routines de Claude Code (informe diario, informe semanal, view de mercado).
 * No viven en el repo — se detectan por lo que ESCRIBEN: `informes_generados` (diario/semanal)
 * y `views_mercado` (3 filas esperadas, una por grano). Requiere `SUPABASE_SERVICE_KEY` para
 * ver filas en `estado='borrador'` (RLS solo deja `enviado` a anon) y para leer `views_mercado`
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

  const [informesRes, viewsRes] = await Promise.all([
    sbSelect(`informes_generados?select=tipo,fecha,estado,path_png,path_pdf&fecha=gte.${minFecha}`, 0),
    sbSelect(`views_mercado?select=grano,fecha&fecha=gte.${minFecha}`, 0),
  ]);
  const informes = informesRes.ok ? ((informesRes.data as (InformeRow & { tipo: string })[] | undefined) ?? []) : [];
  const views = viewsRes.ok ? ((viewsRes.data as { grano: string; fecha: string }[] | undefined) ?? []) : [];

  return ventanas.map(({ routine, fechaEsperada, vencio }) => {
    if (routine.id === "view-mercado") {
      const n = views.filter((v) => v.fecha === fechaEsperada).length;
      const { estado, detalle } = evaluarView(n, vencio);
      return { ...routine, fechaEsperada, vencio, estado, detalle };
    }
    const tipo = routine.id === "informe-diario" ? "diario" : "semanal";
    const fila = informes.find((f) => f.tipo === tipo && f.fecha === fechaEsperada);
    const { estado, detalle } = evaluarInforme(fila, vencio);
    return { ...routine, fechaEsperada, vencio, estado, detalle };
  });
}
