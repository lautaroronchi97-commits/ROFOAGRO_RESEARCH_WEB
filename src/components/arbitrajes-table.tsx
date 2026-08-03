import { getArbitrajes } from "@/lib/arbitrajes-cierres";
import { getFuturosLive, mergeLiveMeta } from "@/lib/a3-live";
import { ruedaAgroCorrioHoy } from "@/lib/rueda";
import { hoyCordobaISO } from "@/lib/dates";
import { CONTRATO_GRANO_TN } from "@/lib/futuros";
import { esModoOperado, referenciaDeFila } from "@/lib/referencia-futuro";
import { esPosicionLiquida } from "@/lib/liquidez-posicion";
import { getMaeOficial } from "@/lib/market/fuentes";
import { getBnaOnline } from "@/lib/bna-online";
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
 * La regla vive en `src/lib/referencia-futuro.ts` (compartida con "El mercado hoy").
 */
export async function ArbitrajesTable() {
  const [data, live, oficial] = await Promise.all([getArbitrajes(), getFuturosLive(), getMaeOficial()]);
  const meta = mergeLiveMeta(data.meta, live);
  const bnaOnline = oficial.valor != null ? getBnaOnline(oficial.valor) : null;

  const ruedaCorrio = ruedaAgroCorrioHoy();
  const hoy = hoyCordobaISO();
  const liveOk = live.respondidos > 0; // A3 configurado y respondiendo

  const granos: ArbGranoClient[] = data.granos.map((g) => {
    // El ajuste del día ya salió cuando el cierre guardado es de hoy.
    const ajusteEsDeHoy = g.fecha === hoy;
    const modoOperado = esModoOperado({ ruedaCorrio, ajusteEsDeHoy, liveOk });
    const rows = g.rows.flatMap((r) => {
      const p = live.puntas.get(r.symbol);
      const last = p?.last ?? null;
      const volLive = p?.vol ?? null; // volumen operado HOY (A3 TV, resetea por rueda)
      const operoHoy = volLive != null && volLive > 0;
      const volumeDelDia = modoOperado ? volLive : r.volume;
      // Filtro de liquidez compartido con Pases (relevamiento 29/07, punto 26) —
      // ver el criterio completo en `liquidez-posicion.ts`.
      if (!esPosicionLiquida({ openInterest: r.openInterest, operoHoy })) return [];
      // Referencia + variación + punto "en vivo": regla compartida (ver docstring).
      const rf = referenciaDeFila({
        modoOperado,
        last,
        ajuste: r.ajuste,
        variacionCierre: r.variacion,
        volLive,
      });
      return [
        {
          pos: r.pos,
          ref: rf.ref,
          refMode: rf.refMode,
          vivo: rf.vivo,
          variacion: rf.variacion,
          dias: r.dias,
          volume: volumeDelDia,
          bid: p?.bid ?? null,
          ask: p?.ask ?? null,
        },
      ];
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
        stamp={<SourceStamp meta={meta} revalidateSeg={30} />}
      />
      <ArbitrajesEditable granos={granos} oficial={oficial.valor} bnaOnline={bnaOnline} />
      <QueEsEsto
        paraQue="Te muestra cuánto te reconoce el mercado por esperar a entregar tu grano más adelante en vez de venderlo hoy. Si esa espera rinde una tasa alta en dólares, conviene vender a futuro y cobrar después; si rinde poco, conviene hacer caja hoy."
        comoSeCalcula="Toma el precio de venta de hoy y el precio del futuro en cada posición. Fuera de rueda ese precio del futuro es el último ajuste; durante la rueda se borra el ajuste y pasa a ser el último operado en vivo, hasta que salga el próximo ajuste. La diferencia contra el precio de hoy es el spread; puesta como porcentaje es la tasa directa, y anualizada por los días que faltan, la tasa anual en dólares. Podés cargar tu propio precio de hoy y todo se recalcula. Comprador y Vendedor son las puntas del futuro en la rueda, cuando está abierta."
      />
    </Panel>
  );
}
