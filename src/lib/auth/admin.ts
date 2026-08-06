import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "./server";
import { requireAdmin } from "./dal";
import { navegadorYSO } from "./session-id";
import type { ItemsPorSeccion } from "./permisos";

/**
 * Lecturas del panel de administración (Etapa 2). Cada función exige rol admin
 * (requireAdmin, que redirige si no lo es) y lee vía las RPC SECURITY DEFINER de la
 * migración `20260716180000_auth_admin_panel.sql` (con guard `is_admin()` en la base).
 * Degradan a vacío si algo falla (nunca tiran): el panel muestra "sin datos".
 */

export type UsuarioAdmin = {
  id: string;
  email: string;
  nombre: string;
  empresa_texto: string;
  telefono: string;
  estado: "pendiente" | "aprobado" | "rechazado" | "bloqueado";
  rol: "cliente" | "admin";
  empresa_id: string | null;
  empresa_nombre: string | null;
  empresa_secciones: string[] | null;
  secciones_override: string[] | null;
  empresa_items: ItemsPorSeccion | null;
  items_override: ItemsPorSeccion | null;
  created_at: string;
  approved_at: string | null;
  ultimo_login: string | null;
};

export type EmpresaAdmin = {
  id: string;
  nombre: string;
  secciones: string[];
  items: ItemsPorSeccion;
  created_at: string;
  n_usuarios: number;
};

export type ActividadRow = {
  id: number;
  ts: string;
  evento: "login" | "logout" | "seccion" | "kickeado";
  seccion: string | null;
  ip: string | null;
  user_agent: string | null;
  user_id: string;
  nombre: string | null;
  email: string | null;
  empresa_id: string | null;
  empresa_nombre: string | null;
};

/** Todos los usuarios con empresa y último login (más nuevos primero). Deduplicado
 *  por render (React.cache): el badge del layout y la página comparten una sola RPC. */
export const getUsuarios = cache(async (): Promise<UsuarioAdmin[]> => {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_usuarios");
  if (error || !data) return [];
  return data as UsuarioAdmin[];
});

/** Solo los usuarios pendientes de aprobación (para la pantalla de Pendientes). */
export async function getPendientes(): Promise<UsuarioAdmin[]> {
  const usuarios = await getUsuarios();
  return usuarios.filter((u) => u.estado === "pendiente");
}

/** Conteo de pendientes para el badge del panel. */
export async function contarPendientes(): Promise<number> {
  const usuarios = await getUsuarios();
  return usuarios.filter((u) => u.estado === "pendiente").length;
}

/** Empresas con cantidad de usuarios (deduplicado por render). */
export const getEmpresas = cache(async (): Promise<EmpresaAdmin[]> => {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_empresas");
  if (error || !data) return [];
  return data as EmpresaAdmin[];
});

export type FiltroActividad = {
  user?: string;
  empresa?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
};

/** Historial de actividad (access_log) con filtros + paginación. */
export async function getActividad(f: FiltroActividad): Promise<ActividadRow[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_actividad", {
    p_user: f.user ?? null,
    p_empresa: f.empresa ?? null,
    p_desde: f.desde ?? null,
    p_hasta: f.hasta ?? null,
    p_limit: f.limit ?? 50,
    p_offset: f.offset ?? 0,
  });
  if (error || !data) return [];
  return data as ActividadRow[];
}

/** Total de filas de actividad para la paginación (con los mismos filtros). */
export async function contarActividad(f: FiltroActividad): Promise<number> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_actividad_count", {
    p_user: f.user ?? null,
    p_empresa: f.empresa ?? null,
    p_desde: f.desde ?? null,
    p_hasta: f.hasta ?? null,
  });
  if (error || data == null) return 0;
  return Number(data);
}

/** Formatea un timestamp ISO a fecha+hora en zona Córdoba (o "—" si es null). */
export function fmtFechaHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Cordoba",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/** Parseo simple del user-agent → dispositivo + navegador legibles para el panel. */
export function parseUserAgent(ua: string | null): { dispositivo: string; navegador: string } {
  if (!ua) return { dispositivo: "—", navegador: "—" };
  const s = ua.toLowerCase();
  let dispositivo = "Escritorio";
  if (/ipad|tablet/.test(s)) dispositivo = "Tablet";
  else if (/mobi|iphone|android/.test(s)) dispositivo = "Celular";

  const { navegador, so } = navegadorYSO(ua);
  return { dispositivo: so ? `${dispositivo} · ${so}` : dispositivo, navegador };
}
