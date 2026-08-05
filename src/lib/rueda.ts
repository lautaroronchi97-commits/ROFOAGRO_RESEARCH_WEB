/**
 * Horarios de las ruedas de Matba Rofex (hora Córdoba), fuente compartida entre
 * el indicador visual del header (`rueda-status.tsx`, client) y la capa de datos
 * en vivo de A3 (`a3-live.ts`, server). Horarios oficiales:
 *   - Dólar / Monedas: 10:00 a 15:00 (ajuste 15:00).
 *   - Agro / granos:   10:30 a 17:00 (ajuste 17:00).
 * Rueda abierta = día hábil (L-V) dentro del horario. Sin `server-only`: es
 * cálculo puro (Intl + aritmética), seguro tanto en cliente como en servidor.
 */

export type Rueda = { nombre: string; label: string; abre: number; cierra: number }; // abre/cierra = minutos desde 00:00

export const RUEDA_DOLAR: Rueda = { nombre: "Dólar", label: "10:00–15:00", abre: 10 * 60, cierra: 15 * 60 };
export const RUEDA_AGRO: Rueda = { nombre: "Agro", label: "10:30–17:00", abre: 10 * 60 + 30, cierra: 17 * 60 };
export const RUEDAS: Rueda[] = [RUEDA_DOLAR, RUEDA_AGRO];

/** Minutos desde medianoche y día de semana (0=Dom … 6=Sáb) en Córdoba. */
export function ahoraCordoba(d: Date = new Date()): { min: number; dow: number } {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const h = Number(get("hour"));
  const m = Number(get("minute"));
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { min: (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m), dow: dias[get("weekday")] ?? 0 };
}

/** ¿La rueda `r` está abierta ahora (hábil L-V dentro del horario)? */
export function ruedaAbierta(r: Rueda, ahora: { min: number; dow: number } = ahoraCordoba()): boolean {
  const habil = ahora.dow >= 1 && ahora.dow <= 5;
  return habil && ahora.min >= r.abre && ahora.min < r.cierra;
}

/** Atajo: ¿está abierta la rueda de granos (Agro)? */
export function ruedaAgroAbierta(d?: Date): boolean {
  return ruedaAbierta(RUEDA_AGRO, ahoraCordoba(d));
}

/** ¿Está abierta ahora alguna de las ruedas (Dólar o Agro)? */
export function algunaRuedaAbierta(d?: Date): boolean {
  const ahora = ahoraCordoba(d);
  return RUEDAS.some((r) => ruedaAbierta(r, ahora));
}

/**
 * ¿La rueda `r` YA ABRIÓ hoy? (hábil L-V y pasó su horario de apertura, sin
 * importar si ya cerró). Sirve para la tabla de arbitrajes: desde que abre la
 * rueda hasta que sale el ajuste del día, la referencia es el último operado —
 * y eso incluye el rato post-cierre, antes de que se publique el ajuste.
 */
export function ruedaCorrioHoy(r: Rueda, ahora: { min: number; dow: number } = ahoraCordoba()): boolean {
  const habil = ahora.dow >= 1 && ahora.dow <= 5;
  return habil && ahora.min >= r.abre;
}

/** Atajo: ¿ya abrió hoy la rueda de granos (Agro)? */
export function ruedaAgroCorrioHoy(d?: Date): boolean {
  return ruedaCorrioHoy(RUEDA_AGRO, ahoraCordoba(d));
}

const FEED_DESDE_MIN = 10 * 60; // 10:00, apertura de la 1ª rueda (Dólar)
const FEED_HASTA_MIN = 17 * 60 + 30; // 17:30 — media hora de margen tras el cierre de Agro (17:00)

/**
 * ¿Tiene sentido abrir el WS de A3 en vivo ahora? Ventana un poco más amplia
 * que "alguna rueda abierta" (10:00–17:30 hábil vs. 10:00–17:00 real): cubre
 * el rato post-cierre en el que puede tardar en salir el ajuste, pero evita
 * conectar de madrugada/fin de semana cuando el mercado no tiene nada nuevo
 * que dar (antes se conectaba igual y el WS agotaba el timeout sin datos).
 * Gatea `getFuturosLive`/`getPasesLive` (páginas públicas, ISR); el informe
 * diario (Routine 18:30 ART) necesita el último operado incluso después de
 * este corte y usa `getFuturosLiveSinHorario`, que no pasa por acá.
 */
export function feedLiveNecesario(d?: Date): boolean {
  const ahora = ahoraCordoba(d);
  const habil = ahora.dow >= 1 && ahora.dow <= 5;
  return habil && ahora.min >= FEED_DESDE_MIN && ahora.min < FEED_HASTA_MIN;
}
