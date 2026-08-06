"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { requireAdmin } from "@/lib/auth/dal";
import { SECCIONES } from "@/lib/auth/config";
import { notificarAprobacion } from "@/lib/auth/emails";
import { BIBLIOTECA_PERMISOS } from "@/lib/biblioteca";
import { normalizarItems, type ItemsPorSeccion } from "@/lib/auth/permisos";

export type AdminState = { error?: string; ok?: string } | undefined;

/** Refresca listas y badge del panel tras una mutación. */
function refrescar() {
  revalidatePath("/admin", "layout");
}

/** Filtra una lista de secciones dejando solo las 9 claves canónicas válidas. */
function seccionesValidas(input: FormDataEntryValue[]): string[] {
  const set = new Set(SECCIONES as readonly string[]);
  return input.map(String).filter((s) => set.has(s));
}

/**
 * Arma el mapa `items` (permisos por ítem, 06/08/2026) a partir de los checkboxes
 * `items__<seccionKey>` del form, para las secciones que quedaron activas.
 */
function itemsDesdeForm(formData: FormData, seccionesActivas: string[]): ItemsPorSeccion {
  return normalizarItems(BIBLIOTECA_PERMISOS, seccionesActivas, (key) =>
    formData.getAll(`items__${key}`).map(String)
  );
}

// ============================================================================
// PENDIENTES
// ============================================================================

/**
 * Aprueba un usuario: le asigna empresa (existente por id, o una nueva por nombre,
 * que se crea con las 7 secciones habilitadas por defecto) y lo pasa a 'aprobado'.
 * Manda el email de "acceso activo". Todo bajo RLS de admin.
 */
export async function aprobarUsuario(_state: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const userId = String(formData.get("userId") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const empresaNueva = String(formData.get("empresa_nueva") ?? "").trim();
  if (!userId) return { error: "Falta el usuario." };

  // Resolver la empresa a asignar.
  let empresaFinal: string | null = null;
  if (empresaNueva) {
    // Crear empresa nueva con las 7 secciones por defecto (el admin puede recortar después).
    const { data: emp, error: eEmp } = await supabase
      .from("empresas")
      .insert({ nombre: empresaNueva, secciones: [...SECCIONES] })
      .select("id")
      .single();
    if (eEmp || !emp) {
      return { error: eEmp?.code === "23505" ? "Ya existe una empresa con ese nombre." : "No se pudo crear la empresa." };
    }
    empresaFinal = emp.id as string;
  } else if (empresaId) {
    empresaFinal = empresaId;
  } else {
    return { error: "Elegí una empresa existente o escribí el nombre de una nueva." };
  }

  // Datos del usuario para el email de aprobación.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("email,nombre")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({
      estado: "aprobado",
      empresa_id: empresaFinal,
      approved_at: new Date().toISOString(),
      approved_by: admin.id,
    })
    .eq("id", userId);
  if (error) return { error: "No se pudo aprobar el usuario." };

  if (perfil?.email) {
    await notificarAprobacion(perfil.email as string, (perfil.nombre as string) ?? "");
  }

  refrescar();
  return { ok: "Usuario aprobado." };
}

/** Rechaza un registro pendiente. */
export async function rechazarUsuario(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "Falta el usuario." };
  const { error } = await supabase.from("profiles").update({ estado: "rechazado" }).eq("id", userId);
  if (error) return { error: "No se pudo rechazar." };
  refrescar();
  return { ok: "Registro rechazado." };
}

// ============================================================================
// USUARIOS
// ============================================================================

/** Bloquea o desbloquea (vuelve a 'aprobado') un usuario. */
export async function alternarBloqueo(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const userId = String(formData.get("userId") ?? "").trim();
  const accion = String(formData.get("accion") ?? "");
  if (!userId) return { error: "Falta el usuario." };
  const nuevo = accion === "bloquear" ? "bloqueado" : "aprobado";
  const { error } = await supabase.from("profiles").update({ estado: nuevo }).eq("id", userId);
  if (error) return { error: "No se pudo actualizar el estado." };
  refrescar();
  return { ok: nuevo === "bloqueado" ? "Usuario bloqueado." : "Usuario desbloqueado." };
}

/** Promueve a admin o degrada a cliente. No permite auto-degradarse (evita lockout). */
export async function alternarRol(_state: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const userId = String(formData.get("userId") ?? "").trim();
  const accion = String(formData.get("accion") ?? "");
  if (!userId) return { error: "Falta el usuario." };
  if (accion === "degradar" && userId === admin.id) {
    return { error: "No podés quitarte a vos mismo el rol de admin." };
  }
  const nuevo = accion === "promover" ? "admin" : "cliente";
  const { error } = await supabase.from("profiles").update({ rol: nuevo }).eq("id", userId);
  if (error) return { error: "No se pudo cambiar el rol." };
  refrescar();
  return { ok: nuevo === "admin" ? "Ahora es admin." : "Rol cambiado a cliente." };
}

/** Cambia la empresa de un usuario (o la deja sin empresa). */
export async function cambiarEmpresa(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const userId = String(formData.get("userId") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!userId) return { error: "Falta el usuario." };
  const { error } = await supabase
    .from("profiles")
    .update({ empresa_id: empresaId || null })
    .eq("id", userId);
  if (error) return { error: "No se pudo cambiar la empresa." };
  refrescar();
  return { ok: "Empresa actualizada." };
}

/**
 * Cierra las sesiones activas de un usuario (Etapa 3, sesión única). Escribe un
 * session_id centinela: en el próximo request del usuario, el proxy detecta que su
 * sesión ya no es la vigente y lo obliga a ingresar de nuevo.
 */
export async function cerrarSesionesUsuario(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "Falta el usuario." };
  const { error } = await supabase.rpc("admin_cerrar_sesiones", { p_user: userId });
  if (error) return { error: "No se pudo cerrar la sesión del usuario." };
  refrescar();
  return { ok: "Sesión cerrada. El usuario va a tener que ingresar de nuevo." };
}

/**
 * Guarda el override individual de secciones. Si `usar_override` no viene, se pone
 * null (el usuario hereda las secciones de su empresa). Si viene, se guardan las
 * seleccionadas (puede ser vacío = sin acceso a ninguna sección).
 */
export async function guardarOverride(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "Falta el usuario." };
  const usar = formData.get("usar_override") != null;
  const secciones = usar ? seccionesValidas(formData.getAll("secciones")) : null;
  const items = usar ? itemsDesdeForm(formData, secciones!) : null;
  const { error } = await supabase
    .from("profiles")
    .update({ secciones_override: secciones, items_override: items })
    .eq("id", userId);
  if (error) return { error: "No se pudieron guardar los permisos." };
  refrescar();
  return { ok: usar ? "Permisos individuales guardados." : "Vuelve a heredar de la empresa." };
}

// ============================================================================
// EMPRESAS
// ============================================================================

/** Crea una empresa con las secciones marcadas (por defecto, las que elija el form). */
export async function crearEmpresa(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) return { error: "Escribí el nombre de la empresa." };
  const secciones = seccionesValidas(formData.getAll("secciones"));
  const items = itemsDesdeForm(formData, secciones);
  const { error } = await supabase.from("empresas").insert({ nombre, secciones, items });
  if (error) {
    return { error: error.code === "23505" ? "Ya existe una empresa con ese nombre." : "No se pudo crear la empresa." };
  }
  refrescar();
  return { ok: "Empresa creada." };
}

/** Renombra una empresa y/o edita sus secciones (permisos que heredan sus usuarios). */
export async function guardarEmpresa(_state: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("empresa_id") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id) return { error: "Falta la empresa." };
  if (nombre.length < 2) return { error: "El nombre no puede quedar vacío." };
  const secciones = seccionesValidas(formData.getAll("secciones"));
  const items = itemsDesdeForm(formData, secciones);
  const { error } = await supabase.from("empresas").update({ nombre, secciones, items }).eq("id", id);
  if (error) {
    return { error: error.code === "23505" ? "Ya existe una empresa con ese nombre." : "No se pudieron guardar los cambios." };
  }
  refrescar();
  return { ok: "Empresa actualizada." };
}
