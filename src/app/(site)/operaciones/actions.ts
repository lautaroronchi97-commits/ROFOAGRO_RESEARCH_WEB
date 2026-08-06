"use server";

import { revalidatePath } from "next/cache";
import { getAcceso } from "@/lib/auth/dal";
import { requireSeccion } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { validarOperacion, normalizarVolumen, type OperacionInputRaw } from "@/lib/operaciones/registro";

/**
 * Server actions de "Mis operaciones" (C31, docs/PLAN_OPERACIONES_CLIENTES.md §4.4
 * capa 2 · §8 item 4). Mismo patrón que `completarPerfil`
 * (`src/app/auth/actions.ts:127`): `createSupabaseServerClient()` con la sesión del
 * usuario, NUNCA la service key — acá la RLS de `operaciones` es la garantía real
 * (aunque el `empresa_id` viniera forjado, la policy lo rechaza igual).
 *
 * Regla de oro: para un cliente, `empresa_id` sale SIEMPRE de `getAcceso()` en el
 * server; para un admin (`getAcceso().esAdmin`), del selector de empresa del form.
 */

export type OperacionFormState = { error?: string; ok?: string } | undefined;

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function leerInput(formData: FormData): OperacionInputRaw {
  const unidad = String(formData.get("volumen_unidad") ?? "tn") === "kg" ? "kg" : "tn";
  const volumenValor = numOrNull(formData.get("volumen"));
  return {
    fecha: String(formData.get("fecha") ?? ""),
    lado: String(formData.get("lado") ?? ""),
    producto: String(formData.get("producto") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    condicion: String(formData.get("condicion") ?? ""),
    campania: String(formData.get("campania") ?? "").trim(),
    volumen: volumenValor != null ? normalizarVolumen(volumenValor, unidad) : null,
    precio: numOrNull(formData.get("precio")),
    moneda: String(formData.get("moneda") ?? ""),
    descuentoPct: numOrNull(formData.get("descuento_pct")),
    descuentoMonto: numOrNull(formData.get("descuento_monto")),
    entregaDesde: String(formData.get("entrega_desde") ?? ""),
    entregaHasta: String(formData.get("entrega_hasta") ?? ""),
    fijacionDesde: String(formData.get("fijacion_desde") ?? ""),
    fijacionHasta: String(formData.get("fijacion_hasta") ?? ""),
    posicionA3: String(formData.get("posicion_a3") ?? "").trim(),
    esCanje: formData.get("es_canje") === "1",
    contraparte: String(formData.get("contraparte") ?? ""),
    nroContrato: String(formData.get("nro_contrato") ?? ""),
    observaciones: String(formData.get("observaciones") ?? ""),
  };
}

/** Resuelve el empresa_id de escritura: propio para clientes, elegido para admins. */
async function empresaDeEscritura(formData: FormData): Promise<{ empresaId: string } | { error: string }> {
  const acceso = await getAcceso();
  if (!acceso) return { error: "Iniciá sesión de nuevo." };
  if (acceso.esAdmin) {
    const empresaId = String(formData.get("empresa_id") ?? "").trim();
    if (!empresaId) return { error: "Elegí la empresa." };
    return { empresaId };
  }
  if (!acceso.perfil.empresa_id) return { error: "Tu cuenta todavía no tiene una empresa asignada." };
  return { empresaId: acceso.perfil.empresa_id };
}

function revalidarPaginas(): void {
  revalidatePath("/operaciones");
  revalidatePath("/operaciones/acumulada");
  revalidatePath("/operaciones/registro");
}

export async function crearOperacion(_prev: OperacionFormState, formData: FormData): Promise<OperacionFormState> {
  await requireSeccion("operaciones");

  const emp = await empresaDeEscritura(formData);
  if ("error" in emp) return { error: emp.error };

  const val = validarOperacion(leerInput(formData));
  if (!val.ok) return { error: val.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("operaciones").insert({ ...val.data, empresa_id: emp.empresaId });
  if (error) return { error: "No se pudo guardar la operación. Probá de nuevo." };

  revalidarPaginas();
  return { ok: "Operación guardada." };
}

export async function editarOperacion(_prev: OperacionFormState, formData: FormData): Promise<OperacionFormState> {
  await requireSeccion("operaciones");

  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Operación inválida." };

  const val = validarOperacion(leerInput(formData));
  if (!val.ok) return { error: val.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("operaciones").update(val.data).eq("id", id).select("id").maybeSingle();
  if (error) return { error: "No se pudo actualizar la operación." };
  if (!data) return { error: "No encontramos esa operación (¿es de otra empresa?)." };

  revalidarPaginas();
  return { ok: "Operación actualizada." };
}

async function alternarAnulada(formData: FormData, anulada: boolean, verboOk: string): Promise<OperacionFormState> {
  await requireSeccion("operaciones");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Operación inválida." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("operaciones").update({ anulada }).eq("id", id).select("id").maybeSingle();
  if (error) return { error: `No se pudo ${anulada ? "anular" : "restaurar"} la operación.` };
  if (!data) return { error: "No encontramos esa operación." };

  revalidarPaginas();
  return { ok: verboOk };
}

export async function anularOperacion(_prev: OperacionFormState, formData: FormData): Promise<OperacionFormState> {
  return alternarAnulada(formData, true, "Operación anulada.");
}

export async function restaurarOperacion(_prev: OperacionFormState, formData: FormData): Promise<OperacionFormState> {
  return alternarAnulada(formData, false, "Operación restaurada.");
}
