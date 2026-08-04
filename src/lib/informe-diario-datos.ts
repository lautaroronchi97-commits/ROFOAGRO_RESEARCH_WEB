import "server-only";
import { sbSelect, sbSelectAll } from "./supabase";
import { parseRows, construirCambios, organismosPresentes, type Cambio } from "./estimaciones";
import { calcularDeltaSerie, restarDiasISO, type PuntoValor, type DeltaSerie } from "./informe-v3-calc";
import { getCierresGranos, volumenTotalGrano } from "./futuros";
import { getArbitrajes } from "./arbitrajes-cierres";
import { getPizarra } from "./pizarra";
import { getDolarFuturo, getVolumenCambiario } from "./market";
import { getMonitorMercados } from "./monitor-mercados";
import { getNoticias } from "./noticias";
import { getEventos } from "./calendario";
import { getViewMercadoVigentePorGrano } from "./informe-semanal";
import { getDjveResumen } from "./djve";
import { getCamionesPlantas } from "./camiones/plantas";
import { top3PorVolumenDelDia } from "./a3-live";

/**
 * Datos compartidos por las plantillas del informe diario (`/informes/plantilla/diario`,
 * `/informes/plantilla/research` y `/informes/diario/[fecha]`) que NO dependen del formato
 * visual — el borrador de prosa del día, el informe de organismos publicado hoy (+ su
 * interpretación si ya está publicada), las compras BCRA del día, y (E3 de
 * PLAN_INFORMES_V3.md §10) el conjunto COMPLETO de insumos del día (`datosDiario`,
 * antes vivía duplicado dentro de `/api/informes/datos/route.ts`). Extraído para que
 * el route Y las plantillas lean exactamente la MISMA función en vez de reimplementarla
 * cada una.
 */

export type LecturaItem = { titulo: string; texto: string };

/** Δ de la pizarra estimada de la mesa (color del día) vs el último cierre oficial del
 *  cron, por grano — la SKILL la extrae del texto libre y calcula (N5 de
 *  PLAN_INFORMES_V3.md §3): sin número cargado o sin cron actualizado, el campo queda
 *  ausente/null y la plantilla NO muestra variación (degradación honesta). */
export type PizarraEstimadaGrano = {
  usd?: number | null;
  ars?: number | null;
  deltaUsdPct?: number | null;
  deltaArsPct?: number | null;
};

/** Prosa del borrador (una sola fila por fecha, `informes_generados.tipo=diario`).
 *  Campos "diario" (título/comentario/líneas por grano) y "research" (tesis/lectura)
 *  conviven en el mismo JSON — el Paso 2 del skill `informe-diario` escribe los que
 *  correspondan al formato vigente. `pizarraEstimada`/`volumenFisico`/`condicionalDjve`/
 *  `condicionalCamiones` son de la v3 (E3, §5.1/§5.2): la mesa los carga en texto libre
 *  dentro de `mesa_color.texto`, y la skill los extrae/calcula al redactar — nunca la
 *  plantilla, que solo renderiza lo que ya viene resuelto. */
export type ProsaDiaria = {
  titulo?: string;
  comentario?: string[];
  lineas_por_grano?: Record<string, string>;
  tesisTitulo?: string;
  tesisParrafo?: string;
  lectura?: LecturaItem[];
  pizarraEstimada?: Partial<Record<string, PizarraEstimadaGrano>>; // clave SOJ/MAI/TRI
  volumenFisico?: Partial<Record<string, number | null>>; // clave SOJ/MAI/TRI
  condicionalDjve?: string | null;
  condicionalCamiones?: string | null;
};

export type FilaInforme = { titulo: string | null; prosa: ProsaDiaria | null };

export async function getBorrador(fecha: string): Promise<FilaInforme | null> {
  const res = await sbSelect(
    `informes_generados?tipo=eq.diario&fecha=eq.${fecha}&select=titulo,prosa&limit=1`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  return res.data[0] as FilaInforme;
}

export type InformeHoy = { organismo: string; fecha: string | null; informe: string; cambios: Cambio[] };

/**
 * Informes de organismo publicados JUSTO hoy (ej. USDA/CONAB/GEA/DEA) O cargados a la base hoy
 * con una `fecha_publicacion` vieja (BCBA-PAS: Lautoro lo sube con la fecha real del informe,
 * que puede ser de días atrás) — reusa estimaciones.ts. Unificado con el criterio de
 * `/api/informes/datos` (E1 de PLAN_INFORMES_V3.md §10 item 6: antes esta función solo miraba
 * `fecha`, y el route ya usaba también `actualizadoEn` desde el fix de PLAN_INFORMES_V2.md — las
 * dos plantillas (`/informes/plantilla/{diario,research}`) que llaman a esta función divergían
 * del route).
 */
export async function getInformesHoy(fecha: string): Promise<InformeHoy[]> {
  const res = await sbSelectAll(
    "estimaciones_produccion?select=organismo,pais,grano,campania,variable,valor,unidad,fecha_publicacion,informe,url,actualizado_en&order=fecha_publicacion.asc",
    3600,
  );
  if (!res.ok) return [];
  const rows = parseRows(res.data);
  return organismosPresentes(rows)
    .map((o) => construirCambios(rows, o))
    .filter((c) => c.cambios.length > 0 && (c.fecha === fecha || c.actualizadoEn?.slice(0, 10) === fecha));
}

export type Interpretacion = { organismo: string; informe: string; publicado_md: string };

/** MP4 (interpretación de informes de organismos): [] mientras nadie publicó ninguna ese día. */
export async function getInterpretaciones(fecha: string): Promise<Interpretacion[]> {
  const res = await sbSelect(
    `interpretaciones?estado=eq.publicado&fecha_publicacion=eq.${fecha}&select=organismo,informe,publicado_md`,
    0,
  );
  return res.ok && Array.isArray(res.data) ? (res.data as Interpretacion[]) : [];
}

export type BcraDia = { monto_musd: number; fuente: string };

/** Compras BCRA del día (carga manual de /admin/datos — P3 sumará la ingesta automática). */
export async function getBcra(fecha: string): Promise<BcraDia | null> {
  const res = await sbSelect(`compras_bcra?fecha=eq.${fecha}&select=monto_musd,fuente&limit=1`, 0);
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  return res.data[0] as BcraDia;
}

export type VariacionPizarraDiaria = { grano: string; ars: DeltaSerie; usd: DeltaSerie };

/**
 * Δ de la pizarra oficial CAC vs el día hábil anterior, en $ y USD (E1 de PLAN_INFORMES_V3.md
 * §5.1 bloque C) — sobre `pizarra_historico` (la serie diaria que ya alimenta `/graficos` y el
 * comparador semanal), NO sobre el scrape en vivo de `pizarra.ts` (que no tiene historia). Una
 * sola query con 10 días de colchón (cubre fines de semana/feriados largos); si el cron todavía
 * no cargó el día de hoy, `ars.actual`/`usd.actual` degradan solos a null (nunca se inventa).
 */
export async function variacionDiariaPizarra(fecha: string): Promise<VariacionPizarraDiaria[]> {
  const desde = restarDiasISO(fecha, 10);
  const res = await sbSelect(
    `pizarra_historico?select=grano,fecha,precio_ars,precio_usd&grano=in.(soja,maiz,trigo)&fecha=gte.${desde}&fecha=lte.${fecha}&order=fecha.asc`,
    0,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];

  const porGranoArs = new Map<string, PuntoValor[]>();
  const porGranoUsd = new Map<string, PuntoValor[]>();
  for (const r of res.data as Record<string, unknown>[]) {
    const grano = String(r.grano ?? "");
    const f = r.fecha;
    if (!grano || typeof f !== "string") continue;
    const ars = typeof r.precio_ars === "number" ? r.precio_ars : Number(r.precio_ars);
    const usd = typeof r.precio_usd === "number" ? r.precio_usd : Number(r.precio_usd);
    if (Number.isFinite(ars)) {
      const arr = porGranoArs.get(grano) ?? [];
      arr.push({ fecha: f, valor: ars });
      porGranoArs.set(grano, arr);
    }
    if (Number.isFinite(usd)) {
      const arr = porGranoUsd.get(grano) ?? [];
      arr.push({ fecha: f, valor: usd });
      porGranoUsd.set(grano, arr);
    }
  }

  const granos = new Set([...porGranoArs.keys(), ...porGranoUsd.keys()]);
  return [...granos].map((grano) => ({
    grano,
    ars: calcularDeltaSerie(porGranoArs.get(grano) ?? [], fecha, 1),
    usd: calcularDeltaSerie(porGranoUsd.get(grano) ?? [], fecha, 1),
  }));
}

/**
 * TODOS los insumos del informe diario (E3 de PLAN_INFORMES_V3.md §10 item 1: movido acá desde
 * `/api/informes/datos/route.ts` para que el route Y las plantillas —`/informes/plantilla/research`,
 * `/informes/diario/[fecha]`— llamen exactamente la MISMA función en vez de reimplementar cada una
 * su propio subconjunto de queries). El route sigue siendo la única puerta de acceso por token para
 * las Routines externas; las páginas del propio sitio, al correr server-side, la llaman directo
 * (sin roundtrip HTTP).
 */
export async function datosDiario(fecha: string) {
  // Agenda a 7 días (§5.1 bloque H, V3 — antes solo mostraba lo de hoy/mañana).
  const en7 = new Date(new Date(`${fecha}T12:00:00Z`).getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [
    cierres,
    arbitrajes,
    pizarra,
    dolarFuturo,
    chicago,
    noticias,
    colorRes,
    bcraRes,
    estimRes,
    interpRes,
    viewsMercado,
    volumenCambiario,
    djveResumen,
    camionesPlantas,
    variacionPizarra,
    top3PorGrano,
  ] = await Promise.all([
    getCierresGranos(),
    getArbitrajes(),
    getPizarra(),
    getDolarFuturo(),
    getMonitorMercados(),
    // Noticias últimas 24 hs (§5.1 bloque G, V3) — "puede ser cero", no la ventana de 3 días
    // hábiles del panel público.
    getNoticias(24),
    sbSelect(`mesa_color?fecha=eq.${fecha}&select=fecha,texto,chicago_bcr,actualizado`, 0),
    // Compras BCRA: hoy solo carga MANUAL (P3 de PLAN_BACKLOG.md sumará la ingesta
    // automática a esta misma tabla, con fuente='api').
    sbSelect(`compras_bcra?fecha=eq.${fecha}&select=fecha,monto_musd,fuente`, 0),
    sbSelectAll(
      "estimaciones_produccion?select=organismo,pais,grano,campania,variable,valor,unidad,fecha_publicacion,informe,url,actualizado_en&order=fecha_publicacion.asc",
      3600,
    ),
    // MP4 (interpretación de informes de organismos): consulta "adelantada" — mientras la
    // tabla no exista, sbSelect degrada a [] sin romper.
    sbSelect(
      `interpretaciones?estado=eq.publicado&fecha_publicacion=eq.${fecha}&select=organismo,informe,publicado_md,impacto`,
      0,
    ),
    // V4 (PLAN_INFORMES_V2.md §6.4): view vigente por grano con su evidencia_externa ya
    // verificada — el diario la puede citar de contexto, sin research propio.
    getViewMercadoVigentePorGrano(),
    // E1 de PLAN_INFORMES_V3.md §5.1 bloque D: Δ% del oficial + volumen MAE de especies USD —
    // la lib ya trae `oficial`/`oficialVarPct`, una sola vía (no tocar DolarFuturoData).
    getVolumenCambiario(),
    getDjveResumen(),
    getCamionesPlantas(),
    variacionDiariaPizarra(fecha),
    top3PorVolumenDelDia(),
  ]);

  // Color de la rueda: null si no cargó nada ese día (el informe sale igual, degrada).
  const color = colorRes.ok && Array.isArray(colorRes.data) && colorRes.data.length > 0
    ? (colorRes.data[0] as { fecha: string; texto: string; chicago_bcr: string | null; actualizado: string })
    : null;

  const bcra = bcraRes.ok && Array.isArray(bcraRes.data) && bcraRes.data.length > 0
    ? (bcraRes.data[0] as { fecha: string; monto_musd: number; fuente: string })
    : null;

  // Noticias: solo lo citable del día, acotado (top 4 destacadas, ya sobre la ventana de 24 hs).
  const noticiasCompactas = {
    destacados: noticias.destacados.slice(0, 4),
    meta: noticias.meta,
  };

  // Volumen operado del día en A3 por grano (suma de todas las posiciones vivas).
  const volumenPorGrano = Object.fromEntries(
    cierres.granos.map((g) => [g.underlying, volumenTotalGrano(g)]),
  );

  // Informe de organismo publicado JUSTO hoy (ej. USDA/CONAB/GEA/DEA) O cargado a la base
  // hoy con una fecha_publicacion vieja (BCBA-PAS: Lautoro lo sube con la fecha real del
  // informe, que puede ser de días atrás) — fix de auditoría V2: antes solo miraba `fecha`,
  // el disparo de PAS nunca matcheaba. Reusa estimaciones.ts, cero lógica nueva. Si además
  // MP4 ya publicó su interpretación de ese mismo informe, se adjunta vía `interpretaciones`.
  const estimRows = estimRes.ok ? parseRows(estimRes.data) : [];
  const informesHoy = organismosPresentes(estimRows)
    .map((o) => construirCambios(estimRows, o))
    .filter((c) => c.cambios.length > 0 && (c.fecha === fecha || c.actualizadoEn?.slice(0, 10) === fecha));
  const interpretaciones = interpRes.ok && Array.isArray(interpRes.data) ? interpRes.data : [];

  return {
    generado: new Date().toISOString(),
    tipo: "diario" as const,
    fecha,
    cierres,
    arbitrajes,
    pizarra,
    dolarFuturo,
    chicago,
    noticias: noticiasCompactas,
    agenda: getEventos(fecha, en7),
    color,
    bcra,
    volumenPorGrano,
    informesHoy,
    interpretaciones,
    viewsMercado,
    volumenCambiario,
    djveResumen,
    camionesPlantas,
    variacionPizarra,
    top3PorGrano,
  };
}

export type DatosDiario = Awaited<ReturnType<typeof datosDiario>>;
