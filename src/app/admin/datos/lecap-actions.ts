"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";

/**
 * Carga manual del "pago final por letra" (C13/P9) — el importe que la LECAP/BONCAP paga al
 * vencimiento (VN 100). Se fija en la emisión y casi no cambia (solo cuando el Tesoro licita
 * letras nuevas), así que va por carga semi-manual, sin cron ni el patrón de "huecos hábiles"
 * del BCRA. Fuente última BYMA (lo que Lautaro tiene en su Excel, o el informe de IAMC).
 * Escritura por RPC `admin_upsert_lecap_pago_final` (guard is_admin(), migración 20260724140000).
 *
 * Formato de entrada: una letra por línea, `TICKER  PAGO_FINAL  [FECHA_VENCIMIENTO]` separados por
 * espacio/tab/coma/;  (ej. `S31L6  117.677  2026-07-31`). El pago final acepta coma o punto decimal.
 * La fecha es opcional (YYYY-MM-DD o DD/MM/AAAA); si falta y el ticker es nuevo, queda sin fecha.
 */

export type FilaLecap = { ticker: string; pago_final: number; fecha_vencimiento: string | null };

export type LecapState =
  | { error?: string; nota?: string; preview?: { filas: FilaLecap[] }; ok?: { filas: number } }
  | undefined;

function parseFecha(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // DD/MM/AAAA
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

// Guard de rango (D7/L7, 03/08/2026): el pago final es VN 100 — nunca puede ser menor al
// capital (100) y el máximo real cargado hoy es 161,10 (T15E7, la BONCAP más larga). 400 da
// aire de sobra para tasas más altas sin dejar pasar un error de tipeo típico (una coma corrida
// o un dígito de más, ej. "1176,8" en vez de "117,68").
const PAGO_FINAL_MIN = 100;
const PAGO_FINAL_MAX = 400;

function parsePagoFinal(raw: string | undefined): number | null {
  if (!raw) return null;
  // acepta coma o punto decimal; los valores son VN 100, sin separador de miles.
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (n < PAGO_FINAL_MIN || n > PAGO_FINAL_MAX) return null;
  return n;
}

function parseTexto(texto: string): { filas: FilaLecap[]; errores: string[] } {
  const filas: FilaLecap[] = [];
  const errores: string[] = [];
  const vistos = new Set<string>();
  const lineas = texto.split(/\r?\n/);
  for (const linea of lineas) {
    const t = linea.trim();
    if (!t || t.startsWith("#")) continue;
    const partes = t.split(/[\s,;\t]+/).filter(Boolean);
    const ticker = (partes[0] ?? "").toUpperCase();
    if (!/^[A-Z]\d{2}[A-Z]\d$/.test(ticker) && !/^[A-Z]{1,2}\d{2,3}[A-Z]?\d?$/.test(ticker)) {
      errores.push(`Ticker no reconocido: "${partes[0] ?? ""}"`);
      continue;
    }
    const pago = parsePagoFinal(partes[1]);
    if (pago === null) {
      const n = Number((partes[1] ?? "").replace(",", "."));
      const fueraDeRango = Number.isFinite(n) && (n < PAGO_FINAL_MIN || n > PAGO_FINAL_MAX);
      errores.push(
        fueraDeRango
          ? `Pago final fuera de rango para ${ticker}: ${partes[1]} (esperado ${PAGO_FINAL_MIN}-${PAGO_FINAL_MAX}, VN 100 — ¿coma corrida?)`
          : `Pago final inválido para ${ticker}: "${partes[1] ?? ""}"`,
      );
      continue;
    }
    if (vistos.has(ticker)) {
      errores.push(`Ticker repetido: ${ticker}`);
      continue;
    }
    vistos.add(ticker);
    filas.push({ ticker, pago_final: pago, fecha_vencimiento: parseFecha(partes[2]) });
  }
  return { filas, errores };
}

export async function procesarLecap(_state: LecapState, formData: FormData): Promise<LecapState> {
  await requireAdmin();

  const texto = String(formData.get("texto") ?? "");
  if (!texto.trim()) return { error: "Pegá al menos una línea (ticker y pago final)." };

  const { filas, errores } = parseTexto(texto);
  if (filas.length === 0) {
    return { error: `No pude leer ninguna letra. ${errores.slice(0, 3).join(" · ")}` };
  }

  const paso = String(formData.get("paso") ?? "preview");
  if (paso !== "confirm") {
    const nota = errores.length
      ? `${errores.length} línea(s) ignorada(s): ${errores.slice(0, 3).join(" · ")}`
      : undefined;
    return { preview: { filas }, nota };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_upsert_lecap_pago_final", { filas });
  if (error) return { error: error.message };

  revalidatePath("/dolar");
  revalidatePath("/admin/datos");
  return { ok: { filas: typeof data === "number" ? data : filas.length } };
}
