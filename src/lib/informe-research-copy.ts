/**
 * Prosa curada de la plantilla "Research" (tesis del día + "lo que se lee
 * acá"), por fecha. Prototipo (30/07/2026, "probemos"): mientras no se
 * integre como Paso 2 del skill `informe-diario`, esta prosa se carga acá a
 * mano, grounded en los números reales del día — nunca un número inventado,
 * los valores que aparecen en la placa siempre salen de `informe-research.ts`.
 */

export type LecturaItem = { titulo: string; texto: string };

export type CopyResearch = {
  tesisTitulo: string;
  tesisParrafo: string;
  lectura: LecturaItem[];
};

const COPY: Record<string, CopyResearch> = {
  "2026-07-30": {
    tesisTitulo: "El desfasaje de hoy va en las dos direcciones — y el carry sigue perdiendo contra el dólar",
    tesisParrafo:
      "Chicago cerró más flojo que A3 en maíz (−0,69% contra el −0,37% del ajuste de ayer) y más firme en trigo " +
      "(+0,42% contra un A3 que no se movió) — no hay un solo sentido para leer la apertura de mañana, hay que " +
      "mirar grano por grano. Lo que sí es parejo: ninguna posición de referencia de trigo, maíz o soja rinde hoy " +
      "lo que paga el dólar futuro — la brecha más chica es la de trigo DIC26 (17,16% TNA) contra el 18,99% de USD AGO26.",
    lectura: [
      {
        titulo: "Soja y maíz",
        texto:
          "El complejo cerró parejo a la baja en Chicago (poroto −0,36%, aceite −0,47%, harina −0,25%), sin " +
          "ninguna pata corriendo distinto de las demás — la caída es del complejo entero, no de un componente " +
          "puntual. El ajuste local de maíz (−0,37%) todavía no descontó los −0,69% de hoy en Chicago: la apertura " +
          "de mañana debería traer presión adicional.",
      },
      {
        titulo: "Trigo",
        texto:
          "Es el único de los tres donde A3 se quedó atrás: el ajuste de ayer no se movió (0,00%) mientras Chicago " +
          "sumó +0,42% hoy. Con la posición DIC26 pagando 17,16% TNA — la más alta de los tres granos, aunque " +
          "todavía por debajo del 18,99% del dólar futuro AGO26 — es el que más cerca está de competir con el " +
          "carry en dólares.",
      },
      {
        titulo: "Riesgo",
        texto:
          "El WTI cayó −1,20% en el día: sin presión adicional de biocombustibles, el complejo soja no tiene de " +
          "dónde sacar sostén hoy. Con el volumen operado en maíz liderando la rueda (1.851 contratos, contra " +
          "1.003 de soja y 414 de trigo), el maíz es también el que concentra la atención de la mesa.",
      },
    ],
  },
};

export function setCopyResearch(fecha: string, copy: CopyResearch): void {
  COPY[fecha] = copy;
}

export function getCopyResearch(fecha: string): CopyResearch | null {
  return COPY[fecha] ?? null;
}
