import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "./auth/server";
import { sbSelect } from "./supabase";

/**
 * Interpretaciones de informes de organismos (MP4 de docs/PLAN_INFORMES.md, ítem 21):
 * borrador → OK de Lautaro en /admin/interpretaciones → publicado. Ver migración
 * 20260723170000_mp4_interpretaciones.sql.
 */

export type EstadoInterp = "borrador" | "publicado" | "descartado";

/** Pasaporte de un dato externo citado (V2, mismo shape que `views_mercado.evidencia_externa`). */
export type EvidenciaInterp = { dato: string; url: string; fecha_pub: string; cita: string };

/** Impacto por grano tocado (V3, §8.1 de PLAN_INFORMES_V3.md) — solo los granos que el reporte
 *  toca; `{}` en filas de V2 o anteriores, y hasta que E2 empiece a escribirlo. */
export type ImpactoGrano = "alcista" | "neutral" | "bajista";
export type Impacto = Partial<Record<string, ImpactoGrano>>;

export type Interpretacion = {
  id: string;
  organismo: string;
  informe: string;
  fecha_publicacion: string;
  granos: string[];
  borrador_md: string;
  publicado_md: string | null;
  estado: EstadoInterp;
  editado_en: string;
  creado_en: string;
  evidencia_externa: EvidenciaInterp[];
  impacto: Impacto;
  auto_publicado: boolean;
};

const COLS_ADMIN =
  "id,organismo,informe,fecha_publicacion,granos,borrador_md,publicado_md,estado,editado_en,creado_en,evidencia_externa,impacto,auto_publicado";

function parseEvidencia(x: unknown): EvidenciaInterp[] {
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

const IMPACTOS_VALIDOS = new Set<ImpactoGrano>(["alcista", "neutral", "bajista"]);

function parseImpacto(x: unknown): Impacto {
  if (!x || typeof x !== "object") return {};
  const out: Impacto = {};
  for (const [grano, val] of Object.entries(x as Record<string, unknown>)) {
    if (typeof val === "string" && IMPACTOS_VALIDOS.has(val as ImpactoGrano)) out[grano] = val as ImpactoGrano;
  }
  return out;
}

/**
 * TODAS las interpretaciones (cualquier estado), para /admin/interpretaciones. Requiere
 * sesión admin (RLS `interpretaciones_select_admin`) — el caller ya corrió requireAdmin().
 */
export const getInterpretacionesAdmin = cache(async (): Promise<Interpretacion[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("interpretaciones")
    .select(COLS_ADMIN)
    .order("fecha_publicacion", { ascending: false })
    .order("creado_en", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    ...r,
    evidencia_externa: parseEvidencia(r.evidencia_externa),
    impacto: parseImpacto(r.impacto),
    auto_publicado: Boolean(r.auto_publicado),
  })) as Interpretacion[];
});

/** Cuántos borradores esperan revisión (badge de la pestaña del panel). */
export async function contarBorradoresInterp(): Promise<number> {
  const filas = await getInterpretacionesAdmin();
  return filas.filter((f) => f.estado === "borrador").length;
}

export type InterpretacionPublica = {
  organismo: string;
  informe: string;
  fecha_publicacion: string;
  granos: string[];
  publicado_md: string;
  /** Cuándo se publicó ESTA interpretación (puede ser mucho después de `fecha_publicacion`,
   * que es la fecha del informe original) — es lo que scopea "Novedades del día" en la home. */
  editado_en: string;
  impacto: Impacto;
};

/**
 * Interpretaciones YA publicadas (lectura pública/cliente vía RLS `estado=publicado`,
 * anon key — mismo patrón que el resto de /produccion). Para "La lectura de la mesa" y para
 * la cabecera de Novedades del día (home).
 */
export async function getInterpretacionesPublicadas(): Promise<InterpretacionPublica[]> {
  const res = await sbSelect(
    "interpretaciones?estado=eq.publicado&select=organismo,informe,fecha_publicacion,granos,publicado_md,editado_en,impacto&order=fecha_publicacion.desc&limit=100",
    300,
  );
  if (!res.ok || !Array.isArray(res.data)) return [];
  return (res.data as Record<string, unknown>[])
    .filter((r) => typeof r.publicado_md === "string" && (r.publicado_md as string).length > 0)
    .map((r) => ({ ...r, impacto: parseImpacto(r.impacto) })) as InterpretacionPublica[];
}
