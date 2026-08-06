import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./server";
import { authConfigured } from "./env";
import { AUTH_ENFORCED, SECCIONES, type SeccionKey } from "./config";
import { itemPermitido, type ItemsPorSeccion } from "./permisos";

/**
 * Data Access Layer de auth (chequeos SEGUROS contra la base — ver guía de
 * autenticación de Next 16 y docs/PLAN_LOGIN.md §3.3). Todo va envuelto en
 * React.cache() para deduplicar por render (una sola lectura de `profiles` por request).
 */

export type Perfil = {
  id: string;
  email: string;
  nombre: string;
  empresa_texto: string;
  telefono: string;
  estado: "pendiente" | "aprobado" | "rechazado" | "bloqueado";
  rol: "cliente" | "admin";
  empresa_id: string | null;
  secciones_override: string[] | null;
  items_override: ItemsPorSeccion | null;
};

/** Usuario autenticado (o null). Valida el JWT contra Supabase Auth. */
export const getAuthUser = cache(async () => {
  if (!authConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Perfil del usuario logueado desde `profiles` (o null si no hay sesión / no existe). */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,nombre,empresa_texto,telefono,estado,rol,empresa_id,secciones_override,items_override")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Perfil;
});

/**
 * "Pase" del usuario: perfil + secciones visibles + ítems permitidos ya resueltos.
 *  - `visibles` = override individual si está seteado (aunque sea vacío = sin acceso),
 *    si no las de la empresa; los admin ven las 9.
 *  - `items` = el mismo criterio de par (override si `secciones_override` no es null,
 *    si no los de la empresa) para la restricción opcional POR ÍTEM dentro de cada
 *    sección visible (06/08/2026) — clave de sección ausente = sin restricción, todos
 *    sus ítems visibles (ver `permisos.ts`).
 * Se lee fresco por request (no hay cookie-cache), así los cambios que hace un admin
 * en permisos/estado impactan de inmediato — no hay caché que invalidar (§3.3 del plan).
 */
export type Acceso = {
  perfil: Perfil;
  esAdmin: boolean;
  empresaSecciones: string[];
  visibles: string[];
  items: ItemsPorSeccion;
};

export const getAcceso = cache(async (): Promise<Acceso | null> => {
  const perfil = await getPerfil();
  if (!perfil) return null;
  const esAdmin = perfil.rol === "admin";

  let empresaSecciones: string[] = [];
  let empresaItems: ItemsPorSeccion = {};
  if (perfil.empresa_id) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("empresas")
      .select("secciones,items")
      .eq("id", perfil.empresa_id)
      .maybeSingle();
    empresaSecciones = (data?.secciones as string[] | undefined) ?? [];
    empresaItems = (data?.items as ItemsPorSeccion | undefined) ?? {};
  }

  const usaOverride = perfil.secciones_override != null;
  const base = usaOverride ? perfil.secciones_override! : empresaSecciones;
  const items = usaOverride ? (perfil.items_override ?? {}) : empresaItems;
  const visibles = esAdmin ? [...SECCIONES] : base;
  return { perfil, esAdmin, empresaSecciones, visibles, items };
});

/**
 * ¿Es visible este ítem puntual (href, sin query/hash) para el acceso dado? Para usar
 * en índices/hub-grid/sidebar que necesitan filtrar una LISTA de ítems ya sabiendo que
 * la sección en sí es alcanzable (por eso `acceso` puede ser null: mismo criterio que
 * ya usan `calculadoras/page.tsx` y `comercio/page.tsx` con `esAdmin` — con
 * `AUTH_ENFORCED` apagado no hay acceso que leer, todo se ve). No redirige: solo dice
 * sí/no, la redirección autoritativa vive en `requireSeccion`.
 */
export function itemVisible(acceso: Acceso | null, seccion: SeccionKey, href: string): boolean {
  if (!acceso) return true;
  return itemPermitido(acceso.esAdmin, acceso.visibles.includes(seccion), acceso.items[seccion], href);
}

/**
 * Exige un usuario aprobado. Redirige según el caso:
 *  - sin sesión → /ingresar
 *  - perfil sin cargar todavía (OAuth recién logueado, falta completar) → /completar
 *  - estado pendiente/rechazado/bloqueado → /pendiente
 * Devuelve el perfil aprobado para que el layout lo use (marca de agua en Etapa 3).
 */
export async function requireAprobado(): Promise<Perfil> {
  const user = await getAuthUser();
  if (!user) redirect("/ingresar");
  const perfil = await getPerfil();
  if (!perfil) redirect("/completar");
  if (perfil.estado !== "aprobado") redirect("/pendiente");
  return perfil;
}

/**
 * Enforcement de permisos por sección (Etapa 2) y, opcionalmente, por ÍTEM dentro de
 * esa sección (06/08/2026 — `item` es el href sin query/hash, ej. "/granos/arbitrajes"
 * o "/calculadoras/a-fijar"; las páginas de índice de cada grupo no pasan `item`,
 * siempre son alcanzables si la sección lo es). Se llama al tope de cada página de
 * sección — las páginas SÍ re-renderizan al navegar (a diferencia de los layouts, por
 * el partial rendering de Next), así el chequeo corre en cada visita.
 *
 * Con `AUTH_ENFORCED` apagado es un NO-OP inmediato: no lee cookies → la página sigue
 * siendo estática/ISR igual que hoy (requisito duro). Con el flag prendido, exige
 * aprobado + permiso de la sección (y del ítem, si se pasó); si no, redirige.
 */
export async function requireSeccion(seccion: SeccionKey, item?: string): Promise<void> {
  if (!AUTH_ENFORCED) return;
  const acceso = await getAcceso();
  if (!acceso) redirect("/ingresar");
  if (acceso.perfil.estado !== "aprobado") redirect("/pendiente");
  if (acceso.esAdmin) return;
  if (!acceso.visibles.includes(seccion)) redirect("/sin-acceso");
  if (item && !itemVisible(acceso, seccion, item)) redirect("/sin-acceso");
}

/**
 * Guard para route handlers de datos (Etapa 3). Con `AUTH_ENFORCED` apagado devuelve
 * null de inmediato (NO lee cookies → la API sigue pública y cacheable como hoy).
 * Con el flag prendido, exige sesión aprobada + permiso de la sección; si falta,
 * devuelve un `Response` (401/403, sin cache) para cortar. Los admin pasan siempre.
 */
export async function guardApiSeccion(seccion: SeccionKey): Promise<Response | null> {
  if (!AUTH_ENFORCED) return null;
  const noCache = { "cache-control": "private, no-store" };
  const acceso = await getAcceso();
  if (!acceso) {
    return Response.json({ error: "No autenticado." }, { status: 401, headers: noCache });
  }
  if (acceso.perfil.estado !== "aprobado") {
    return Response.json({ error: "Cuenta no habilitada." }, { status: 403, headers: noCache });
  }
  if (!acceso.esAdmin && !acceso.visibles.includes(seccion)) {
    return Response.json({ error: "Sección no incluida en tu plan." }, { status: 403, headers: noCache });
  }
  return null;
}

/**
 * Exige rol admin. A diferencia del gate del sitio, NO depende de `AUTH_ENFORCED`:
 * el panel /admin está SIEMPRE protegido (aun con el flag apagado la web es pública,
 * pero /admin nunca lo es). Sin sesión → /ingresar; con sesión no-admin → home.
 */
export async function requireAdmin(): Promise<Perfil> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/ingresar?next=/admin");
  if (perfil.rol !== "admin") redirect("/");
  return perfil;
}
