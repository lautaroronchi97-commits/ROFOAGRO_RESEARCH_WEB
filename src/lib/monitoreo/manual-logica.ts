/**
 * Lógica PURA de `manual.ts` (fechas/huecos hábiles), separada a propósito en un módulo sin
 * `import "server-only"` para que sea testeable con Vitest (el paquete `server-only` tira un
 * error apenas se lo importa fuera de un Server Component — ni siquiera bajo Node/Vitest).
 * Mismo patrón que `anomalias.ts` (motor puro) vs. los wrappers de I/O del resto de `src/lib/`.
 */

export type EstadoManual = "al-dia" | "pendiente" | "atrasado";

/** Lunes a viernes (getUTCDay: 0=domingo..6=sábado). */
export function esHabil(iso: string): boolean {
  const dia = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dia >= 1 && dia <= 5;
}

export function isoMenosDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Días hábiles de los últimos `dias` (sin contar hoy) que NO están en `fechasConDato`. */
export function huecosHabiles(hoyISO: string, dias: number, fechasConDato: Set<string>): string[] {
  const desde = isoMenosDias(hoyISO, dias);
  const faltantes: string[] = [];
  for (let d = isoMenosDias(hoyISO, 1); d >= desde; d = isoMenosDias(d, 1)) {
    if (esHabil(d) && !fechasConDato.has(d)) faltantes.unshift(d);
  }
  return faltantes;
}
