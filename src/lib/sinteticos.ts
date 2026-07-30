/**
 * Sintéticos LECAP + dólar futuro (módulo 6 / backlog C13, PROMPT P9 de PLAN_BACKLOG.md;
 * ajustado por el relevamiento web R6, punto 34 — pregunta 3 de PLAN_RELEVAMIENTO_WEB.md §5,
 * contestada por Lautaro el 30/07/2026 con las fórmulas exactas de su Excel).
 * PURO y sin `server-only` (a propósito, para poder testearlo — mismo criterio que
 * `derivadas.ts`/`fijar.ts`): la ingesta vive en `src/lib/market/sinteticos.ts`, que arma
 * los inputs desde las fuentes reales y llama a estas funciones.
 *
 * Fórmula (validada 1:1 contra el Excel "REAL_TIME v2.5", hoja "DOLAR SINTETICO"):
 *   sintéticoAFinish = dólarSpot × (pagoFinalLetra / precioHoyLetra)      = $D$3×(H14/G14)
 *   tasaDirecta      = sintéticoAFinish / dólarFuturo − 1                = (I7−E7)/E7
 *   TNA              = tasaDirecta × 365 / díasHastaVtoDelFUTURO         = L10×365/(F10−$D$3)
 * La TNA se anualiza por los días al vencimiento del FUTURO (no de la letra: son fechas
 * distintas dentro del mismo mes calendario y usar la de la letra desalinea la tasa — ese era
 * el reclamo real de Lautaro). "Hoy" (D3) es la fecha OPERATIVA: sábado/domingo anclan al
 * viernes anterior (`hoyOperativoMs`), para que el paso del fin de semana no mueva la TNA solo
 * por contar días de mercado cerrado.
 *
 * El "sintético" arma un dólar a término comprando la letra (que paga `pagoFinal` a su
 * vencimiento) y comparándolo contra vender el dólar futuro de esa misma posición: si la TNA
 * del sintético supera la del futuro directo, conviene el sintético. Por pedido de Lautaro
 * (R6 punto 34) el panel muestra SOLO esta tasa — sin comparación contra la TNA del futuro ni
 * "ventaja" (eso vivía en /dolar/futuro, no acá).
 */

export type SinteticoCalc = {
  sinteticoAFinish: number;
  tasaDirecta: number;
  /** TNA en USD (fracción, no %). NaN si díasHastaVtoFuturo ≤ 0 (futuro ya vencido/hoy). */
  tna: number;
};

/**
 * Núcleo de la fórmula. `dolarFuturo` es el precio de la posición de dólar futuro emparejada
 * (en el Excel es el AJUSTE; en producción usamos el último/referencia de MAE para esa
 * posición — lo que la web ya trata como el precio del dólar futuro). `diasHastaVtoFuturo` son
 * los días desde la fecha operativa hasta el vencimiento del FUTURO (no de la letra). Todo en
 * las mismas unidades de moneda; `letraPx`/`letraPagoFinal` en la misma base entre sí (VN 100).
 */
export function calcularSintetico(
  dolarSpot: number,
  letraPx: number,
  letraPagoFinal: number,
  dolarFuturo: number,
  diasHastaVtoFuturo: number,
): SinteticoCalc {
  const sinteticoAFinish = dolarSpot * (letraPagoFinal / letraPx);
  const tasaDirecta = sinteticoAFinish / dolarFuturo - 1;
  const tna = diasHastaVtoFuturo > 0 ? (tasaDirecta * 365) / diasHastaVtoFuturo : NaN;
  return { sinteticoAFinish, tasaDirecta, tna };
}

/* ---------------- emparejamiento letra ↔ posición de dólar futuro ---------------- */

export type LetraIn = {
  symbol: string;
  px: number;
  /** epoch ms del vencimiento de la letra (de su ticker). null si no se pudo inferir. */
  vencMs: number | null;
};

export type PosicionIn = {
  label: string; // p.ej. JUL26
  /** precio del dólar futuro de esa posición (último/ajuste MAE). */
  precio: number;
  vencMs: number;
};

export type SinteticoRow = {
  letra: string;
  vto: string | null; // ISO YYYY-MM-DD de la letra
  /** días desde la fecha operativa hasta el vto del FUTURO emparejado (base de la TNA). */
  dias: number | null;
  letraPx: number;
  pagoFinal: number | null;
  posicion: string | null; // label del dólar futuro emparejado
  dolarFuturo: number | null;
  sinteticoAFinish: number | null;
  tasaDirectaPct: number | null;
  /** TNA del sintético (%). */
  tnaPct: number | null;
};

function isoDeMs(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  // Mediodía Córdoba (UTC−3) ya viene implícito en el epoch de la letra; basta con la fecha UTC.
  return new Date(ms).toISOString().slice(0, 10);
}

/** aaaamm local de un epoch (para emparejar por mes calendario). */
function anioMesDeMs(ms: number): number {
  const d = new Date(ms);
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

type Candidata = SinteticoRow & { posicionKey: string; diffVtoMs: number };

/**
 * Empareja cada letra (que tiene vencimiento) con la posición de dólar futuro de su MISMO mes
 * calendario de vencimiento (criterio del Excel de Lautaro: S31L6 ↔ DLR/JUL26, S14G6 y S31G6 ↔
 * DLR/AGO26). Si la letra no tiene una posición de dólar futuro de su mismo mes, no hay un
 * sintético limpio que armar (cruzar meses mezclaría vencimientos distintos) → se excluye. No se
 * usa un "más cercano en días" a propósito: daría emparejamientos de meses distintos.
 *
 * De las letras que emparejan con la MISMA posición (ej. S14G6 y S31G6, las dos ↔ AGO26), R6
 * punto 34 pide dejar solo UNA por mes — la de vencimiento más cercano a fin de mes, que es la
 * más comparable con el DLR (que siempre vence fin de mes).
 *
 * `hoyMs` es la fecha operativa (ver `hoyOperativoMs` en `dates.ts`) usada para anualizar la TNA
 * por los días al vencimiento del FUTURO. El pago final se toma de `pagoFinalPorTicker`; si
 * falta, la fila igual se muestra pero con el sintético en null (degradación honesta).
 */
export function emparejarSinteticos(
  spot: number | null,
  letras: LetraIn[],
  posiciones: PosicionIn[],
  pagoFinalPorTicker: Record<string, number>,
  hoyMs: number,
): SinteticoRow[] {
  const candidatas: Candidata[] = [];

  for (const l of letras) {
    if (l.vencMs === null) continue;

    // posición de dólar futuro del MISMO mes calendario que la letra (criterio del Excel).
    const mesLetra = anioMesDeMs(l.vencMs);
    let mejor: PosicionIn | null = null;
    let mejorDiff = Infinity;
    for (const p of posiciones) {
      if (anioMesDeMs(p.vencMs) !== mesLetra) continue;
      const diff = Math.abs(p.vencMs - l.vencMs);
      if (diff < mejorDiff) {
        mejorDiff = diff;
        mejor = p;
      }
    }
    if (!mejor) continue; // sin dólar futuro del mismo mes → sin sintético limpio

    const pagoFinal = pagoFinalPorTicker[l.symbol] ?? null;
    const diasHastaVtoFuturo = Math.round((mejor.vencMs - hoyMs) / 86_400_000);

    let sinteticoAFinish: number | null = null;
    let tasaDirectaPct: number | null = null;
    let tnaPct: number | null = null;
    if (spot && spot > 0 && pagoFinal !== null && pagoFinal > 0 && l.px > 0 && diasHastaVtoFuturo > 0) {
      const c = calcularSintetico(spot, l.px, pagoFinal, mejor.precio, diasHastaVtoFuturo);
      sinteticoAFinish = c.sinteticoAFinish;
      tasaDirectaPct = c.tasaDirecta * 100;
      tnaPct = Number.isNaN(c.tna) ? null : c.tna * 100;
    }

    candidatas.push({
      letra: l.symbol,
      vto: isoDeMs(l.vencMs),
      dias: diasHastaVtoFuturo,
      letraPx: l.px,
      pagoFinal,
      posicion: mejor.label,
      dolarFuturo: mejor.precio,
      sinteticoAFinish,
      tasaDirectaPct,
      tnaPct,
      posicionKey: mejor.label,
      diffVtoMs: mejorDiff,
    });
  }

  // Una sola letra por posición de futuro: la de vencimiento más cercano a fin de mes.
  const porPosicion = new Map<string, Candidata>();
  for (const c of candidatas) {
    const actual = porPosicion.get(c.posicionKey);
    if (!actual || c.diffVtoMs < actual.diffVtoMs) porPosicion.set(c.posicionKey, c);
  }

  const rows: SinteticoRow[] = [...porPosicion.values()].map((c) => ({
    letra: c.letra,
    vto: c.vto,
    dias: c.dias,
    letraPx: c.letraPx,
    pagoFinal: c.pagoFinal,
    posicion: c.posicion,
    dolarFuturo: c.dolarFuturo,
    sinteticoAFinish: c.sinteticoAFinish,
    tasaDirectaPct: c.tasaDirectaPct,
    tnaPct: c.tnaPct,
  }));
  rows.sort((a, b) => {
    const ka = a.vto ?? "9999";
    const kb = b.vto ?? "9999";
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return rows;
}
