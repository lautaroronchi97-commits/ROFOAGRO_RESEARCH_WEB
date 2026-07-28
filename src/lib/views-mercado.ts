import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "./auth/server";
import { sbSelectAll } from "./supabase";
import { calcularScorecard, type Scorecard, type FuturoCierreRow } from "./views-scorecard";

/**
 * views-mercado.ts — lectura del view direccional semanal por grano (V1 de
 * docs/PLAN_INFORMES_V2.md, sucesor de MP3, tabla `views_mercado`).
 *
 * OJO: a diferencia del resto de las libs de datos (supabase.ts con la anon key),
 * los views se leen con el cliente SSR y la SESIÓN del usuario: la tabla es INTERNA
 * MESA (RLS `is_admin()`, migración 20260721150000) y anon no ve nada. La página que
 * la usa está detrás de `requireAdmin()`, así que siempre hay sesión de admin. El
 * scorecard (`getScorecard`, abajo) SÍ usa `sbSelectAll` (env key) porque
 * `futuros_cierres` es una tabla pública — no hace falta la sesión para leerla.
 */

export type GranoView = "soja" | "maiz" | "trigo";
export type DireccionView = "alcista" | "bajista" | "neutral";

export type ArgumentoView = { titulo: string; dato: string };
export type ArgumentosView = {
  a_favor: ArgumentoView[];
  en_contra: ArgumentoView[];
  accion: string;
};

export type RelacionPrevia = "inicial" | "confirma" | "ajusta" | "switch" | "cumplida";

/** Condición de invalidación estructurada (F0 la chequea mecánicamente cada corrida). */
export type Invalidador = {
  condicion: string;
  umbral: string;
  dato_ref: string;
  disparado_en: string | null;
};

/** Pasaporte de un dato del anillo 2 (research externo), verificado en F5. */
export type EvidenciaExterna = {
  dato: string;
  url: string;
  fecha_pub: string;
  cita: string;
};

export type ViewMercado = {
  id: string;
  grano: GranoView;
  fecha: string;
  direccion: DireccionView;
  confianza: number;
  horizonte: string;
  tesis_md: string;
  argumentos: ArgumentosView;
  invalidacion: string;
  feedback_lautaro: string | null;
  creado_en: string;
  relacion_previa: RelacionPrevia | null;
  view_previo_id: string | null;
  invalidadores: Invalidador[];
  evidencia_externa: EvidenciaExterna[];
  nota_lautaro: number | null;
};

export type ViewsMercadoData = {
  /** Último view por grano (o null si ese grano nunca tuvo). */
  vigentes: Record<GranoView, ViewMercado | null>;
  /** Views anteriores (todos los granos mezclados, fecha desc). */
  historial: ViewMercado[];
  error: string | null;
};

export const GRANOS_VIEW: GranoView[] = ["soja", "maiz", "trigo"];
export const GRANO_VIEW_LABEL: Record<GranoView, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
};
export const DIRECCION_VIEW_LABEL: Record<DireccionView, string> = {
  alcista: "ALCISTA",
  bajista: "BAJISTA",
  neutral: "NEUTRAL",
};

function argOk(x: unknown): ArgumentoView[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((a): a is { titulo?: unknown; dato?: unknown } => !!a && typeof a === "object")
    .map((a) => ({ titulo: String(a.titulo ?? ""), dato: String(a.dato ?? "") }))
    .filter((a) => a.titulo || a.dato);
}

function parseArgumentos(x: unknown): ArgumentosView {
  const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  return {
    a_favor: argOk(o.a_favor),
    en_contra: argOk(o.en_contra),
    accion: typeof o.accion === "string" ? o.accion : "",
  };
}

function parseInvalidadores(x: unknown): Invalidador[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => ({
      condicion: String(i.condicion ?? ""),
      umbral: String(i.umbral ?? ""),
      dato_ref: String(i.dato_ref ?? ""),
      disparado_en: typeof i.disparado_en === "string" ? i.disparado_en : null,
    }))
    .filter((i) => i.condicion || i.dato_ref);
}

function parseEvidenciaExterna(x: unknown): EvidenciaExterna[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      dato: String(e.dato ?? ""),
      url: String(e.url ?? ""),
      fecha_pub: String(e.fecha_pub ?? ""),
      cita: String(e.cita ?? ""),
    }))
    .filter((e) => e.dato && e.url);
}

export const getViewsMercado = cache(async (): Promise<ViewsMercadoData> => {
  const vacio: Record<GranoView, ViewMercado | null> = { soja: null, maiz: null, trigo: null };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("views_mercado")
      .select(
        "id,grano,fecha,direccion,confianza,horizonte,tesis_md,argumentos,invalidacion,feedback_lautaro,creado_en,relacion_previa,view_previo_id,invalidadores,evidencia_externa,nota_lautaro",
      )
      .order("fecha", { ascending: false })
      .order("grano", { ascending: true })
      .limit(120);
    if (error) {
      // No filtrar el mensaje crudo de Postgres a la UI (E3 H10): queda en el log del server.
      console.error("[views-mercado] lectura falló:", error.message);
      return { vigentes: vacio, historial: [], error: "todavía-no-hay" };
    }

    const rows: ViewMercado[] = (data ?? []).map((r) => ({
      ...r,
      confianza: Number(r.confianza),
      argumentos: parseArgumentos(r.argumentos),
      invalidadores: parseInvalidadores(r.invalidadores),
      evidencia_externa: parseEvidenciaExterna(r.evidencia_externa),
      nota_lautaro: r.nota_lautaro == null ? null : Number(r.nota_lautaro),
    })) as ViewMercado[];

    const vigentes = { ...vacio };
    const historial: ViewMercado[] = [];
    for (const v of rows) {
      if (GRANOS_VIEW.includes(v.grano) && vigentes[v.grano] === null) vigentes[v.grano] = v;
      else historial.push(v);
    }
    return { vigentes, historial, error: null };
  } catch {
    return { vigentes: vacio, historial: [], error: "todavía-no-hay" };
  }
});

/**
 * Scorecard de todos los views (vigentes + historial) contra `futuros_cierres` — V1
 * §5 de PLAN_INFORMES_V2.md. `futuros_cierres` es pública (RLS abierto a anon/service
 * key indistintamente) — se lee con `sbSelectAll` como el resto de las libs de mercado,
 * no con la sesión del usuario. Nunca tira: si `futuros_cierres` no responde, el
 * scorecard de cada grano queda con `nMedidos: 0` (la UI ya sabe mostrar "sin datos
 * todavía" para eso).
 */
export const getScorecard = cache(async (): Promise<Scorecard> => {
  const { vigentes, historial } = await getViewsMercado();
  const todos = [...GRANOS_VIEW.map((g) => vigentes[g]).filter((v): v is ViewMercado => v !== null), ...historial];
  if (todos.length === 0) {
    return { porGrano: { soja: vacioResumen("soja"), maiz: vacioResumen("maiz"), trigo: vacioResumen("trigo") }, porView: {} };
  }

  const res = await sbSelectAll(
    "futuros_cierres?select=underlying,posicion,fecha,settlement&underlying=in.(SOJ,MAI,TRI)&order=fecha.asc",
    3600,
  );
  type RawRow = { underlying: string; posicion: string; fecha: string; settlement: number | string };
  const rows: FuturoCierreRow[] = res.ok
    ? (res.data as RawRow[]).map((r) => ({
        underlying: r.underlying,
        posicion: r.posicion,
        fecha: r.fecha,
        settlement: Number(r.settlement),
      }))
    : [];

  return calcularScorecard(todos, rows);
});

function vacioResumen(grano: GranoView) {
  return { grano, nMedidos: 0, hitRate: null, brier: null, racha: null };
}
