import "server-only";

import { createSupabaseServerClient } from "@/lib/auth/server";
import { hoyCordobaISO } from "@/lib/dates";
import { isoMenosDias, huecosHabiles } from "@/lib/monitoreo/manual";
import type { DiaColor } from "./datos-dia";
import type { PuntoReciente } from "./bcra-manual";

/**
 * Carga de datos server-side para las 3 páginas de /admin/datos que muestran un historial
 * (mesa-color, bcra-manual, lecap) — extraído del page.tsx único original para que cada
 * página nueva pida solo lo suyo, sin repetir las mismas queries de Supabase dos veces.
 */

export async function getDiasColor(): Promise<{ fechaHoy: string; dias: DiaColor[] }> {
  const fechaHoy = hoyCordobaISO();
  const desde14 = isoMenosDias(fechaHoy, 14);
  const supabase = await createSupabaseServerClient();
  const [{ data: colorRows }, { data: informesDiarios }] = await Promise.all([
    supabase
      .from("mesa_color")
      .select("fecha,texto,chicago_bcr")
      .gte("fecha", desde14)
      .order("fecha", { ascending: false }),
    supabase.from("informes_generados").select("fecha").eq("tipo", "diario").gte("fecha", desde14),
  ]);

  const coloresPorFecha = new Map(
    ((colorRows ?? []) as { fecha: string; texto: string; chicago_bcr: string | null }[]).map((f) => [
      f.fecha,
      { texto: f.texto, chicagoBcr: f.chicago_bcr ?? "" },
    ]),
  );
  const fechasTomadas = new Set(((informesDiarios ?? []) as { fecha: string }[]).map((f) => f.fecha));
  const fechasColor = new Set([fechaHoy, ...coloresPorFecha.keys()]);
  const dias: DiaColor[] = Array.from(fechasColor)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((fecha) => ({
      fecha,
      texto: coloresPorFecha.get(fecha)?.texto ?? "",
      chicagoBcr: coloresPorFecha.get(fecha)?.chicagoBcr ?? "",
      tomado: fechasTomadas.has(fecha),
    }));

  return { fechaHoy, dias };
}

export async function getBcraManualData(): Promise<{
  fechaDefault: string;
  recientes: PuntoReciente[];
  faltantes: string[];
}> {
  const fechaHoy = hoyCordobaISO();
  const desde14 = isoMenosDias(fechaHoy, 14);
  const supabase = await createSupabaseServerClient();
  const { data: bcraRows } = await supabase
    .from("compras_bcra")
    .select("fecha,monto_musd,fuente")
    .gte("fecha", desde14)
    .order("fecha", { ascending: false });

  const bcraRecientes = (bcraRows ?? []) as { fecha: string; monto_musd: number; fuente: "manual" | "api" }[];
  const recientes: PuntoReciente[] = bcraRecientes.map((r) => ({
    fecha: r.fecha,
    montoMusd: r.monto_musd,
    fuente: r.fuente,
  }));
  const bcraFechas = new Set(recientes.map((p) => p.fecha));
  const faltantes = huecosHabiles(fechaHoy, 14, bcraFechas);
  const fechaDefault = faltantes.length > 0 ? faltantes[faltantes.length - 1]! : isoMenosDias(fechaHoy, 1);

  return { fechaDefault, recientes: recientes.slice(0, 8), faltantes };
}

export async function getLecapActuales(): Promise<
  { ticker: string; pago_final: number; fecha_vencimiento: string | null }[]
> {
  const supabase = await createSupabaseServerClient();
  const { data: lecapRows } = await supabase
    .from("lecap_pago_final")
    .select("ticker,pago_final,fecha_vencimiento")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
  return (lecapRows ?? []) as { ticker: string; pago_final: number; fecha_vencimiento: string | null }[];
}
