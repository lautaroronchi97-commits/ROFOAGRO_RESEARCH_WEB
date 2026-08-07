import "server-only";
import { cache } from "react";
import { hoyCordobaISO } from "./dates";
import { filaSpot, type PostFob } from "./fob-oficial-parse";
import type { Meta } from "./market";

/**
 * FOB Oficial de granos (SAGyP/MAGyP) — la base imponible legal de los derechos de
 * exportación (Ley 21.453 / Resolución 65/2025). Fuente independiente de BCR: es el
 * dato que la propia BCR republica en la columna "SAGyP" de su planilla.
 *
 * API JSON pública, sin auth, verificada con requests reales el 24/07/2026 (misma
 * familia de dominio que `ingest-compras.mjs`, alcanzable desde Actions/sandboxes que
 * SÍ tienen bloqueado `datosestimaciones.magyp.gob.ar` — ver
 * docs/sesiones/2026-07-24-c16-capacidad-pago.md):
 *   https://www.magyp.gob.ar/sitio/areas/ss_mercados_agropecuarios/ws/ssma/precios_fob.php?Fecha=dd/mm/aaaa
 * Devuelve `{"posts":[{fecha,circular,posicion,precio,mesDesde,añoDesde,mesHasta,añoHasta}]}`
 * — un valor por posición arancelaria (NCM) Y por ventana de embarque (mes/año). No calcula
 * precio sábados/domingos/feriados (devuelve `[]`) → si el día pedido está vacío, se
 * reintenta hacia atrás hasta encontrar la última circular publicada (mismo patrón "T-1"
 * que la pizarra/CBOT).
 *
 * Mapeo posición → grano (homologado EMPÍRICAMENTE, no por nomenclador): se pidió la
 * misma fecha en esta API y en el dataset histórico de datos.gob.ar (que sí trae nombres
 * legibles, ej. "habas_soja_demas_granel_hasta_15_porciento_embolsado") y se matchearon
 * los precios exactos del mismo día — desambigua, por ejemplo, que el maíz estándar
 * ("los demás") es la posición 10059010190Y y NO una posición de maíz pisingallo (que
 * comparte el mismo prefijo NCM de 8 dígitos) ni el maíz flint/plata (premium). Detalle
 * completo con la evidencia numérica: docs/sesiones/2026-07-24-c16-capacidad-pago.md.
 */
const URL_FOB = "https://www.magyp.gob.ar/sitio/areas/ss_mercados_agropecuarios/ws/ssma/precios_fob.php";
const SOURCE = "Secretaría de Agricultura, Ganadería y Pesca (SAGyP/MAGyP)";

/** Posición NCM homologada por grano — solo la variedad "estándar"/comercial de cada uno. */
export const POSICIONES_FOB: Record<string, string> = {
  SOJ: "12019000190C", // habas de soja, "los demás", a granel ≤15% embolsado
  MAI: "10059010190Y", // maíz, "los demás" (estándar), a granel ≤15% embolsado
  TRI: "10019900110W", // trigo pan, "los demás", a granel ≤15% embolsado
  SOR: "10079000100W", // sorgo granífero, "los demás", a granel ≤15% embolsado
  GIR: "12060090910Y", // semilla de girasol, uso industrial "los demás" (oleaginoso estándar, excluye confitería)
};

/**
 * Posiciones de los subproductos de la industria aceitera (soja y girasol) — para el FAS
 * Teórico INDUSTRIA (`capacidad-industria-modelo.ts`). Aparte de `POSICIONES_FOB` (no cuentan
 * para su status "real"/"parcial": son un cálculo adicional, no de los 5 granos principales).
 * Homologadas con el mismo cruce empírico (fecha 21/01/2025 vs datos.gob.ar):
 *   aceite_soja_granel = 1042 el 21/01/2025 → 15071000100Q
 *   tortas_..._soja_pellets_harina_extr = 335 el 21/01/2025 → 23040010100B (23040010200G da idéntico precio)
 *   aceite_girasol_granel = 1080 el 21/01/2025 → 15121110310E (fix 07/08/2026: se sumó girasol)
 *   tortas_..._girasol_pellets_extr = 223 el 21/01/2025 → 23063010310V
 * Girasol suma FOB oficial de aceite/pellets, pero "Nuestro Industria" para girasol sigue SIN
 * calcularse: falta confirmar con Lautaro los rindes de molienda, alícuotas DEX, fobbing y
 * gastos comerciales propios de girasol (los de `CFG_INDUSTRIA_DEFAULT` son de soja, verificados
 * contra un modelo de referencia — no corresponde reusarlos para otro grano sin confirmar).
 */
export const POSICIONES_FOB_INDUSTRIA: Record<string, string> = {
  SOJ_ACEITE: "15071000100Q", // aceite de soja crudo, a granel
  SOJ_HARINA: "23040010100B", // harina/pellets de soja (extracción)
  GIR_ACEITE: "15121110310E", // aceite de girasol crudo, a granel
  GIR_HARINA: "23063010310V", // harina/pellets de girasol (extracción)
};

export type FobOficialData = {
  granos: Record<string, number | null>; // USD/tn, posición "spot" (ventana de embarque más cercana)
  industria: Record<string, number | null>; // ídem, subproductos (SOJ_ACEITE/SOJ_HARINA)
  fecha: string | null; // ISO de la circular usada (puede ser < hoy si hoy no publicó todavía)
  circular: string | null;
  meta: Meta;
};

function toDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function addDaysISO(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function fetchDia(iso: string): Promise<PostFob[] | null> {
  const url = `${URL_FOB}?Fecha=${encodeURIComponent(toDDMMYYYY(iso))}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Mozilla/5.0 (ROFOAGRO research)" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { posts?: PostFob[] };
    return Array.isArray(json.posts) ? json.posts : null;
  } catch {
    return null;
  }
}

export const getFobOficial = cache(async (): Promise<FobOficialData> => {
  const hoy = hoyCordobaISO();
  let iso = hoy;
  let posts: PostFob[] | null = null;
  // Camino T-1: fin de semana/feriado o circular de hoy todavía no publicada.
  for (let i = 0; i < 7; i++) {
    posts = await fetchDia(iso);
    if (posts && posts.length > 0) break;
    iso = addDaysISO(iso, -1);
  }

  const granos: Record<string, number | null> = {};
  const industria: Record<string, number | null> = {};
  let circular: string | null = null;
  let fecha: string | null = null;
  if (posts && posts.length > 0) {
    for (const [u, posicion] of Object.entries(POSICIONES_FOB)) {
      const fila = filaSpot(posts, posicion);
      granos[u] = fila ? fila.precio : null;
      if (fila) {
        circular = fila.circular;
        fecha = fila.fecha.slice(0, 10);
      }
    }
    for (const [u, posicion] of Object.entries(POSICIONES_FOB_INDUSTRIA)) {
      industria[u] = filaSpot(posts, posicion)?.precio ?? null;
    }
  } else {
    for (const u of Object.keys(POSICIONES_FOB)) granos[u] = null;
    for (const u of Object.keys(POSICIONES_FOB_INDUSTRIA)) industria[u] = null;
  }

  const n = Object.values(granos).filter((v) => v != null).length;
  const problemas: string[] = [];
  if (n === 0) problemas.push("SAGyP/MAGyP no respondió (FOB oficial)");
  else if (fecha && fecha !== hoy) problemas.push(`FOB oficial de ${fecha} (última circular publicada)`);
  else if (n < Object.keys(POSICIONES_FOB).length) problemas.push("SAGyP: faltan granos en el FOB oficial");

  const updatedAtRaw = fecha ? Date.parse(`${fecha}T00:00:00-03:00`) : null;
  const updatedAt = updatedAtRaw !== null && !Number.isNaN(updatedAtRaw) ? updatedAtRaw : null;

  return {
    granos,
    industria,
    fecha,
    circular,
    meta: {
      source: SOURCE,
      updatedAt,
      status: n === Object.keys(POSICIONES_FOB).length ? "real" : n > 0 ? "parcial" : "parcial",
      problemas,
    },
  };
});
