import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Compara un token recibido contra `INFORME_TOKEN` (env) de forma timing-safe.
 * Mismo guard que usan /api/views/insumos (MP3), /api/informes/datos y la
 * plantilla del informe diario (MP1) — un solo lugar para no duplicarlo.
 */
export function tokenValido(recibido: string, esperado: string): boolean {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fecha 'YYYY-MM-DD' válida (guard simple de searchParams/query). */
export function esFechaValida(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Firma HMAC-SHA256 (hex) para los links "1-tap" de nota por mail (N15, E1 de
 * PLAN_INFORMES_V3.md §10 item 7) — `INFORME_SHARE_SECRET` es un secret PROPIO, distinto de
 * `INFORME_TOKEN` (ese autentica a las Routines/sesiones de research contra los endpoints de
 * insumos; este autentica un click sin sesión desde un mail). Reusado por E3/E4 más adelante
 * para el link público firmado del informe diario (§5.4 del plan) con la misma mecánica.
 */
export function firmarInforme(payload: string): string {
  const secret = process.env.INFORME_SHARE_SECRET ?? "";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Compara una firma recibida contra la esperada para `payload`, timing-safe. `false` si falta
 *  el secret (el endpoint queda cerrado si nadie configuró `INFORME_SHARE_SECRET`). */
export function firmaInformeValida(payload: string, recibida: string): boolean {
  const secret = process.env.INFORME_SHARE_SECRET ?? "";
  if (!secret || !recibida) return false;
  const esperada = firmarInforme(payload);
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** `id:n` — el payload que firma el link de nota 1-tap (`/api/informes/nota`). */
export function payloadNota(id: string, n: number): string {
  return `${id}:${n}`;
}
