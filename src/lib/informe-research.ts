import "server-only";
import type { CierresData } from "./futuros";
import { volumenTotalGrano } from "./futuros";
import type { MonitorData, MonitorRow } from "./monitor-mercados";
import type { ArbData } from "./arbitrajes-cierres";
import type { DolarFuturoData } from "./market/dolar-futuro";
import type { PizarraData } from "./pizarra";

/**
 * Derivaciones para la plantilla "Research" del informe diario (formato
 * one-pager tipo research de ALyC — Claude Design "Informe Research P2").
 * Todo acá es aritmética pura sobre datos YA reales de los libs existentes:
 * cero número inventado, cero fetch nuevo.
 */

const GRANOS = [
  { underlying: "SOJ", nombre: "Soja" },
  { underlying: "MAI", nombre: "Maíz" },
  { underlying: "TRI", nombre: "Trigo" },
] as const;

/* ---------------- Gráfico 1: el desfasaje (A3 vs Chicago) ---------------- */

export type DesfasajeFila = {
  underlying: string;
  nombre: string;
  posLabel: string | null;
  a3Pct: number | null;
  chiPct: number | null;
};

export function buildDesfasaje(cierres: CierresData, chicago: MonitorData): DesfasajeFila[] {
  return GRANOS.map((g) => {
    const grano = cierres.granos.find((c) => c.underlying === g.underlying);
    const pos = grano?.posiciones.find((p) => p.venc > 0) ?? null;
    const chiRow = chicago.agro.find((r) => r.nombre === g.nombre) ?? null;
    return {
      underlying: g.underlying,
      nombre: g.nombre,
      posLabel: pos?.posicion ?? null,
      a3Pct: pos?.changePercent ?? null,
      chiPct: chiRow?.deltaPct ?? null,
    };
  });
}

/* ---------------- Gráfico 2: dónde rinde el tiempo (TNA implícita) ---------------- */

export type TnaBarra = { key: string; label: string; valor: number; tono: "grano" | "usd" };

export function buildTnaImplicita(arbitrajes: ArbData, dolarFuturo: DolarFuturoData): TnaBarra[] {
  const filas: TnaBarra[] = [];
  for (const g of GRANOS) {
    const grano = arbitrajes.granos.find((a) => a.underlying === g.underlying);
    // La posición de referencia es la de MAYOR interés abierto (el contrato
    // más líquido, convención de mercado) — no la de mayor TNA: un contrato
    // cercano y poco operado anualiza el mismo spread en pocos días y da una
    // TNA artificialmente alta (ej. TRI a 55 días con solo 11 lotes vs DIC26
    // a 144 días con 4.567 de interés abierto — verificado con datos reales
    // el 30/07/2026).
    const conTna = (grano?.rows ?? []).filter((r) => r.tna != null);
    const mejor = [...conTna].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))[0];
    if (mejor && mejor.tna != null) {
      filas.push({ key: g.underlying, label: `${g.nombre} ${mejor.pos}`, valor: mejor.tna, tono: "grano" });
    }
  }
  // Se salta la posición casi-spot (días ≤ 5): su TNA anualiza un spread
  // mínimo sobre casi ningún tiempo y queda cerca de 0%, sin aportar nada a
  // "dónde rinde el tiempo".
  for (const p of dolarFuturo.posiciones.filter((x) => x.dias == null || x.dias > 5).slice(0, 2)) {
    if (p.tnaPct != null) {
      filas.push({ key: `usd-${p.ticker}`, label: `USD ${p.label}`, valor: p.tnaPct, tono: "usd" });
    }
  }
  return filas;
}

/* ---------------- Las tres cifras ---------------- */

export type CifraDestacada = { label: string; pct: number; tono: "pos" | "neg" | "gold" };

export function buildTresCifras(chicago: MonitorData, dolarFuturo: DolarFuturoData): CifraDestacada[] {
  const out: CifraDestacada[] = [];

  const agro = chicago.agro.filter((r) => (["Soja", "Maíz", "Trigo"] as string[]).includes(r.nombre));
  const mayorMovida = agro
    .filter((r): r is MonitorRow & { deltaPct: number } => r.deltaPct != null)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0];
  if (mayorMovida) {
    out.push({
      label: `${mayorMovida.nombre} Chicago`,
      pct: mayorMovida.deltaPct,
      tono: mayorMovida.deltaPct >= 0 ? "pos" : "neg",
    });
  }

  const wti = chicago.macro.find((r) => r.nombre === "Petróleo WTI");
  if (wti?.deltaPct != null) {
    out.push({ label: "WTI spot", pct: wti.deltaPct, tono: wti.deltaPct >= 0 ? "pos" : "neg" });
  }

  const mejorCarry = dolarFuturo.posiciones
    .filter((p) => p.tnaPct != null)
    .sort((a, b) => (b.tnaPct as number) - (a.tnaPct as number))[0];
  if (mejorCarry && mejorCarry.tnaPct != null) {
    out.push({ label: `Carry USD ${mejorCarry.label}`, pct: mejorCarry.tnaPct, tono: "gold" });
  }

  return out.slice(0, 3);
}

/* ---------------- Franja de referencia ---------------- */

export type ReferenciaPizarra = { nombre: string; usd: number | null };

export function buildReferenciaPizarra(pizarra: PizarraData): ReferenciaPizarra[] {
  return GRANOS.map((g) => ({ nombre: g.nombre, usd: pizarra.granos[g.underlying]?.usd ?? null }));
}

export type VolumenA3 = { nombre: string; contratos: number | null; destacado: boolean };

export function buildVolumenA3(cierres: CierresData): VolumenA3[] {
  const filas = GRANOS.map((g) => {
    const grano = cierres.granos.find((c) => c.underlying === g.underlying);
    return { nombre: g.nombre, contratos: grano ? volumenTotalGrano(grano) : null };
  });
  const max = Math.max(...filas.map((f) => f.contratos ?? -Infinity));
  return filas.map((f) => ({ ...f, destacado: f.contratos != null && f.contratos === max && max > 0 }));
}

export type ComplejoSojaFila = { nombre: string; deltaPct: number | null };

export function buildComplejoSoja(chicago: MonitorData): ComplejoSojaFila[] {
  const nombres = ["Soja", "Aceite de soja", "Harina de soja"];
  return nombres.map((n) => ({
    nombre: n === "Soja" ? "Poroto" : n.replace(" de soja", ""),
    deltaPct: chicago.agro.find((r) => r.nombre === n)?.deltaPct ?? null,
  }));
}

/* ---------------- Escalas de gráfico (aritmética pura, sin dependencias) ---------------- */

/** Redondea un dominio (en % o puntos) al próximo número "prolijo" para los ticks. */
export function nicePercentDomain(maxAbs: number): number {
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) return 2;
  if (maxAbs <= 2) return 2;
  if (maxAbs <= 3) return 3;
  if (maxAbs <= 5) return 5;
  if (maxAbs <= 8) return 8;
  const step = maxAbs <= 20 ? 5 : 10;
  return Math.ceil(maxAbs / step) * step;
}
