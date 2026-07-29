import "server-only";
import { sbSelect } from "../supabase";
import { diasEntre } from "../dates";
import { contarBorradoresInterp } from "../interpretaciones";
import { ultimaFecha } from "./frescura";
import { CARGAS_MANUALES, type CargaManual } from "./catalogo";
import { esHabil, isoMenosDias, huecosHabiles, type EstadoManual } from "./manual-logica";

export { esHabil, isoMenosDias, huecosHabiles };
export type { EstadoManual };

/**
 * Estado de las cargas manuales (checklist "qué me falta cargar" pedido por Lautaro). Cada
 * ítem tiene su propia regla de "última carga" y de umbral — ver la tabla de reglas en el
 * plan de esta sesión (docs/sesiones/2026-07-29-panel-conexiones.md). Tres reglas
 * transversales importantes:
 *
 *  - `compras`/`camiones` NO refrescan su timestamp de auditoría al re-subir una fila ya
 *    existente (`admin_upsert_compras`/`admin_upsert_camiones`, ver las migraciones
 *    20260720120000 / 20260723140000: el `on conflict do update` no toca `actualizado_en`/
 *    `creado_en`). Por eso acá se usa `fecha` (fecha DEL DATO) como proxy de última carga,
 *    nunca esas columnas de auditoría.
 *  - `estimaciones_produccion`/`compras_bcra`/`mesa_color`/`lecap_pago_final` SÍ refrescan su
 *    columna de auditoría en cada upsert (`actualizado_en`/`actualizado`) — ahí se usa esa
 *    columna porque `fecha_publicacion` puede ser de días atrás (el caso real documentado en
 *    docs/PLAN_INFORMES_V2.md: Lautaro carga el PAS con la fecha REAL del informe).
 *  - Nada de esto tira: si una tabla no responde, el ítem queda "atrasado" con el motivo en
 *    `detalle` en vez de reventar el panel entero.
 */

export type CargaManualEstado = CargaManual & {
  ultimaFecha: string | null;
  diasDesde: number | null;
  estado: EstadoManual;
  detalle: string;
};

type Parcial = Pick<CargaManualEstado, "ultimaFecha" | "diasDesde" | "estado" | "detalle">;

function sinDatos(motivo: string): Parcial {
  return { ultimaFecha: null, diasDesde: null, estado: "atrasado", detalle: motivo };
}

async function estadoAgrochat(hoy: string): Promise<Parcial> {
  const { fecha, error } = await ultimaFecha("compras", "fecha", "&fuente=eq.AGROCHAT");
  if (error) return sinDatos(`Error al leer compras: ${error}.`);
  if (!fecha) return sinDatos("Sin cargas de Agrochat todavía.");
  const dias = diasEntre(fecha.slice(0, 10), hoy);
  const estado: EstadoManual = dias >= 14 ? "atrasado" : dias >= 7 ? "pendiente" : "al-dia";
  return { ultimaFecha: fecha, diasDesde: dias, estado, detalle: `Última semana cargada: ${fecha.slice(0, 10)}.` };
}

async function estadoCamiones(hoy: string): Promise<Parcial> {
  const { fecha, error } = await ultimaFecha("camiones", "fecha");
  if (error) return sinDatos(`Error al leer camiones: ${error}.`);
  if (!fecha) return sinDatos("Sin cargas de Williams todavía.");
  const dias = diasEntre(fecha.slice(0, 10), hoy);
  // Sin cadencia comprometida (mismo criterio que el healthcheck): solo aviso, nunca rojo.
  const estado: EstadoManual = dias >= 21 ? "pendiente" : "al-dia";
  return { ultimaFecha: fecha, diasDesde: dias, estado, detalle: `Último día cargado: ${fecha.slice(0, 10)}.` };
}

async function estadoMesaColor(hoy: string): Promise<Parcial> {
  const [{ fecha: ultima, error }, hoyRes] = await Promise.all([
    ultimaFecha("mesa_color", "fecha"),
    sbSelect(`mesa_color?select=fecha&fecha=eq.${hoy}&limit=1`, 0),
  ]);
  if (error) return sinDatos(`Error al leer mesa_color: ${error}.`);
  const hoyCargado = hoyRes.ok && Array.isArray(hoyRes.data) && hoyRes.data.length > 0;
  const habil = esHabil(hoy);
  const diasUltima = ultima ? diasEntre(ultima.slice(0, 10), hoy) : null;
  if (!habil) return { ultimaFecha: ultima, diasDesde: diasUltima, estado: "al-dia", detalle: "Hoy no es día hábil." };
  if (hoyCargado) return { ultimaFecha: ultima, diasDesde: diasUltima, estado: "al-dia", detalle: "Ya cargado hoy." };
  return { ultimaFecha: ultima, diasDesde: diasUltima, estado: "pendiente", detalle: "Falta el color de la rueda de hoy." };
}

async function estadoBcraManual(hoy: string): Promise<Parcial> {
  const desde = isoMenosDias(hoy, 14);
  const res = await sbSelect(`compras_bcra?select=fecha&fecha=gte.${desde}`, 0);
  if (!res.ok) return sinDatos(`Error al leer compras_bcra: ${res.reason}.`);
  const fechas = new Set(((res.data as { fecha: string }[] | undefined) ?? []).map((r) => r.fecha));
  const huecos = huecosHabiles(hoy, 14, fechas);
  const ultima = [...fechas].sort().at(-1) ?? null;
  const dias = ultima ? diasEntre(ultima, hoy) : null;
  const estado: EstadoManual = huecos.length === 0 ? "al-dia" : huecos.length <= 2 ? "pendiente" : "atrasado";
  const detalle =
    huecos.length === 0
      ? "Sin huecos hábiles en los últimos 14 días (cubre la API automática y la carga manual)."
      : `${huecos.length} día(s) hábil(es) sin dato: ${huecos.slice(0, 3).join(", ")}${huecos.length > 3 ? "…" : ""}.`;
  return { ultimaFecha: ultima, diasDesde: dias, estado, detalle };
}

async function estadoEstimacion(hoy: string, organismo: string, doradoDias: number, rojoDias: number | null): Promise<Parcial> {
  const { fecha, error } = await ultimaFecha("estimaciones_produccion", "actualizado_en", `&organismo=eq.${organismo}`);
  if (error) return sinDatos(`Error al leer estimaciones_produccion: ${error}.`);
  if (!fecha) return sinDatos(`Sin cargas de ${organismo} todavía.`);
  const dias = diasEntre(fecha.slice(0, 10), hoy);
  const estado: EstadoManual = rojoDias != null && dias >= rojoDias ? "atrasado" : dias >= doradoDias ? "pendiente" : "al-dia";
  return { ultimaFecha: fecha, diasDesde: dias, estado, detalle: `Última carga: ${fecha.slice(0, 10)}.` };
}

async function estadoLecap(hoy: string): Promise<Parcial> {
  const { fecha, error } = await ultimaFecha("lecap_pago_final", "actualizado_en");
  if (error) return sinDatos(`Error al leer lecap_pago_final: ${error}.`);
  if (!fecha) return sinDatos("Sin letras cargadas todavía.");
  const dias = diasEntre(fecha.slice(0, 10), hoy);
  const estado: EstadoManual = dias >= 60 ? "pendiente" : "al-dia";
  return { ultimaFecha: fecha, diasDesde: dias, estado, detalle: `Última letra cargada/actualizada: ${fecha.slice(0, 10)}.` };
}

async function estadoInterpretaciones(): Promise<Parcial> {
  const n = await contarBorradoresInterp();
  return {
    ultimaFecha: null,
    diasDesde: null,
    estado: n > 0 ? "pendiente" : "al-dia",
    detalle: n > 0 ? `${n} borrador(es) esperando revisión.` : "Sin borradores pendientes.",
  };
}

async function estadoViewFeedback(hoy: string): Promise<Parcial> {
  const { fecha: ultima, error } = await ultimaFecha("views_mercado", "fecha");
  if (error) return sinDatos(`Error al leer views_mercado: ${error}.`);
  if (!ultima) return { ultimaFecha: null, diasDesde: null, estado: "al-dia", detalle: "Sin views todavía." };
  const res = await sbSelect(`views_mercado?select=grano,nota_lautaro&fecha=eq.${ultima}`, 0);
  const filas = res.ok ? ((res.data as { grano: string; nota_lautaro: number | null }[] | undefined) ?? []) : [];
  const sinNota = filas.filter((f) => f.nota_lautaro == null);
  const dias = diasEntre(ultima, hoy);
  if (filas.length === 0) return { ultimaFecha: ultima, diasDesde: dias, estado: "atrasado", detalle: `No se pudo leer el detalle del ${ultima}.` };
  const estado: EstadoManual = sinNota.length > 0 ? "pendiente" : "al-dia";
  const detalle =
    sinNota.length > 0
      ? `${sinNota.length} de ${filas.length} view(s) del ${ultima} sin calificar.`
      : `Los ${filas.length} views del ${ultima} ya tienen nota.`;
  return { ultimaFecha: ultima, diasDesde: dias, estado, detalle };
}

const RESOLVERS: Record<string, (hoy: string) => Promise<Parcial>> = {
  agrochat: estadoAgrochat,
  camiones: estadoCamiones,
  "mesa-color": estadoMesaColor,
  "bcra-manual": estadoBcraManual,
  dea: (hoy) => estadoEstimacion(hoy, "DEA", 7, 9),
  pas: (hoy) => estadoEstimacion(hoy, "BCBA", 30, null),
  lecap: estadoLecap,
  interpretaciones: () => estadoInterpretaciones(),
  "view-feedback": estadoViewFeedback,
};

export async function getCargasManuales(hoy: string): Promise<CargaManualEstado[]> {
  const resueltos = await Promise.all(
    CARGAS_MANUALES.map(async (c) => {
      const resolver = RESOLVERS[c.id];
      const parcial = resolver ? await resolver(hoy) : sinDatos("Sin regla de estado definida.");
      return { ...c, ...parcial };
    }),
  );
  return resueltos;
}

/** Cuántos ítems de la lista quedaron "pendiente" o "atrasado" (KPI del panel). */
export function contarCargasPendientes(items: CargaManualEstado[]): number {
  return items.filter((i) => i.estado !== "al-dia").length;
}
