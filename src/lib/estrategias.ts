/**
 * Motor de estrategias combinadas de opciones (modelo de los Excels INTAGRO).
 * Una estrategia = combinación de PATAS (futuro / call / put, compra o venta,
 * con cantidad de contratos). Se grafica el resultado neto por tonelada a cada
 * precio final del subyacente. Ver docs/ESTRATEGIAS_CATALOGO.md.
 *
 *   futuro compra: P − entrada        futuro venta: entrada − P
 *   call compra:   max(P−k,0) − prima call venta:   prima − max(P−k,0)
 *   put  compra:   max(k−P,0) − prima put  venta:   prima − max(k−P,0)
 *
 * Costos (lote L4, auditoría E7, 23/07/2026 — decisión de Lautoro: reusar el tarifario
 * A3/Cocos de costos.ts, con un toggle "estrategia pura" vs "con costos"): como acá no
 * existe (todavía) un tamaño de contrato por mercado — ESTRATEGIAS_CATALOGO.md lo deja
 * como pendiente —, el "monto" gravable de cada pata es `|prima_o_strike| × cttos`,
 * consistente con que TODO el motor ya trabaja en USD/tonelada (cttos = toneladas
 * equivalentes). Es una simplificación explícita: revisar cuando Lautoro traiga un
 * ejemplo numérico propio de una estrategia con costos (pendiente del prompt L4 original).
 */
import { ARANCELES, costoFila, type Persona } from "./costos";

export type Tipo = "futuro" | "call" | "put";
export type Lado = "compra" | "venta";
export type Pata = { tipo: Tipo; lado: Lado; cttos: number; strike: number; prima: number };

export function payoffPata(P: number, pata: Pata): number {
  const q = (pata.cttos || 0) * (pata.lado === "compra" ? 1 : -1);
  if (pata.tipo === "futuro") return q * (P - pata.strike);
  const intr = pata.tipo === "call" ? Math.max(P - pata.strike, 0) : Math.max(pata.strike - P, 0);
  return q * (intr - pata.prima);
}

/**
 * Qué implica cada pata en criollo (relevamiento web R5, punto 45: "al seleccionar,
 * explicar qué implica vender/lanzar y si es futuro u opción") — derivado de la
 * pata real, no de un texto fijo por preset: así también sirve cuando el usuario
 * edita las patas a mano ("estrategia personalizada").
 */
export function describirPata(pata: Pata): string {
  if (pata.tipo === "futuro") {
    return pata.lado === "compra"
      ? "Comprás el futuro: te comprometés a comprar al vencimiento."
      : "Vendés el futuro: te comprometés a vender al vencimiento.";
  }
  const activo = pata.tipo === "call" ? "call" : "put";
  const accion = pata.tipo === "call" ? "comprar" : "vender";
  return pata.lado === "compra"
    ? `Comprás un ${activo}: pagás la prima y tenés el DERECHO (no la obligación) de ${accion} al strike.`
    : `Lanzás (vendés) un ${activo}: cobrás la prima y asumís la OBLIGACIÓN de ${accion} si te ejercen.`;
}

export function payoffTotal(P: number, patas: Pata[]): number {
  return patas.reduce((a, p) => a + payoffPata(P, p), 0);
}

const ARANCEL_OPCIONES = ARANCELES.find((a) => a.id === "opciones")!;
const ARANCEL_FUTUROS = ARANCELES.find((a) => a.id === "futuros")!;

/** Costo (comisión + derechos + IVA) de UNA pata, tarifario A3/Cocos — ver nota del módulo. */
export function costoPata(pata: Pata, persona: Persona, ivaPct: number): number {
  const cttos = Math.abs(pata.cttos || 0);
  if (cttos === 0) return 0;
  const arancel = pata.tipo === "futuro" ? ARANCEL_FUTUROS : ARANCEL_OPCIONES;
  const monto = (pata.tipo === "futuro" ? Math.abs(pata.strike) : Math.abs(pata.prima)) * cttos;
  const com = persona === "humana" ? arancel.humana : arancel.juridica;
  return costoFila(monto, com, arancel.derechosPct, ivaPct, 0).total;
}

/** Costo total de la estrategia (suma de patas). */
export function costoEstrategia(patas: Pata[], persona: Persona, ivaPct: number): number {
  return patas.reduce((a, p) => a + costoPata(p, persona, ivaPct), 0);
}

/** Prima por defecto según distancia al ATM (decae con la lejanía). Editable luego. */
function pr(strike: number, B: number, S: number): number {
  const d = Math.abs(strike - B) / (S || 1);
  return Math.max(1, Math.round(0.6 * S * Math.exp(-0.7 * d)));
}
const opt = (tipo: "call" | "put", lado: Lado, k: number, B: number, S: number, cttos = 1): Pata => ({
  tipo, lado, cttos, strike: k, prima: pr(k, B, S),
});
const fut = (lado: Lado, B: number, cttos = 1): Pata => ({ tipo: "futuro", lado, cttos, strike: B, prima: 0 });

/**
 * Categorías del selector segmentado (relevamiento web R5, punto 45 — "acá
 * necesito de vos": mapeo propio de los 31 presets sobre el campo `view` que ya
 * tenían, agrupado como pidió Lautoro). Tabla completa abajo, junto a cada preset.
 */
export type Categoria = "Alcistas" | "Bajistas" | "Techo asegurado" | "Piso asegurado" | "Rango" | "Volatilidad";
export const CATEGORIAS: Categoria[] = ["Alcistas", "Bajistas", "Techo asegurado", "Piso asegurado", "Rango", "Volatilidad"];

export type Preset = {
  id: string;
  nombre: string;
  grupo: string;
  view: string;
  categoria: Categoria;
  explicacion: string;
  patas: (B: number, S: number) => Pata[];
};

export const PRESETS: Preset[] = [
  // Básicas
  { id: "compra-fut", nombre: "Compra de futuro", grupo: "Básicas", view: "Alcista", categoria: "Alcistas",
    explicacion: "Comprás el futuro. Ganás si sube, perdés si baja, uno a uno. Riesgo y ganancia ilimitados.",
    patas: (B) => [fut("compra", B)] },
  { id: "venta-fut", nombre: "Venta de futuro", grupo: "Básicas", view: "Bajista", categoria: "Bajistas",
    explicacion: "Vendés el futuro. Ganás si baja, perdés si sube. Es el hedge clásico de una posición larga física.",
    patas: (B) => [fut("venta", B)] },
  { id: "compra-call", nombre: "Compra de call", grupo: "Básicas", view: "Alcista", categoria: "Alcistas",
    explicacion: "Pagás una prima por el derecho a comprar. Ganancia ilimitada si sube; pérdida limitada a la prima.",
    patas: (B, S) => [opt("call", "compra", B, B, S)] },
  { id: "venta-call", nombre: "Lanzamiento de call", grupo: "Básicas", view: "Bajista / ingreso", categoria: "Bajistas",
    explicacion: "Cobrás la prima y te comprometés a vender si sube. Ingreso hoy; pérdida ilimitada si sube fuerte.",
    patas: (B, S) => [opt("call", "venta", B, B, S)] },
  { id: "compra-put", nombre: "Compra de put", grupo: "Básicas", view: "Bajista", categoria: "Bajistas",
    explicacion: "Pagás una prima por el derecho a vender. Es un seguro de precio: piso con pérdida limitada a la prima.",
    patas: (B, S) => [opt("put", "compra", B, B, S)] },
  { id: "venta-put", nombre: "Lanzamiento de put", grupo: "Básicas", view: "Alcista / ingreso", categoria: "Alcistas",
    explicacion: "Cobrás la prima y te comprometés a comprar si baja. Ingreso hoy; te podés quedar comprado si cae.",
    patas: (B, S) => [opt("put", "venta", B, B, S)] },

  // Cobertura física
  { id: "covered-call", nombre: "Call cubierto", grupo: "Cobertura", view: "Neutral / ingreso", categoria: "Techo asegurado",
    explicacion: "Tenés el físico/futuro y vendés un call arriba. Cobrás prima y ponés un techo a tu venta.",
    patas: (B, S) => [fut("compra", B), opt("call", "venta", B + S, B, S)] },
  { id: "protective-put", nombre: "Put protector", grupo: "Cobertura", view: "Alcista con piso", categoria: "Piso asegurado",
    explicacion: "Tenés el físico/futuro y comprás un put abajo. Asegurás un piso de precio pagando la prima.",
    patas: (B, S) => [fut("compra", B), opt("put", "compra", B - S, B, S)] },
  { id: "collar", nombre: "Collar (piso y techo)", grupo: "Cobertura", view: "Rango", categoria: "Rango",
    explicacion: "Físico + put comprado (piso) + call vendido (techo). La prima del call paga el put: protección barata con techo.",
    patas: (B, S) => [fut("compra", B), opt("put", "compra", B - S, B, S), opt("call", "venta", B + S, B, S)] },
  { id: "fence", nombre: "Fence (put spread)", grupo: "Cobertura", view: "Protección barata", categoria: "Piso asegurado",
    explicacion: "Comprás un put y vendés otro más abajo. Protección hasta cierto nivel a menor costo que el put solo.",
    patas: (B, S) => [fut("compra", B), opt("put", "compra", B - S, B, S), opt("put", "venta", B - 2 * S, B, S)] },

  // Túneles / sintéticos
  { id: "tunel-alcista", nombre: "Túnel alcista (risk reversal)", grupo: "Túnel / sintético", view: "Alcista", categoria: "Alcistas",
    explicacion: "Vendés un put abajo y con esa prima comprás un call arriba. Direccional alcista de bajo costo.",
    patas: (B, S) => [opt("put", "venta", B - S, B, S), opt("call", "compra", B + S, B, S)] },
  { id: "tunel-bajista", nombre: "Túnel bajista", grupo: "Túnel / sintético", view: "Bajista", categoria: "Bajistas",
    explicacion: "Comprás un put abajo financiado con la venta de un call arriba. Direccional bajista de bajo costo.",
    patas: (B, S) => [opt("put", "compra", B - S, B, S), opt("call", "venta", B + S, B, S)] },
  { id: "sint-largo", nombre: "Futuro sintético largo", grupo: "Túnel / sintético", view: "Alcista", categoria: "Alcistas",
    explicacion: "Comprás call y vendés put al mismo strike: replica comprar el futuro. Sirve para arbitrar sintético vs futuro.",
    patas: (B, S) => [opt("call", "compra", B, B, S), opt("put", "venta", B, B, S)] },
  { id: "sint-corto", nombre: "Futuro sintético corto", grupo: "Túnel / sintético", view: "Bajista", categoria: "Bajistas",
    explicacion: "Vendés call y comprás put al mismo strike: replica vender el futuro.",
    patas: (B, S) => [opt("call", "venta", B, B, S), opt("put", "compra", B, B, S)] },

  // Verticales
  { id: "bull-call", nombre: "Bull call spread", grupo: "Verticales", view: "Alcista moderado", categoria: "Alcistas",
    explicacion: "Comprás un call y vendés otro más arriba. Alcista con costo y ganancia acotados.",
    patas: (B, S) => [opt("call", "compra", B, B, S), opt("call", "venta", B + S, B, S)] },
  { id: "bear-call", nombre: "Bear call spread", grupo: "Verticales", view: "Bajista moderado", categoria: "Bajistas",
    explicacion: "Vendés un call y comprás otro más arriba. Cobrás prima neta; ganás si no sube. Riesgo acotado.",
    patas: (B, S) => [opt("call", "venta", B, B, S), opt("call", "compra", B + S, B, S)] },
  { id: "bull-put", nombre: "Bull put spread", grupo: "Verticales", view: "Alcista moderado", categoria: "Alcistas",
    explicacion: "Vendés un put y comprás otro más abajo. Cobrás prima neta; ganás si no baja. Riesgo acotado.",
    patas: (B, S) => [opt("put", "venta", B, B, S), opt("put", "compra", B - S, B, S)] },
  { id: "bear-put", nombre: "Bear put spread", grupo: "Verticales", view: "Bajista moderado", categoria: "Bajistas",
    explicacion: "Comprás un put y vendés otro más abajo. Bajista con costo y ganancia acotados.",
    patas: (B, S) => [opt("put", "compra", B, B, S), opt("put", "venta", B - S, B, S)] },

  // Volatilidad
  { id: "straddle-c", nombre: "Straddle comprado", grupo: "Volatilidad", view: "Mucho movimiento", categoria: "Volatilidad",
    explicacion: "Comprás call y put al mismo strike. Ganás si el precio se mueve fuerte para cualquier lado; perdés si queda quieto.",
    patas: (B, S) => [opt("call", "compra", B, B, S), opt("put", "compra", B, B, S)] },
  { id: "straddle-v", nombre: "Straddle vendido", grupo: "Volatilidad", view: "Poco movimiento", categoria: "Volatilidad",
    explicacion: "Vendés call y put al mismo strike. Cobrás dos primas; ganás si el precio queda quieto. Riesgo alto si se mueve.",
    patas: (B, S) => [opt("call", "venta", B, B, S), opt("put", "venta", B, B, S)] },
  { id: "strangle-c", nombre: "Strangle comprado", grupo: "Volatilidad", view: "Mucho movimiento", categoria: "Volatilidad",
    explicacion: "Comprás call arriba y put abajo (OTM). Más barato que el straddle, necesita un movimiento mayor para ganar.",
    patas: (B, S) => [opt("call", "compra", B + S, B, S), opt("put", "compra", B - S, B, S)] },
  { id: "strangle-v", nombre: "Strangle vendido", grupo: "Volatilidad", view: "Poco movimiento", categoria: "Volatilidad",
    explicacion: "Vendés call arriba y put abajo. Cobrás dos primas; ganás si el precio se mantiene en el rango.",
    patas: (B, S) => [opt("call", "venta", B + S, B, S), opt("put", "venta", B - S, B, S)] },

  // Mariposas / cóndores
  { id: "mariposa", nombre: "Mariposa comprada (call)", grupo: "Mariposas / cóndores", view: "Clava en el centro", categoria: "Rango",
    explicacion: "+1 call abajo, −2 call en el centro, +1 call arriba. Ganancia máxima si el precio termina en el strike central. Costo bajo.",
    patas: (B, S) => [opt("call", "compra", B - S, B, S), opt("call", "venta", B, B, S, 2), opt("call", "compra", B + S, B, S)] },
  { id: "mariposa-v", nombre: "Mariposa vendida (call)", grupo: "Mariposas / cóndores", view: "Sale del rango", categoria: "Volatilidad",
    explicacion: "−1 call abajo, +2 call en el centro, −1 call arriba (inversa de la mariposa comprada). Cobrás prima; ganás si el precio se va del strike central.",
    patas: (B, S) => [opt("call", "venta", B - S, B, S), opt("call", "compra", B, B, S, 2), opt("call", "venta", B + S, B, S)] },
  { id: "condor-call", nombre: "Cóndor de calls", grupo: "Mariposas / cóndores", view: "Rango amplio", categoria: "Rango",
    explicacion: "+1 call bien abajo, −1 call abajo, −1 call arriba, +1 call bien arriba. Ganás si el precio queda en el rango central; riesgo acotado en las alas.",
    patas: (B, S) => [opt("call", "compra", B - 2 * S, B, S), opt("call", "venta", B - S, B, S), opt("call", "venta", B + S, B, S), opt("call", "compra", B + 2 * S, B, S)] },
  { id: "iron-condor", nombre: "Iron condor", grupo: "Mariposas / cóndores", view: "Rango (crédito)", categoria: "Rango",
    explicacion: "Vendés un strangle y comprás otro más lejos como seguro. Cobrás prima; ganás si el precio queda en el rango central.",
    patas: (B, S) => [opt("put", "compra", B - 2 * S, B, S), opt("put", "venta", B - S, B, S), opt("call", "venta", B + S, B, S), opt("call", "compra", B + 2 * S, B, S)] },
  { id: "iron-butterfly", nombre: "Iron butterfly", grupo: "Mariposas / cóndores", view: "Clava en el centro (crédito)", categoria: "Rango",
    explicacion: "Vendés call y put en el centro y comprás las alas. Cobrás prima; ganancia máxima si clava en el strike central.",
    patas: (B, S) => [opt("put", "compra", B - S, B, S), opt("put", "venta", B, B, S), opt("call", "venta", B, B, S), opt("call", "compra", B + S, B, S)] },

  // Ratios
  { id: "ratio-call", nombre: "Ratio call spread", grupo: "Ratios", view: "Alcista suave con techo", categoria: "Alcistas",
    explicacion: "Comprás 1 call y vendés 2 más arriba. Barato o gratis si sube poco; riesgo si sube demasiado.",
    patas: (B, S) => [opt("call", "compra", B, B, S), opt("call", "venta", B + S, B, S, 2)] },
  { id: "ratio-put", nombre: "Ratio put spread", grupo: "Ratios", view: "Bajista suave", categoria: "Bajistas",
    explicacion: "Comprás 1 put y vendés 2 más abajo. Barato si baja poco; riesgo si baja demasiado.",
    patas: (B, S) => [opt("put", "compra", B, B, S), opt("put", "venta", B - S, B, S, 2)] },
  { id: "call-backspread", nombre: "Call backspread", grupo: "Ratios", view: "Alcista fuerte", categoria: "Alcistas",
    explicacion: "Vendés 1 call y comprás 2 más arriba. Ganancia ilimitada si sube fuerte; lo peor es que clave en el strike comprado.",
    patas: (B, S) => [opt("call", "venta", B, B, S), opt("call", "compra", B + S, B, S, 2)] },
  { id: "put-backspread", nombre: "Put backspread", grupo: "Ratios", view: "Bajista fuerte", categoria: "Bajistas",
    explicacion: "Vendés 1 put y comprás 2 más abajo. Ganás fuerte si se derrumba; lo peor es que clave en el strike comprado.",
    patas: (B, S) => [opt("put", "venta", B, B, S), opt("put", "compra", B - S, B, S, 2)] },
];

export type Escenario = { P: number; resultado: number };

/** Serie de payoff en un rango alrededor de B (para el gráfico y la tabla). */
export function serieEscenarios(patas: Pata[], B: number, S: number, n = 61): Escenario[] {
  const lo = Math.max(0, B - 3 * S);
  const hi = B + 3 * S;
  if (!(hi > lo) || n < 2) return [];
  const paso = (hi - lo) / (n - 1);
  const out: Escenario[] = [];
  for (let i = 0; i < n; i++) {
    const P = lo + paso * i;
    out.push({ P, resultado: payoffTotal(P, patas) });
  }
  return out;
}

/** Breakevens (cruces por cero) por interpolación lineal sobre la serie. */
export function breakevens(serie: Escenario[]): number[] {
  const be: number[] = [];
  for (let i = 1; i < serie.length; i++) {
    const a = serie[i - 1];
    const b = serie[i];
    if (!a || !b) continue;
    const cruza = (a.resultado <= 0 && b.resultado > 0) || (a.resultado >= 0 && b.resultado < 0);
    if (cruza && a.resultado !== b.resultado) {
      const t = a.resultado / (a.resultado - b.resultado);
      be.push(a.P + t * (b.P - a.P));
    }
  }
  return be;
}
