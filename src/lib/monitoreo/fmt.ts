/**
 * Formato de fechas del panel admin — extraído de `/admin/conexiones` para que
 * `/admin/checklist` lo reuse sin duplicar.
 */

/** "YYYY-MM-DD…" → "DD/MM/AA" (por string, sin Intl — mismo criterio que ddmm() de semaforo-panel.tsx). */
export function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

export function fmtFechaHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
