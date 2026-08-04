/**
 * pas-condicion-calc.ts — agregaciones PURAS sobre `pas_condicion` (C27, docs/PLAN_PAS_ZONAS.md
 * §6), separadas de `pas-condicion.ts` (que trae "server-only" para el fetch con la sesión de
 * admin) para poder testear con Node/Vitest pelado — mismo patrón que `pas-zonas-calc.ts`.
 * `pas-condicion.ts` reexporta todo esto, así el resto del código importa un solo módulo.
 */

export type FilaCondicionDB = {
  grano: string;
  ciclo: string;
  zona: string;
  campania: string;
  semana: number;
  siembra_pct: number | null;
  cc_mala: number | null;
  cc_regular: number | null;
  cc_normal: number | null;
  cc_buena: number | null;
  cc_excelente: number | null;
  ch_sequia: number | null;
  ch_regular: number | null;
  ch_adecuada: number | null;
  ch_optima: number | null;
  ch_exceso: number | null;
  fenologia: { etapa: string; pct: number | null }[];
};

// Orden de exhibición (soja/maíz/trigo/girasol — el que usa el prompt de ejecución del plan).
// SOLO estos 4: cebada y sorgo no tienen este reporte en BCBA (confirmado por Lautaro,
// docs/PLAN_PAS_ZONAS.md §1.8) — no dejar un hueco fantasma para ellos en el selector.
export const GRANOS_CONDICION = ["soja", "maiz", "trigo", "girasol"] as const;
export type GranoCondicion = (typeof GRANOS_CONDICION)[number];
export const GRANO_CONDICION_LABEL: Record<GranoCondicion, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
  girasol: "Girasol",
};

const ORDEN_CICLO: Record<string, number> = { total: 0, "1ra": 1, "2da": 2 };
function ordenarCiclos(ciclos: string[]): string[] {
  return [...ciclos].sort((a, b) => (ORDEN_CICLO[a] ?? 9) - (ORDEN_CICLO[b] ?? 9));
}

/** Granos presentes en los datos, en el orden de exhibición de GRANOS_CONDICION. */
export function granosPresentes(filas: FilaCondicionDB[]): string[] {
  const presentes = new Set(filas.map((f) => f.grano));
  return GRANOS_CONDICION.filter((g) => presentes.has(g));
}

/** Ciclos disponibles para un grano (derivado de los datos reales, nunca hardcodeado por
 * cultivo: hoy soja/maíz traen 1ra/2da y trigo/girasol no, pero si el origen cambia esto se
 * adapta solo). 'total' primero cuando existe. */
export function ciclosDeGrano(filas: FilaCondicionDB[], grano: string): string[] {
  return ordenarCiclos([...new Set(filas.filter((f) => f.grano === grano).map((f) => f.ciclo))]);
}

/** Campañas (ascendente) de un grano+ciclo. */
export function campaniasDeGranoCiclo(filas: FilaCondicionDB[], grano: string, ciclo: string): string[] {
  return [...new Set(filas.filter((f) => f.grano === grano && f.ciclo === ciclo).map((f) => f.campania))].sort();
}

/** Default del selector: la campaña más reciente. */
export function campaniaDefaultCondicion(filas: FilaCondicionDB[], grano: string, ciclo: string): string | null {
  const campanias = campaniasDeGranoCiclo(filas, grano, ciclo);
  return campanias.at(-1) ?? null;
}

export type PuntoCondicion = { semana: number; valor: number | null };
export type SerieCampania = { campania: string; puntos: PuntoCondicion[] };

/** Overlay de campañas (semana → valor) para una métrica derivada de dos categorías (ej.
 * Buena+Excelente, Adecuada+Óptima) — mismo concepto conceptual que el modo Campañas de
 * /graficos: cada campaña es una serie propia, el panel destaca la vigente y atenúa las demás. */
function overlayDosCategorias(
  filas: FilaCondicionDB[],
  grano: string,
  ciclo: string,
  a: keyof FilaCondicionDB,
  b: keyof FilaCondicionDB,
): SerieCampania[] {
  const campanias = campaniasDeGranoCiclo(filas, grano, ciclo);
  return campanias.map((campania) => {
    const deCampania = filas
      .filter((f) => f.grano === grano && f.ciclo === ciclo && f.campania === campania)
      .sort((x, y) => x.semana - y.semana);
    const puntos: PuntoCondicion[] = deCampania.map((f) => {
      const va = f[a] as number | null;
      const vb = f[b] as number | null;
      const valor = va != null && vb != null ? va + vb : null;
      return { semana: f.semana, valor };
    });
    return { campania, puntos };
  });
}

/** Chart 1 — condición de cultivo: % Buena+Excelente por semana de campaña, una serie por campaña. */
export function overlayBuenaExcelente(filas: FilaCondicionDB[], grano: string, ciclo: string): SerieCampania[] {
  return overlayDosCategorias(filas, grano, ciclo, "cc_buena", "cc_excelente");
}

/** Chart 2 — condición hídrica: % Adecuada+Óptima por semana de campaña, una serie por campaña. */
export function overlayAdecuadaOptima(filas: FilaCondicionDB[], grano: string, ciclo: string): SerieCampania[] {
  return overlayDosCategorias(filas, grano, ciclo, "ch_adecuada", "ch_optima");
}

export type DeltaCondicion = {
  campania: string;
  semanaActual: number;
  semanaPrevia: number;
  valorActual: number;
  valorPrevio: number;
  deltaPts: number;
};

/**
 * Δ de "Buena+Excelente" entre las 2 últimas semanas CON DATO de la campaña vigente — informe
 * semanal v3 (E4, §6.1 "Producción": PAS condición "si hubo cambios significativos"). `null` si
 * el grano no tiene datos de condición, o si la campaña vigente todavía no acumuló 2 semanas
 * comparables (recién arrancó, o el corte semanal trae huecos). No inventa nada: reusa el mismo
 * overlay que ya pinta el chart de `/produccion/condicion`, solo mira sus últimos 2 puntos.
 */
export function deltaCondicionReciente(filas: FilaCondicionDB[], grano: string, ciclo: string): DeltaCondicion | null {
  const campania = campaniaDefaultCondicion(filas, grano, ciclo);
  if (!campania) return null;
  const serie = overlayBuenaExcelente(filas, grano, ciclo).find((s) => s.campania === campania);
  if (!serie) return null;
  const conValor = serie.puntos.filter((p) => p.valor != null).sort((a, b) => a.semana - b.semana);
  if (conValor.length < 2) return null;
  const actual = conValor[conValor.length - 1]!;
  const previa = conValor[conValor.length - 2]!;
  return {
    campania,
    semanaActual: actual.semana,
    semanaPrevia: previa.semana,
    valorActual: actual.valor as number,
    valorPrevio: previa.valor as number,
    deltaPts: (actual.valor as number) - (previa.valor as number),
  };
}

export type SerieEtapa = { etapa: string; puntos: { semana: number; pct: number | null }[] };

/** Chart 3 — fenología: una serie por etapa (nombres literales del header, en su orden real),
 * para el grano+ciclo+campaña elegidos. */
export function fenologiaCampania(filas: FilaCondicionDB[], grano: string, ciclo: string, campania: string): SerieEtapa[] {
  const deCampania = filas
    .filter((f) => f.grano === grano && f.ciclo === ciclo && f.campania === campania)
    .sort((x, y) => x.semana - y.semana);
  if (deCampania.length === 0) return [];
  // El orden de etapas es el mismo en todas las filas de un grano (viene del header del export
  // original) — se toma de la primera fila disponible del grano, no solo de esta campaña, para
  // no perder el orden si la campaña elegida tuviera huecos en alguna etapa.
  const referencia = filas.find((f) => f.grano === grano) ?? deCampania[0]!;
  const etapas = referencia.fenologia.map((e) => e.etapa);
  return etapas.map((etapa) => ({
    etapa,
    puntos: deCampania.map((f) => ({ semana: f.semana, pct: f.fenologia.find((e) => e.etapa === etapa)?.pct ?? null })),
  }));
}
