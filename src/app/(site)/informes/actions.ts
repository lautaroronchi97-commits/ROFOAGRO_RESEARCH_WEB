"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";

/**
 * Feedback de Lautoro sobre un informe (diario o semanal) desde /informes — mini-form visible
 * solo admin (E1 de docs/PLAN_INFORMES_V3.md §9). Va por la RPC SECURITY DEFINER
 * `admin_feedback_informe` (guard is_admin() adentro, migración 20260804120200) con el cliente
 * SSR + sesión del admin — mismo patrón exacto que `admin_feedback_view`/`guardarFeedback` de
 * /granos/view. Texto vacío = limpiar el feedback; nota vacía/inválida = sin nota.
 */

export type FeedbackInformeState = { ok?: string; error?: string } | undefined;

export async function guardarFeedbackInforme(_prev: FeedbackInformeState, formData: FormData): Promise<FeedbackInformeState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const feedback = String(formData.get("feedback") ?? "");
  const notaRaw = String(formData.get("nota") ?? "");
  const nota = /^[1-5]$/.test(notaRaw) ? Number(notaRaw) : null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Informe inválido." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_feedback_informe", {
    p_id: id,
    p_feedback: feedback,
    p_nota: nota,
  });
  if (error) return { error: error.message };
  if (!data) return { error: "El informe no existe." };

  revalidatePath("/informes");
  return { ok: feedback.trim() ? "Feedback guardado." : "Feedback limpiado." };
}
