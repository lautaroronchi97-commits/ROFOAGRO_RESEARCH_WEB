"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";

/**
 * "Datos del día" del informe diario (MP1 de docs/PLAN_INFORMES.md): el "color de
 * la rueda" (texto libre). Va por la RPC SECURITY DEFINER `admin_upsert_mesa_color`
 * (guard is_admin() adentro, migración 20260722120000) con el cliente SSR + sesión
 * del admin. Las compras BCRA tienen su propia carga en `bcra-actions.ts`
 * (`guardarComprasBcraManual`, misma tabla, fecha elegible en vez de solo-hoy).
 */

export type DatosDiaState = { ok?: string; error?: string } | undefined;

export async function guardarDatosDelDia(_prev: DatosDiaState, formData: FormData): Promise<DatosDiaState> {
  await requireAdmin();

  const fecha = String(formData.get("fecha") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida." };

  const texto = String(formData.get("texto") ?? "");

  const supabase = await createSupabaseServerClient();

  // Guard: una vez que el informe diario (MP1) ya generó su registro para esta fecha, ya leyó y
  // redactó con el texto que había en ese momento — editarlo después no cambia la placa que salió,
  // solo desincroniza el registro. Se bloquea acá (no solo en la UI) para que valga también si
  // alguien pega el POST a mano.
  const { data: yaTomado, error: eTomado } = await supabase
    .from("informes_generados")
    .select("id")
    .eq("tipo", "diario")
    .eq("fecha", fecha)
    .limit(1);
  if (eTomado) return { error: eTomado.message };
  if (yaTomado && yaTomado.length > 0) {
    return { error: `El informe diario del ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} ya tomó este dato — queda fijo, no se puede editar.` };
  }

  const { error: eColor } = await supabase.rpc("admin_upsert_mesa_color", {
    p_fecha: fecha,
    p_texto: texto,
  });
  if (eColor) return { error: eColor.message };

  revalidatePath("/admin/datos/mesa-color");
  return { ok: "Datos del día guardados." };
}
