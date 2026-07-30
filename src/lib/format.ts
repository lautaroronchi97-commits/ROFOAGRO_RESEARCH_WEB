/** Formateo de números al estilo argentino: 1.234,5 */

export function nfmt(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(value)
    .replace("-", "−"); // glifo menos tipográfico (U+2212) unificado en toda la app
}

/** Porcentaje con signo explícito: +1,2% / −0,5% */
export function pfmt(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const s = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${s}%`;
}

/** Valor con signo (para spreads en USD): +14,27 / −4,00 */
export function sfmt(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const s = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${s}`;
}

/** Formato de tasa: 12,8% (sin forzar el signo +, negativo con −). */
export function rfmt(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${nfmt(value, decimals).replace("-", "−")}%`;
}

export type Dir = "up" | "down" | "flat";

export function dirOf(value: number | null | undefined): Dir {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0)
    return "flat";
  return value > 0 ? "up" : "down";
}

export function arrowOf(dir: Dir): string {
  return dir === "up" ? "▲" : dir === "down" ? "▼" : "–";
}

/** Parsea un input numérico con coma decimal ("1,5" → 1.5); NaN si no es válido. */
export function numDeInput(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Date → "YYYY-MM-DD" para inputs type="date". */
export function fmtInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Hora de la rueda en zona horaria de Córdoba. */
export function horaCordoba(d: Date = new Date(), withSeconds = true): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(d);
}

/** Fecha + hora completa en Córdoba ("30/07 04:12") — para stamps que necesitan el día,
 *  no solo la hora (relevamiento web R8, punto 52: DJVE quiere la fecha completa arriba). */
export function fechaHoraCordoba(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
