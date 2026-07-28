/**
 * Parser puro del feed diario de camiones en puerto de **Agroentregas** (C24 del backlog maestro).
 * Research y verificación de la fuente: `docs/negocio/10_fuente_camiones_agroentregas.md`.
 *
 * Fuente: `https://agroentregas.com.ar/RestServiceImpl.svc/camiones` — endpoint JSON público, sin
 * auth ni key, el mismo que la propia página `total-de-camiones.html` consume desde el navegador.
 * Devuelve el JSON envuelto en un sobre XML de WCF (`<CamionesResponse><CamionesResult>{...}`),
 * de ahí el desenvoltorio de este módulo.
 *
 * Qué trae (9 colecciones, `Camiones`..`Camiones8` — 3 bloques de 3):
 *   - `Camiones`  / `Camiones1` / `Camiones2` → HOY: detalle por planta CON empresa / detalle sin
 *     empresa (duplicado, se ignora) / fila de totales por grano.
 *   - `Camiones3` / `Camiones4` / `Camiones5` → mismo DÍA DE SEMANA del año pasado, ídem.
 *   - `Camiones6` / `Camiones7` / `Camiones8` → ídem, dos años atrás.
 *
 * Los dos bloques comparativos NO son la misma fecha calendario sino el mismo día de la semana
 * (28/07/2026, 29/07/2025 y 30/07/2024 son los tres martes) — tiene sentido para un flujo logístico,
 * donde el día de semana pesa más que el número del día. Se ingieren los tres: como el endpoint no
 * acepta parámetro de fecha (probado: los ignora y siempre devuelve hoy) y no hay backfill posible,
 * guardar los comparativos es la ÚNICA forma de acumular historia estacional — corriendo el cron a
 * diario, al año se tienen tres años de Up River sin haber backfilleado nada.
 *
 * ⚠️ ALCANCE GEOGRÁFICO — este feed NO es el total nacional. Sus destinos son plantas de Up River
 * (San Lorenzo, Timbúes, PGSM, Arroyo Seco, Alvear, Gral. Lagos, Villa Constitución, Chabás) y del
 * Paraná bonaerense (San Pedro, Baradero, Ramallo, Lima): **no hay Bahía Blanca ni Necochea**, y
 * solo aparecen las plantas que Agroentregas atiende. Por eso vive en su propia tabla y NUNCA se
 * mezcla con `camiones` (Williams Entregas, 4 zonas = todo el país), que es la serie nacional e
 * histórica que alimenta la señal barcos-vs-camiones.
 *
 * Módulo PURO (sin red ni DB) y self-contained — igual que `williams.ts` y por el mismo motivo:
 * `scripts/ingest-camiones-agroentregas.mjs` lo importa y lo corre con Node plano, sin bundler.
 */

/** Códigos de producto de la web (mismos que `config.ts`/line-up) + OTROS, que solo existe acá. */
export type ProductoAgroentregas = "SFSEED" | "SBS" | "WHEAT" | "MAIZE" | "SORGHUM" | "BARLEY" | "OTROS";

/** Fila `producto='TOTAL'` = el día de esa planta sin abrir por grano (se emite siempre, incluso en 0). */
export type ProductoFila = ProductoAgroentregas | "TOTAL";

/** Nombre del campo en el JSON de origen → código canónico de la web. */
const GRANOS: { campo: string; cod: ProductoAgroentregas }[] = [
  { campo: "GIRASOL", cod: "SFSEED" },
  { campo: "SOJA", cod: "SBS" },
  { campo: "TRIGO", cod: "WHEAT" },
  { campo: "MAIZ", cod: "MAIZE" },
  { campo: "SORGO", cod: "SORGHUM" },
  { campo: "CEBADA", cod: "BARLEY" },
  { campo: "OTROS", cod: "OTROS" },
];

export type FilaPlanta = {
  fecha: string; // ISO yyyy-mm-dd
  plantaId: string;
  planta: string;
  empresa: string;
  producto: ProductoFila;
  cantidad: number;
};

export type BloqueDia = {
  fecha: string;
  /** false para el día de hoy, true para los dos comparativos interanuales. */
  comparativo: boolean;
  plantas: number;
  filas: FilaPlanta[];
};

export type ParseAgroentregas =
  | { ok: true; bloques: BloqueDia[] }
  | { ok: false; error: string };

/** Los 3 tríos (detalle-con-empresa, detalle-sin-empresa que se ignora, totales). */
const TRIOS: { detalle: string; totales: string; comparativo: boolean }[] = [
  { detalle: "Camiones", totales: "Camiones2", comparativo: false },
  { detalle: "Camiones3", totales: "Camiones5", comparativo: true },
  { detalle: "Camiones6", totales: "Camiones8", comparativo: true },
];

type CrudaDetalle = Record<string, unknown>;

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

function entero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** "2026-07-28T00:00:00" → "2026-07-28". Devuelve null si no matchea el formato esperado. */
function fechaISO(v: unknown): string | null {
  const s = texto(v);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1]! : null;
}

/** "Totales a la Fecha: 28/07/2026" → "2026-07-28" (la fila de totales fecha en dd/mm/aaaa). */
function fechaDeTotales(v: unknown): string | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(texto(v));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Desenvuelve el sobre WCF y parsea el JSON. Acepta también el JSON pelado, por si algún día el
 * servicio deja de envolverlo (o para tests).
 */
function desenvolver(cuerpo: string): Record<string, unknown> | null {
  const limpio = cuerpo.replace(/^﻿/, "").trim();
  const m = /<CamionesResult>([\s\S]*)<\/CamionesResult>/.exec(limpio);
  let json = m ? m[1]! : limpio;
  if (m) {
    // El sobre XML escapa el JSON: &quot; &amp; &lt; &gt; &#39;
    json = json
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  try {
    const d: unknown = JSON.parse(json);
    return d && typeof d === "object" ? (d as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Parsea la respuesta cruda del endpoint.
 *
 * Incluye el control de consistencia que la propia fuente permite: la suma del detalle por planta
 * de cada bloque tiene que dar EXACTO la fila de totales que el mismo payload publica. Si no da,
 * se falla en vez de guardar (el formato cambió o la respuesta vino cortada) — no se persiste un
 * día a medias, que después es indistinguible de un día flojo de verdad.
 */
export function parseAgroentregas(cuerpo: string): ParseAgroentregas {
  const d = desenvolver(cuerpo);
  if (!d) return { ok: false, error: "Respuesta ilegible: no se pudo desenvolver el JSON de <CamionesResult>." };

  const bloques: BloqueDia[] = [];
  const vistas = new Set<string>();

  for (const trio of TRIOS) {
    const detalle = d[trio.detalle];
    const totales = d[trio.totales];
    if (!Array.isArray(detalle) || detalle.length === 0) {
      return { ok: false, error: `Colección "${trio.detalle}" ausente o vacía en la respuesta.` };
    }
    if (!Array.isArray(totales) || totales.length === 0) {
      return { ok: false, error: `Colección de totales "${trio.totales}" ausente o vacía en la respuesta.` };
    }

    const filas: FilaPlanta[] = [];
    const sumas = new Map<ProductoAgroentregas, number>();
    let fechaBloque: string | null = null;

    for (const cruda of detalle as CrudaDetalle[]) {
      const fecha = fechaISO(cruda["fecha"]);
      const plantaId = texto(cruda["idDp"]);
      const planta = texto(cruda["nombreDp"]);
      if (!fecha || !plantaId || !planta) {
        return { ok: false, error: `Fila sin fecha/planta válidas en "${trio.detalle}".` };
      }
      if (fechaBloque === null) fechaBloque = fecha;
      else if (fechaBloque !== fecha) {
        return { ok: false, error: `"${trio.detalle}" mezcla fechas (${fechaBloque} y ${fecha}).` };
      }
      // `nombreDe` solo viene en las colecciones "con empresa"; si faltara, se degrada a VARIOS
      // (valor que la propia fuente usa para plantas de servicio multi-empresa) en vez de fallar.
      const empresa = texto(cruda["nombreDe"]) || "VARIOS";

      let totalPlanta = 0;
      for (const g of GRANOS) {
        const n = entero(cruda[g.campo]);
        if (n === null) {
          return { ok: false, error: `Valor no numérico en ${g.campo} de "${planta}" (${trio.detalle}).` };
        }
        totalPlanta += n;
        sumas.set(g.cod, (sumas.get(g.cod) ?? 0) + n);
        // Solo se persisten los granos con movimiento: una (fecha, planta, grano) ausente es 0.
        if (n > 0) filas.push({ fecha, plantaId, planta, empresa, producto: g.cod, cantidad: n });
      }
      // El TOTAL de la planta se emite SIEMPRE, aunque sea 0: así "la planta reportó sin camiones"
      // (la fuente lo marca con OBSERVACION='SIN CAMIONES') queda distinguible de "no reportó".
      filas.push({ fecha, plantaId, planta, empresa, producto: "TOTAL", cantidad: totalPlanta });
    }

    if (fechaBloque === null) return { ok: false, error: `No se pudo determinar la fecha de "${trio.detalle}".` };
    if (vistas.has(fechaBloque)) {
      return { ok: false, error: `La fecha ${fechaBloque} aparece en más de un bloque de la respuesta.` };
    }
    vistas.add(fechaBloque);

    // --- Control de consistencia contra los totales que publica la propia fuente ---
    const filaTot = totales[0] as CrudaDetalle;
    const fechaTot = fechaDeTotales(filaTot["fecha"]);
    if (fechaTot !== fechaBloque) {
      return {
        ok: false,
        error: `La fila de totales "${trio.totales}" es del ${fechaTot ?? "?"} y el detalle del ${fechaBloque}.`,
      };
    }
    for (const g of GRANOS) {
      const declarado = entero(filaTot[g.campo]);
      const calculado = sumas.get(g.cod) ?? 0;
      if (declarado === null) {
        return { ok: false, error: `Total de ${g.campo} no numérico en "${trio.totales}".` };
      }
      if (declarado !== calculado) {
        return {
          ok: false,
          error: `Inconsistencia en ${fechaBloque}: ${g.campo} suma ${calculado} por planta pero la fuente declara ${declarado}.`,
        };
      }
    }

    bloques.push({
      fecha: fechaBloque,
      comparativo: trio.comparativo,
      plantas: (detalle as CrudaDetalle[]).length,
      filas,
    });
  }

  return { ok: true, bloques };
}

/** Total de camiones de un bloque (suma de las filas TOTAL de cada planta). */
export function totalDelBloque(b: BloqueDia): number {
  return b.filas.reduce((acc, f) => (f.producto === "TOTAL" ? acc + f.cantidad : acc), 0);
}
