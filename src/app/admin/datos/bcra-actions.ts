"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { numDeInput } from "@/lib/format";

/**
 * Carga manual de "Compras netas BCRA (MULC)" (C4/PLAN_BACKLOG.md) para una fecha CUALQUIERA —
 * no solo hoy. La ingesta automática (scripts/ingest-bcra-mulc.mjs, cron diario L-V) llega con
 * ~3-4 días hábiles de rezago; esto tapa ese hueco reciente y se pisa solo (mismo PK `fecha`,
 * `fuente` pasa de 'manual' a 'api') en cuanto el dato oficial aparece — no hace falta borrar
 * nada a mano. Misma RPC `admin_upsert_compras_bcra` que ya usaba "Datos del día" (MP1).
 */

export type BcraManualState = { ok?: string; error?: string } | undefined;

export async function guardarComprasBcraManual(_prev: BcraManualState, formData: FormData): Promise<BcraManualState> {
  await requireAdmin();

  const fecha = String(formData.get("fecha") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida." };

  const montoRaw = String(formData.get("monto") ?? "").trim();
  if (!montoRaw) return { error: "Cargá un monto." };
  const monto = numDeInput(montoRaw);
  if (!Number.isFinite(monto)) return { error: "El monto no es un número válido." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_upsert_compras_bcra", {
    p_fecha: fecha,
    p_monto_musd: monto,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/datos/bcra-manual");
  revalidatePath("/dolar");
  return { ok: `Compras BCRA del ${fecha.slice(8, 10)}/${fecha.slice(5, 7)} guardadas.` };
}
