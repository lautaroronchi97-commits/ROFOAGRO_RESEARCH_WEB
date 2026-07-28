import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { getFuturosLive, mergeLiveMeta } from "@/lib/a3-live";
import { ruedaAgroCorrioHoy } from "@/lib/rueda";
import { hoyCordobaISO } from "@/lib/dates";
import { CONTRATO_GRANO_TN } from "@/lib/futuros";
import { Panel, PanelHead } from "./panel";
import { IconArb } from "./icons";
import { SourceStamp } from "./source-stamp";
import { QueEsEsto } from "./que-es-esto";
import { ArbitrajesEditable, type ArbGranoClient } from "./arbitrajes-editable";

/**
 * Referencia de la 1ª columna (pedido de Lautaro, 07/2026):
 *   - Fuera de rueda → el último AJUSTE (settlement de cierre).
 *   - Al abrir la rueda se "borra" el ajuste y pasa al último OPERADO en vivo
 *     (A3), hasta que salga el próximo ajuste. Antes de la 1ª operación del día
 *     queda en blanco (—).
 * Todo (spread / tasa directa / TNA) se recalcula sobre esa referencia, así el
 * arbitraje refleja el mercado del momento durante la rueda.
 * Sin A3 en vivo (Preview/sandbox o feed caído) cae al ajuste — no se queda en blanco.
 */
export async function ArbitrajesTable() {
  const [data, live] = await Promise.all([getArbitrajes(), getFuturosLive()]);
  const meta = mergeLiveMeta(data.meta, live);

  const ruedaCorrio = ruedaAgroCorrioHoy();
  const hoy = hoyCordobaISO();
  const liveOk = live.respondidos > 0; // A3 configurado y respondiendo

  const granos: ArbGranoClient[] = data.granos.map((g) => {
    // El ajuste del día ya salió cuando el cierre guardado es de hoy.
    const ajusteEsDeHoy = g.fecha === hoy;
    const modoOperado = ruedaCorrio && !ajusteEsDeHoy && liveOk;
    const rows = g.rows.map((r) => {
      const p = live.puntas.get(r.symbol);
      const last = p?.last ?? null;
      const volLive = p?.vol ?? null; // volumen operado HOY (A3 TV, resetea por rueda)
      const operoHoy = volLive != null && volLive > 0;
      // En rueda: el último operado (A3 LA) tal cual, como la pantalla de mercado
      // (eTrader) — SIN filtrar por volumen del día: una posición poco líquida que
      // no operó hoy igual muestra su último precio operado. Solo queda "—" si A3
      // no tiene último operado. Fuera de rueda: el ajuste.
      const ref = modoOperado ? last : r.ajuste;
      return {
        pos: r.pos,
        ref,
        refMode: modoOperado ? ("operado" as const) : ("ajuste" as const),
        // Punto verde en vivo SOLO en las que operaron hoy (distingue lo que se
        // mueve ahora del último operado arrastrado de la rueda anterior).
        vivo: modoOperado && operoHoy && last != null,
        // Variación nominal del AJUSTE vs el cierre previo (US$) — siempre relativa
        // al ajuste, no al último operado en vivo (ese ya tiene su propio spread).
        variacion: r.variacion,
        dias: r.dias,
        volume: modoOperado ? volLive : r.volume,
        bid: p?.bid ?? null,
        ask: p?.ask ?? null,
      };
    });
    // Volumen y OI totales del grano (todas las posiciones vivas sumadas, en
    // toneladas): el volumen ya viene resuelto por fila (en vivo si operó hoy,
    // cierre si no — mismo criterio que la columna "Vol"); el interés abierto
    // es siempre de cierre (A3 no lo publica en vivo). Suma solo si hay al
    // menos un valor real — null distingue "sin dato" de "0 operado".
    const sumTn = (vals: (number | null)[]) => {
      const conocidos = vals.filter((v): v is number => v != null);
      return conocidos.length > 0 ? conocidos.reduce((a, b) => a + b, 0) * CONTRATO_GRANO_TN : null;
    };
    const volTotalTn = sumTn(rows.map((r) => r.volume));
    const oiTotalTn = sumTn(g.rows.map((r) => r.openInterest));
    return {
      underlying: g.underlying,
      nombre: g.nombre,
      pizarraDefault: g.pizarraUsd,
      pizarraArs: g.pizarraArs,
      pizarraEstimativa: g.pizarraEstimativa,
      volTotalTn,
      volTotalEsVivo: modoOperado,
      oiTotalTn,
      rows,
    };
  });

  return (
    <Panel id="arbitrajes">
      <PanelHead
        glyph={<IconArb />}
        title="Arbitrajes"
        sub="Pizarra (disponible) vs A3 (futuro)"
        stamp={<SourceStamp meta={meta} />}
      />
      <ArbitrajesEditable granos={granos} />
      <QueEsEsto
        paraQue="Te muestra cuánto te reconoce el mercado por esperar a entregar tu grano más adelante en vez de venderlo hoy. Si esa espera rinde una tasa alta en dólares, conviene vender a futuro y cobrar después; si rinde poco, conviene hacer caja hoy."
        comoSeCalcula="Toma el precio de venta de hoy y el precio del futuro en cada posición. Fuera de rueda ese precio del futuro es el último ajuste; durante la rueda se borra el ajuste y pasa a ser el último operado en vivo, hasta que salga el próximo ajuste. La diferencia contra el precio de hoy es el spread; puesta como porcentaje es la tasa directa, y anualizada por los días que faltan, la tasa anual en dólares. Podés cargar tu propio precio de hoy y todo se recalcula. Comprador y Vendedor son las puntas del futuro en la rueda, cuando está abierta."
      />
    </Panel>
  );
}
