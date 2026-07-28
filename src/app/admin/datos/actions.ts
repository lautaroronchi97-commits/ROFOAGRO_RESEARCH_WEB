"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { parseAgrochat, claveFila, type ParseOk } from "@/lib/compras/parse-agrochat";
import { chequearIdentidad, type Anomalia } from "@/lib/anomalias";
import { SERIES, IDENTIDADES } from "@/lib/anomalias-series";

/**
 * Server actions del uploader de la serie de comercialización (/admin/datos).
 *
 * Flujo en 2 pasos SIN estado en memoria del server (Vercel serverless: el paso 2 puede
 * caer en otra lambda): el cliente guarda el File elegido en su estado y lo reenvía en
 * los DOS pasos; acá se re-parsea cada vez. Un solo action con `paso=preview|confirm`
 * (el botón que se apreta define el paso).
 *
 * La escritura NO usa service key (no existe en src/ y así debe quedar): va por la RPC
 * SECURITY DEFINER `admin_upsert_compras` (guard is_admin() adentro, migración
 * 20260720120000) con el cliente SSR anon + sesión del admin. Si la migración aún no se
 * aplicó, el error de PostgREST se muestra tal cual en el form.
 */

export type PreviewCarga = {
  archivo: string;
  filas: number;
  crudas: number;
  descartadas: number;
  duplicadas: number;
  desde: string;
  hasta: string;
  granos: string[];
  campanas: string[];
  /** Claves (campana, codigo, sector, fecha) que ya existen en `compras` → se actualizan. */
  existentes: number | null; // null = no se pudo consultar la base
  nuevas: number | null;
  muestra: { fecha: string; grano: string; sector: string; campana: string; semanal: number | null; total: number | null }[];
  advertencias: string[];
};

export type DatosState =
  | {
      error?: string;
      preview?: PreviewCarga;
      ok?: { filas: number; advertencias: string[] };
    }
  | undefined;

/** Lee y parsea el archivo del form (compartido por los dos pasos). */
async function parsearArchivo(formData: FormData): Promise<{ error: string } | { parsed: ParseOk; nombre: string }> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí el archivo del export (CSV o Excel .xlsx)." };
  }
  const datos = new Uint8Array(await archivo.arrayBuffer());
  let r: ReturnType<typeof parseAgrochat>;
  try {
    r = parseAgrochat(datos, archivo.name);
  } catch (e) {
    return { error: `No pude leer el archivo: ${e instanceof Error ? e.message : "formato inválido"}.` };
  }
  if (!r.ok) return { error: r.error };
  return { parsed: r, nombre: archivo.name };
}

/** Cuenta cuántas claves del archivo ya existen en `compras` (para el resumen del paso 1). */
async function contarExistentes(parsed: ParseOk, desde: string, hasta: string): Promise<number | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const claves = new Set(parsed.filas.map(claveFila));
    let existentes = 0;
    const PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await supabase
        .from("compras")
        .select("fecha,codigo_interno,campana,sector")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .range(off, off + PAGE - 1);
      if (error) return null;
      for (const r of data ?? []) {
        if (claves.has(`${r.campana}|${r.codigo_interno}|${r.sector}|${r.fecha}`)) existentes++;
      }
      if (!data || data.length < PAGE) break;
      if (off > 300_000) break; // backstop
    }
    return existentes;
  } catch {
    return null;
  }
}

/**
 * Guard de UNIDADES. El acumulado (`total_comprado_acumulado`) nunca decrece; si el valor
 * subido para una clave (campaña/grano/sector) es mucho menor que el último acumulado que
 * ya hay en la base, casi seguro el export vino en MILES de toneladas (Agrochat "Última
 * Semana") en vez de toneladas enteras → entraría ÷1000 y corrompería la serie. Devuelve
 * las filas sospechosas + si el patrón es sistemático (para bloquear la confirmación).
 */
const FACTOR_SOSPECHA = 0.5; // subido < prev*0.5 = imposible en un acumulado (÷1000 da 0.001)

/** Último acumulado por clave (campaña|codigo|sector) con fecha anterior a `desde`. */
async function referenciaPrevia(desde: string): Promise<Map<string, number> | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const ultima = new Map<string, { fecha: string; ton: number }>();
    const PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await supabase
        .from("compras")
        .select("fecha,codigo_interno,campana,sector,toneladas")
        .lt("fecha", desde)
        .range(off, off + PAGE - 1);
      if (error) return null;
      for (const r of data ?? []) {
        if (r.toneladas == null) continue;
        const k = `${r.campana}|${r.codigo_interno}|${r.sector}`;
        const cur = ultima.get(k);
        if (!cur || r.fecha > cur.fecha) ultima.set(k, { fecha: r.fecha, ton: r.toneladas as number });
      }
      if (!data || data.length < PAGE) break;
      if (off > 400_000) break; // backstop
    }
    const out = new Map<string, number>();
    for (const [k, v] of ultima) out.set(k, v.ton);
    return out;
  } catch {
    return null;
  }
}

async function guardUnidades(
  parsed: ParseOk,
  desde: string,
): Promise<{ bloquear: boolean; mensaje: string | null }> {
  const ref = await referenciaPrevia(desde);
  if (!ref) return { bloquear: false, mensaje: null }; // no se pudo chequear → no bloquear
  let comparables = 0;
  let sospechosas = 0;
  const ejemplos: string[] = [];
  for (const f of parsed.filas) {
    if (f.toneladas == null) continue;
    const prev = ref.get(`${f.campana}|${f.codigo_interno}|${f.sector}`);
    if (prev == null || prev <= 0) continue;
    comparables++;
    if (f.toneladas < prev * FACTOR_SOSPECHA) {
      sospechosas++;
      if (ejemplos.length < 3) {
        ejemplos.push(
          `${f.grano_raw} ${f.sector} ${f.campana}: subís ${Math.round(f.toneladas).toLocaleString("es-AR")} t vs ${Math.round(prev).toLocaleString("es-AR")} t de la semana previa`,
        );
      }
    }
  }
  if (sospechosas === 0) return { bloquear: false, mensaje: null };
  const bloquear = sospechosas >= 3 && sospechosas >= comparables * 0.3;
  const mensaje =
    `Posible problema de UNIDADES: el acumulado de ${sospechosas} de ${comparables} filas comparables es mucho menor que la semana anterior, y el acumulado no puede bajar. ¿El export vino en MILES de toneladas? Pedí el dato en toneladas enteras con el prompt de arriba. Ejemplos → ${ejemplos.join(" · ")}.`;
  return { bloquear, mensaje };
}

/**
 * Detector de anomalías del archivo (D7/L7, `docs/auditoria/E7-sintesis.md` §4): dos chequeos
 * genéricos de `src/lib/anomalias.ts` que el guard de arriba no cubre — ese guard SOLO agarra el
 * ÷1000 comparando contra la semana previa; esto agarra, fila por fila, sin necesitar historia:
 *   · IDENTIDAD: precio hecho + fijado + saldo a fijar deben sumar el acumulado de esa fila (el
 *     typo de BCR en pellets de girasol y el spike de 49,9 Mt eran justamente esto: una columna
 *     que no cierra contra las demás);
 *   · RANGO: el acumulado no puede superar el máximo físicamente posible de una campaña.
 * Mismo patrón que `guardUnidades`: bloquea salvo "forzar", Lautaro está mirando la pantalla.
 */
function chequearAnomaliasArchivo(parsed: ParseOk): Anomalia[] {
  const out: Anomalia[] = [];
  for (const f of parsed.filas) {
    if (f.precio_hecho_tn != null && f.fijado_tn != null && f.saldo_a_fijar_tn != null) {
      const a = chequearIdentidad({
        serie: `${f.grano_raw} · ${f.sector} · ${f.campana}`,
        fecha: f.fecha,
        total: f.toneladas,
        partes: [f.precio_hecho_tn, f.fijado_tn, f.saldo_a_fijar_tn],
        ...IDENTIDADES.compras,
        unidad: "t",
      });
      if (a) out.push(a);
    }
    const { rango, unidad } = SERIES.compras_acumulado;
    if (f.toneladas != null && rango?.max != null && f.toneladas > rango.max) {
      out.push({
        tipo: "rango", serie: `${f.grano_raw} · ${f.sector} · ${f.campana}`, fecha: f.fecha,
        severidad: "alta", valor: f.toneladas, referencia: rango.max,
        mensaje: `${f.grano_raw} ${f.sector} ${f.campana}: ${Math.round(f.toneladas).toLocaleString("es-AR")} ${unidad} supera el máximo físicamente posible de una campaña.`,
      });
    }
  }
  return out;
}

export async function procesarCarga(_state: DatosState, formData: FormData): Promise<DatosState> {
  await requireAdmin();

  const res = await parsearArchivo(formData);
  if ("error" in res) return { error: res.error };
  const { parsed, nombre } = res;

  // parseAgrochat() ya garantiza filas.length>0 acá (si viniera 0 filas, `parsearArchivo` habría
  // devuelto {error} arriba — ver parse-agrochat.ts:420) → fechas siempre tiene al menos 1 elemento.
  const fechas = parsed.filas.map((f) => f.fecha).sort();
  const desde = fechas[0]!;
  const hasta = fechas[fechas.length - 1]!;

  const paso = String(formData.get("paso") ?? "preview");

  // ------------------------------------------------------------------
  // Paso 1 — PREVISUALIZAR: resumen sin escribir nada.
  // ------------------------------------------------------------------
  if (paso !== "confirm") {
    const existentes = await contarExistentes(parsed, desde, hasta);
    const guard = await guardUnidades(parsed, desde);
    const anomalias = chequearAnomaliasArchivo(parsed);
    const granos = [...new Set(parsed.filas.map((f) => f.grano_raw))].sort();
    const campanas = [...new Set(parsed.filas.map((f) => f.campana))].sort();
    return {
      preview: {
        archivo: nombre,
        filas: parsed.filas.length,
        crudas: parsed.totalCrudas,
        descartadas: parsed.descartadas,
        duplicadas: parsed.duplicadas,
        desde,
        hasta,
        granos,
        campanas,
        existentes,
        nuevas: existentes == null ? null : parsed.filas.length - existentes,
        muestra: parsed.filas.slice(0, 5).map((f) => ({
          fecha: f.fecha,
          grano: f.grano_raw,
          sector: f.sector,
          campana: f.campana,
          semanal: f.semanal_tn,
          total: f.toneladas,
        })),
        advertencias: [
          ...parsed.advertencias,
          ...(existentes == null ? ["No pude consultar la base para contar claves existentes."] : []),
          ...(guard.mensaje ? [guard.bloquear ? `🚫 ${guard.mensaje} La carga quedará BLOQUEADA salvo que marques "forzar".` : guard.mensaje] : []),
          ...(anomalias.length ? [`🚫 Detector de anomalías (D7): ${anomalias.length} fila(s) no cierran contra su propia identidad contable o superan un máximo físico. La carga quedará BLOQUEADA salvo que marques "forzar". Ejemplos → ${anomalias.slice(0, 3).map((a) => a.mensaje).join(" · ")}`] : []),
        ],
      },
    };
  }

  // ------------------------------------------------------------------
  // Paso 2 — CONFIRMAR: upsert por lotes vía RPC + refresh de la matview.
  // ------------------------------------------------------------------
  // Guard de unidades: bloquea un export en miles de toneladas (÷1000) salvo "forzar".
  const forzar = String(formData.get("forzar") ?? "") === "1";
  if (!forzar) {
    const guard = await guardUnidades(parsed, desde);
    if (guard.bloquear) {
      return { error: `${guard.mensaje} No se cargó nada. Si estás seguro de que el dato es correcto, marcá "forzar" y confirmá de nuevo.` };
    }
    const anomalias = chequearAnomaliasArchivo(parsed);
    if (anomalias.length > 0) {
      return {
        error: `Detector de anomalías (D7): ${anomalias.length} fila(s) no cierran contra su propia identidad contable o superan un máximo físico. No se cargó nada. Ejemplos → ${anomalias.slice(0, 3).map((a) => a.mensaje).join(" · ")}. Si estás seguro de que el dato es correcto, marcá "forzar" y confirmá de nuevo.`,
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  const advertencias = [...parsed.advertencias];
  const BATCH = 1000;
  let procesadas = 0;
  for (let i = 0; i < parsed.filas.length; i += BATCH) {
    const lote = parsed.filas.slice(i, i + BATCH);
    const { data, error } = await supabase.rpc("admin_upsert_compras", { filas: lote });
    if (error) {
      // Error de PostgREST tal cual (p. ej. la RPC no existe porque falta aplicar la migración).
      return {
        error: `Falló el upsert en la fila ${i + 1} (${procesadas} cargadas antes del error): ${error.message}`,
      };
    }
    procesadas += typeof data === "number" ? data : lote.length;
  }

  // Refresh de compras_avance_hist (% sobre cosecha). Si falla es advertencia, no fallo total:
  // los datos YA quedaron cargados; el refresh se puede correr después.
  const { error: eRefresh } = await supabase.rpc("admin_refresh_compras_avance");
  if (eRefresh) {
    advertencias.push(`Los datos se cargaron pero falló el refresh del avance: ${eRefresh.message}`);
  }

  revalidatePath("/comercio/negociado");
  revalidatePath("/comercio/temperatura");

  return { ok: { filas: procesadas, advertencias } };
}
