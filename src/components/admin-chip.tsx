/**
 * Chip de estado del panel admin (verde/dorado/rojo/neutro) — extraído de `/admin/conexiones`
 * (vivía ahí como función local `chip()`) para que `/admin/checklist` lo reuse sin duplicar
 * los mismos 4 colores/clases dos veces.
 */

export type Color = "verde" | "dorado" | "rojo" | "neutro";

const CLASE: Record<Color, string> = {
  verde: "estado-aprobado",
  dorado: "estado-pendiente",
  rojo: "estado-bloqueado",
  neutro: "",
};

export function AdminChip({ color, texto }: { color: Color; texto: string }) {
  return <span className={`admin-chip ${CLASE[color]}`}>{texto}</span>;
}
