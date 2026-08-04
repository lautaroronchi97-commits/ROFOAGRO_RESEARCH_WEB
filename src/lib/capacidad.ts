import "server-only";
import { cache } from "react";
import { getPizarra } from "./pizarra";
import { getFobOficial } from "./fob-oficial";
import { leerOverrideEnv } from "./env-utils";
import { parseBcr, parseBcrIndustria } from "./capacidad-bcr-parse";
import {
  cfgSembrada,
  calcularFasTeorico,
  diferencialVsPizarra,
  type CapacidadModeloCfg,
} from "./capacidad-modelo";
import { calcularFasIndustria, CFG_INDUSTRIA_DEFAULT, type CapacidadIndustriaCfg } from "./capacidad-industria-modelo";
import type { Meta } from "./market";

/**
 * Capacidad de pago (FAS Teórico) de granos — TRES lecturas lado a lado:
 *  1. **BCR**: lo que publica la Bolsa de Comercio de Rosario (columna "SAGyP" de su planilla:
 *     FOB oficial − impuestos − gastos portuarios − gastos comerciales; es la MISMA base FOB
 *     que usa nuestro cálculo, así el diferencial entre BCR y Nuestro aísla la diferencia de
 *     SUPUESTOS de gastos, no de fuente de precio).
 *  2. **Nuestro** (ROFO AGRO, `capacidad-modelo.ts`): mismo FOB oficial (`fob-oficial.ts`, fuente
 *     independiente — la API pública de SAGyP/MAGyP, no un scrape de BCR) con derechos de
 *     exportación vigentes + gastos EDITABLES (sembrados desde los propios b)/c) de BCR el
 *     primer render, ajustables por Lautaro en el panel).
 *  3. **Pizarra CAC**: lo que efectivamente paga hoy el mercado (disponible).
 *
 * Research completo (metodologías alternativas, otros organismos, controversia FAS teórico vs
 * mercado, homologación del FOB oficial): docs/sesiones/2026-07-24-c16-capacidad-pago.md.
 *
 * Fuente BCR: https://www.bcr.com.ar/es/mercados/mercado-de-granos/cotizaciones/cotizaciones-locales-1
 * (planilla `#sheet`). Cada bloque "Commodity" agrupa DOS granos (ej. Trigo+Sorgo, Soja+Girasol)
 * en las mismas filas de costos/FAS — el 1er valor numérico de cada fila es SIEMPRE el grano
 * listado primero (columna SAGyP, sin colspans de posiciones forward) y el ÚLTIMO valor es
 * SIEMPRE el grano listado segundo (también SAGyP, sin forwards) — verificado por consistencia
 * aritmética real (impuestos ÷ FOB = alícuota DEX vigente, exacto, para los 5 granos).
 *
 * Overrides manuales (JSON `{"SOJ":320,...}`): `CAPACIDAD_OVERRIDE` pisa el FAS de BCR (legado,
 * emergencia si BCR cae) y `CAPACIDAD_MODELO_OVERRIDE` pisa directo el FAS "Nuestro" ya calculado
 * (para fijar un valor fijo sin tocar gastos/alícuotas).
 *
 * **Excepción: la fila "Girasol"** toma su columna BCR de la sección "Industria Aceitera
 * Exportadora" (`parseBcrIndustria`, mismo bloque "Complejo Soja+Girasol" que arma la fila "Soja
 * (industria)", girasol es el ÚLTIMO valor de cada fila) — NO del bloque "Commodity" (grano sin
 * procesar) que usan los demás granos. Casi toda la producción de girasol se cruza (aceite +
 * pellets), muy poca se exporta como semilla entera, así que el FAS teórico "de grano" queda muy
 * por debajo de lo que de verdad paga el mercado (misma razón por la que existe "Soja
 * (industria)"). A diferencia de soja, girasol NO tiene una fila propia — sin necesidad de
 * separarlo en dos filas: la fila única "Girasol" ya muestra el valor de industria. El FOB
 * oficial de subproductos (aceite/harina) solo está homologado para soja
 * (`POSICIONES_FOB_INDUSTRIA` en fob-oficial.ts) → "Nuestro" para girasol sigue siendo el modelo
 * de grano sin procesar (`capacidad-modelo.ts`, fob-oficial de la semilla entera), único cálculo
 * independiente disponible.
 */

const URL_BCR =
  "https://www.bcr.com.ar/es/mercados/mercado-de-granos/cotizaciones/cotizaciones-locales-1";
const SOURCE_BCR = "Bolsa de Comercio de Rosario";
// Claves literales (no Record<string,string>): evita que noUncheckedIndexedAccess agregue
// "| undefined" a NOMBRES[u] cuando `u` ya es el union literal "SOJ"|"MAI"|"TRI"|"SOR"|"GIR".
const NOMBRES = { SOJ: "Soja", MAI: "Maíz", TRI: "Trigo", SOR: "Sorgo", GIR: "Girasol" } as const;
// Los 5 granos que BCR calcula (Trigo/Maíz/Sorgo/Soja/Girasol) — mismo universo que la pizarra.
const GRANOS_ORDEN = ["SOJ", "MAI", "TRI", "SOR", "GIR"] as const;

export type CapGrano = {
  underlying: string;
  nombre: string;
  fasBcr: number | null; // FAS teórico BCR (SAGyP), USD/tn
  fasNuestro: number | null; // FAS teórico ROFO AGRO, USD/tn
  pizarra: number | null; // disponible USD (CAC) — lo que paga hoy el mercado
  fobOficial: number | null; // FOB oficial (SAGyP/MAGyP) usado en "Nuestro"
  diffBcrUsd: number | null; // pizarra − FAS BCR
  diffBcrPct: number | null;
  diffNuestroUsd: number | null; // pizarra − FAS Nuestro
  diffNuestroPct: number | null;
  cfg: CapacidadModeloCfg; // supuestos usados en "Nuestro" (editables en el cliente)
};
/**
 * FAS Teórico INDUSTRIA (complejo aceite+harina de soja) — capacidad de pago de la industria
 * que crushea, distinta de la de grano sin procesar. Misma estructura BCR/Nuestro/Pizarra que
 * `CapGrano`, pero con la config del modelo de industria (`capacidad-industria-modelo.ts`).
 */
export type CapIndustria = {
  nombre: string;
  fasBcr: number | null;
  fasNuestro: number | null;
  pizarra: number | null;
  diffBcrUsd: number | null;
  diffBcrPct: number | null;
  diffNuestroUsd: number | null;
  diffNuestroPct: number | null;
  cfg: CapacidadIndustriaCfg;
  // FOB de entrada (para que el cliente pueda recalcular "Nuestro" en vivo al editar supuestos).
  fobMercadoAceite: number | null;
  fobOficialAceite: number | null;
  fobMercadoHarina: number | null;
  fobOficialHarina: number | null;
};
export type CapData = {
  granos: CapGrano[];
  industriaSoja: CapIndustria | null;
  fecha: string | null; // fecha de BCR
  fechaFobOficial: string | null; // fecha del FOB oficial usado en "Nuestro"
  meta: Meta; // BCR
  metaFobOficial: Meta;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const getCapacidad = cache(async (): Promise<CapData> => {
  const ovBcr = leerOverrideEnv("CAPACIDAD_OVERRIDE");
  const ovModelo = leerOverrideEnv("CAPACIDAD_MODELO_OVERRIDE");

  let html = "";
  let caida = false;
  try {
    const res = await fetch(URL_BCR, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Mozilla/5.0 (ROFOAGRO research)" },
    });
    if (res.ok) html = await res.text();
    else caida = true;
  } catch {
    caida = true;
  }

  const { porGrano: bcr, fecha } = parseBcr(html, GRANOS_ORDEN);
  const { porGrano: bcrIndustria } = parseBcrIndustria(html, GRANOS_ORDEN);
  const [pizarra, fobOficial] = await Promise.all([getPizarra(), getFobOficial()]);

  const granos: CapGrano[] = GRANOS_ORDEN.map((u) => {
    const filaBcr = bcr[u];
    const ovBcrVal = ovBcr[u];
    // Girasol: la columna BCR sale de la sección Industria (ver docstring del módulo), no del
    // bloque "Commodity" de grano sin procesar — `filaBcr` (bcr[u]) sigue usándose para sembrar
    // los gastos de "Nuestro" (cfgSembrada, abajo), que es un cálculo aparte.
    const fasBcrFuente = u === "GIR" ? (bcrIndustria.GIR?.fas ?? null) : (filaBcr?.fas ?? null);
    const fasBcr = ovBcrVal != null && Number.isFinite(ovBcrVal) ? round2(ovBcrVal) : fasBcrFuente;

    const cfg = cfgSembrada(u, filaBcr);
    const fob = fobOficial.granos[u] ?? null;
    const ovModeloVal = ovModelo[u];
    const fasNuestro =
      ovModeloVal != null && Number.isFinite(ovModeloVal) ? round2(ovModeloVal) : calcularFasTeorico(fob, cfg);

    const pz = pizarra.granos[u]?.usd ?? null;
    const diffBcr = diferencialVsPizarra(pz, fasBcr);
    const diffNuestro = diferencialVsPizarra(pz, fasNuestro);

    return {
      underlying: u,
      nombre: NOMBRES[u],
      fasBcr,
      fasNuestro,
      pizarra: pz,
      fobOficial: fob,
      diffBcrUsd: diffBcr.usd,
      diffBcrPct: diffBcr.pct,
      diffNuestroUsd: diffNuestro.usd,
      diffNuestroPct: diffNuestro.pct,
      cfg,
    };
  }).filter((g) => g.fasBcr != null || g.fasNuestro != null || g.pizarra != null);

  const nBcr = granos.filter((g) => g.fasBcr != null).length;
  const problemas: string[] = [];
  if (caida) problemas.push("BCR no respondió");
  else if (nBcr < GRANOS_ORDEN.length) problemas.push("BCR: faltan granos en el FAS teórico");

  const updatedAtRaw = fecha ? Date.parse(`${fecha}T00:00:00-03:00`) : null;
  const updatedAt = updatedAtRaw !== null && !Number.isNaN(updatedAtRaw) ? updatedAtRaw : null;

  const filaBcrIndustriaSoja = bcrIndustria.SOJ;
  const fasNuestroIndustria = calcularFasIndustria(
    filaBcrIndustriaSoja?.fobAceite ?? null, // FOB mercado aceite (scrape BCR, forward más cercano)
    fobOficial.industria.SOJ_ACEITE ?? null, // FOB oficial aceite (SAGyP/MAGyP, independiente)
    filaBcrIndustriaSoja?.fobPellets ?? null, // FOB mercado harina/pellets
    fobOficial.industria.SOJ_HARINA ?? null, // FOB oficial harina/pellets
    pizarra.granos.SOJ?.usd ?? null, // base de gastos comerciales (así lo define el modelo de referencia)
    CFG_INDUSTRIA_DEFAULT,
  );
  const pzSoja = pizarra.granos.SOJ?.usd ?? null;
  const diffBcrIndustria = diferencialVsPizarra(pzSoja, filaBcrIndustriaSoja?.fas ?? null);
  const diffNuestroIndustria = diferencialVsPizarra(pzSoja, fasNuestroIndustria);
  const industriaSoja: CapIndustria | null =
    filaBcrIndustriaSoja?.fas != null || fasNuestroIndustria != null || pzSoja != null
      ? {
          nombre: "Soja (industria)",
          fasBcr: filaBcrIndustriaSoja?.fas ?? null,
          fasNuestro: fasNuestroIndustria,
          pizarra: pzSoja,
          diffBcrUsd: diffBcrIndustria.usd,
          diffBcrPct: diffBcrIndustria.pct,
          diffNuestroUsd: diffNuestroIndustria.usd,
          diffNuestroPct: diffNuestroIndustria.pct,
          cfg: CFG_INDUSTRIA_DEFAULT,
          fobMercadoAceite: filaBcrIndustriaSoja?.fobAceite ?? null,
          fobOficialAceite: fobOficial.industria.SOJ_ACEITE ?? null,
          fobMercadoHarina: filaBcrIndustriaSoja?.fobPellets ?? null,
          fobOficialHarina: fobOficial.industria.SOJ_HARINA ?? null,
        }
      : null;

  return {
    granos,
    industriaSoja,
    fecha,
    fechaFobOficial: fobOficial.fecha,
    meta: {
      source: SOURCE_BCR,
      updatedAt,
      status: nBcr === GRANOS_ORDEN.length && !caida ? "real" : nBcr > 0 ? "parcial" : "parcial",
      problemas,
    },
    metaFobOficial: fobOficial.meta,
  };
});
