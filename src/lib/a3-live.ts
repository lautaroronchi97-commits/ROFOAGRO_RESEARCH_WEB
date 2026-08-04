import "server-only";
import { cache } from "react";
import WebSocket from "ws";
import { a3Configured, getA3Token, invalidateA3Token, getA3InstrumentsBySegment } from "./a3";
import { getPases } from "./pases-cierres";
import { getCierresGranos } from "./futuros";
import { ruedaAgroAbierta } from "./rueda";
import type { Meta } from "./market";
import { elegirTop3PorVolumen, type FilaVolumen, type Top3Grano } from "./informe-v3-calc";

/**
 * Feed A3 en vivo: puntas (comprador/vendedor), último y volumen operado de la
 * rueda. Es la capa "viva" que el cierre diario del CEM no puede dar (el CEM no
 * publica instrumentos de pase ni puntas).
 *
 * Transporte = **WebSocket** (una conexión, un mensaje `smd` que suscribe TODOS
 * los símbolos, Primary manda el snapshot al suscribir). El REST `marketdata/get`
 * es de a un símbolo y A3 lo rate-limitea con 429 al pedir muchos seguidos —la
 * doc oficial dice "para tiempo real … Websocket"—, así que dropeaba posiciones.
 * Se abre una conexión por regeneración ISR de la página (no un cron): cuando
 * alguien mira el panel en horario de rueda, ve datos de ~1 minuto.
 *
 * Todo degrada solo: sin credenciales (Preview / sandbox), sin token o con A3
 * caído, las columnas muestran "—" y el resto del panel sigue intacto.
 */

export type Puntas = {
  bid: number | null; // mejor punta compradora (BI[0])
  bidSize: number | null;
  ask: number | null; // mejor punta vendedora / oferta (OF[0])
  askSize: number | null;
  last: number | null; // último precio operado (LA)
  vol: number | null; // volumen operado en el día (TV)
};

export type LiveEstado = "ok" | "parcial" | "caido" | "sin-config";

export type LiveResult = {
  puntas: Map<string, Puntas>; // clave = símbolo A3 (spreadSymbol o symbol del futuro)
  estado: LiveEstado;
  pedidos: number; // símbolos solicitados
  respondidos: number; // símbolos con marketData
  updatedAt: number | null; // epoch ms del armado (si hubo al menos una respuesta)
};

const WS_ENTRIES = ["BI", "OF", "LA", "TV"]; // puntas + último + volumen del día
const WS_DEADLINE_MS = 6000; // tope: la regeneración ISR no puede colgar esperando el socket
const WS_URL = (process.env.A3_API_BASE ?? "https://api.cocos.xoms.com.ar").replace(/^http/, "ws") + "/";

const SIN_CONFIG: LiveResult = {
  puntas: new Map(),
  estado: "sin-config",
  pedidos: 0,
  respondidos: 0,
  updatedAt: null,
};

/* ---------------- parsing tolerante (la API de A3 no está tipada de forma confiable) ---------------- */

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** BI/OF: array de niveles | objeto {price,size} | número suelto | ausente → primer nivel. */
function nivel(x: unknown): { price: number | null; size: number | null } {
  if (Array.isArray(x)) return nivel(x[0]);
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return { price: num(o.price), size: num(o.size) };
  }
  return { price: num(x), size: null };
}

/** LA: {price,...} | número → precio. */
function precio(x: unknown): number | null {
  if (x !== null && typeof x === "object") return num((x as Record<string, unknown>).price);
  return num(x);
}

/** TV (volumen): número | {size} | {price} → cantidad. */
function volumen(x: unknown): number | null {
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return num(o.size) ?? num(o.price);
  }
  return num(x);
}

function toPuntas(md: unknown): Puntas {
  const o = (md !== null && typeof md === "object" ? md : {}) as Record<string, unknown>;
  const bi = nivel(o.BI);
  const of = nivel(o.OF);
  return {
    bid: bi.price,
    bidSize: bi.size,
    ask: of.price,
    askSize: of.size,
    last: precio(o.LA),
    vol: volumen(o.TV),
  };
}

/* ---------------- snapshot por WebSocket (una conexión, suscribe todo) ---------------- */

async function fetchPuntas(symbols: string[]): Promise<LiveResult> {
  if (!a3Configured()) return SIN_CONFIG;
  if (symbols.length === 0) {
    return { puntas: new Map(), estado: "ok", pedidos: 0, respondidos: 0, updatedAt: null };
  }
  const token = await getA3Token();
  if (!token) {
    return { puntas: new Map(), estado: "caido", pedidos: symbols.length, respondidos: 0, updatedAt: null };
  }

  return new Promise<LiveResult>((resolve) => {
    const puntas = new Map<string, Puntas>();
    let settled = false;
    let ws: WebSocket | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        ws?.close();
      } catch {
        /* noop */
      }
      const respondidos = puntas.size;
      const estado: LiveEstado =
        respondidos === 0 ? "caido" : respondidos < symbols.length ? "parcial" : "ok";
      if (respondidos < symbols.length) {
        console.error(`[a3-live] WS ${symbols.length - respondidos}/${symbols.length} símbolos sin snapshot`);
      }
      // Snapshot totalmente vacío con un WS que sí abrió: el token cacheado puede
      // estar muerto (A3 lo invalida si alguien vuelve a loguearse en otro lado,
      // sin avisar por este canal). Se descarta para que la PRÓXIMA regeneración
      // pida uno nuevo, en vez de quedar pegado hasta el vencimiento del caché (~23h).
      if (respondidos === 0) invalidateA3Token();
      resolve({
        puntas,
        estado,
        pedidos: symbols.length,
        respondidos,
        updatedAt: respondidos > 0 ? Date.now() : null,
      });
    };

    // Idempotente por `settled`: si el snapshot llega antes, este timeout dispara
    // igual pero no hace nada. `unref` para no demorar el freeze de la función.
    setTimeout(finish, WS_DEADLINE_MS).unref?.();

    try {
      ws = new WebSocket(WS_URL, { headers: { "X-Auth-Token": token } });
    } catch {
      return finish();
    }

    // Si A3 rechaza la suscripción (ej. algún símbolo del batch ya no existe del
    // lado suyo) responde con {status:"ERROR", description:"..."} en vez de un "Md"
    // — se loguea entero (una vez por conexión) para no quedar a ciegas la próxima
    // vez que pase algo así, en vez de agotar el timeout en silencio.
    let unknownTypeLogged = false;

    ws.on("open", () => {
      // Un solo mensaje suscribe TODOS los instrumentos; Primary responde con el
      // snapshot actual de cada uno (evita el 429 de pedir de a un símbolo por REST).
      ws?.send(
        JSON.stringify({
          type: "smd",
          level: 1,
          entries: WS_ENTRIES,
          products: symbols.map((s) => ({ symbol: s, marketId: "ROFX" })),
          depth: 1,
        }),
      );
    });

    ws.on("message", (data: WebSocket.RawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.type !== "Md") {
        if (!unknownTypeLogged) {
          unknownTypeLogged = true;
          console.error(`[a3-live] WS respuesta inesperada: ${JSON.stringify(msg)}`);
        }
        return;
      }
      const inst = msg.instrumentId as { symbol?: unknown } | undefined;
      const sym = typeof inst?.symbol === "string" ? inst.symbol : null;
      if (sym && !puntas.has(sym)) {
        puntas.set(sym, toPuntas(msg.marketData));
        if (puntas.size >= symbols.length) finish();
      }
    });

    ws.on("error", () => finish());
    ws.on("close", () => finish());
  });
}

/* ---------------- entradas públicas ---------------- */

/** Puntas de los instrumentos de PASE que muestra el panel Pases. */
export const getPasesLive = cache(async (): Promise<LiveResult> => {
  if (!a3Configured()) return SIN_CONFIG;
  const [{ granos }, instrumentos] = await Promise.all([getPases(), getA3InstrumentsBySegment("DDA")]);
  const candidatos = granos.flatMap((g) => g.spreads.map((s) => s.spreadSymbol));
  // Sólo pedimos instrumentos de pase que A3 realmente lista; si la lista falló
  // (token OK pero sin datos), caemos a pedir todos los candidatos (los inexistentes dan "—").
  let symbols = candidatos;
  if (instrumentos.length > 0) {
    const set = new Set(instrumentos);
    symbols = candidatos.filter((s) => set.has(s));
  }
  return fetchPuntas(symbols);
});

/** Puntas de los FUTUROS outright que muestra el panel Arbitrajes. */
export const getFuturosLive = cache(async (): Promise<LiveResult> => {
  if (!a3Configured()) return SIN_CONFIG;
  const [{ granos }, instrumentos] = await Promise.all([
    getCierresGranos(),
    getA3InstrumentsBySegment("DDA"),
  ]);
  const candidatos = granos.flatMap((g) =>
    g.posiciones.filter((p) => p.venc > 0).map((p) => p.symbol),
  );
  // Mismo filtro que getPasesLive: `getCierresGranos` marca "vivo" con granularidad
  // de MES (útil para la tabla de ajustes), así que a fin de mes puede incluir un
  // símbolo cuyo vencimiento real ya pasó (ej. JUL26 vence el 24, sigue "vivo" hasta
  // el 31). A3 valida la suscripción del WS en bloque: un solo símbolo inexistente
  // rechaza el pedido ENTERO ("Product X don't exist"), dejando sin puntas a los
  // demás. Se filtra contra la lista real de instrumentos de A3 antes de suscribir.
  let symbols = candidatos;
  if (instrumentos.length > 0) {
    const set = new Set(instrumentos);
    symbols = candidatos.filter((s) => set.has(s));
  }
  return fetchPuntas(symbols);
});

/** Resultado de un ping barato al WS de A3 — para el panel `/admin/conexiones`, que solo
 *  necesita saber "¿está trayendo datos?", no la grilla completa de puntas. */
export type A3PingResult = {
  estado: LiveEstado;
  symbol: string | null;
  latenciaMs: number | null;
  updatedAt: number | null;
};

/**
 * Pide puntas de UN solo instrumento real (A3 rechaza la suscripción entera si el símbolo no
 * existe de su lado — por eso se toma el primero de `getA3InstrumentsBySegment`, no uno
 * inventado). No expone `fetchPuntas` en sí: esta es la única entrada pública para "solo
 * quiero saber si el feed responde", separada de `getPasesLive`/`getFuturosLive` (que arman
 * la grilla completa que consumen los paneles de mercado).
 */
/**
 * Top 3 posiciones más operadas del día por grano + volumen total del producto (informe diario
 * v3, N11 de PLAN_INFORMES_V3.md §5.1 bloque C). El "ajuste del día" sale del ÚLTIMO OPERADO en
 * vivo (`LA` del WS, ya verificado en producción por Arbitrajes/Pases) — a las 18:30 ART la rueda
 * de agro (10:30-17:00) ya cerró, así que el último operado ES el cierre del día. Se prefirió
 * reusar `LA`/`TV` (probados) antes que sumar una entrada `SE` (ajuste) nueva y sin verificar al
 * WS — el propio plan marca esa verificación como pendiente; esto evita depender de ella.
 *
 * El `settlement` de `futuros_cierres` (vía `getCierresGranos()`) a esta hora todavía tiene el
 * cierre de AYER (el cron de cierres corre 20:08 ART, después del informe) — por eso sirve
 * exactamente como línea de base para el Δ% del día cuando hay dato en vivo, y como fallback
 * rotulado "cierre_anterior" (con `changePercent` de esa misma fila, el Δ de AYER) si el WS no
 * respondió. Solo posiciones con vencimiento real (excluye "disponible"/DISPO).
 */
export async function top3PorVolumenDelDia(): Promise<Top3Grano[]> {
  const [{ granos }, live] = await Promise.all([getCierresGranos(), getFuturosLive()]);
  const hayVivo = live.estado === "ok" || live.estado === "parcial";

  const filas: (FilaVolumen & { underlying: string })[] = [];
  for (const g of granos) {
    for (const p of g.posiciones) {
      if (p.venc <= 0) continue; // sin "disponible": solo posiciones de contrato
      const l = hayVivo ? live.puntas.get(p.symbol) : undefined;
      const vivo = l?.last != null;
      const ajuste = vivo ? l!.last : p.settlement;
      const volumen = vivo && l?.vol != null ? l.vol : p.volume;
      const ajusteFuente: FilaVolumen["ajusteFuente"] = vivo ? "vivo" : "cierre_anterior";
      const deltaPct =
        vivo && p.settlement != null && p.settlement !== 0
          ? (ajuste! / p.settlement - 1) * 100
          : (p.changePercent ?? null);
      filas.push({ underlying: g.underlying, posicion: p.posicion, ajuste, ajusteFuente, deltaPct, volumen });
    }
  }
  return elegirTop3PorVolumen(filas);
}

export async function a3Ping(): Promise<A3PingResult> {
  if (!a3Configured()) return { estado: "sin-config", symbol: null, latenciaMs: null, updatedAt: null };
  const instrumentos = await getA3InstrumentsBySegment("DDA");
  const symbol = instrumentos[0] ?? null;
  if (!symbol) return { estado: "caido", symbol: null, latenciaMs: null, updatedAt: null };
  const t0 = Date.now();
  const r = await fetchPuntas([symbol]);
  return { estado: r.estado, symbol, latenciaMs: r.updatedAt ? Date.now() - t0 : null, updatedAt: r.updatedAt };
}

/* ---------------- merge de meta (cierres + capa en vivo) ---------------- */

/**
 * Combina la meta base (cierres/pizarra) con el estado del feed en vivo en un
 * único sello. Reglas: el status base nunca se "mejora"; fuera de rueda la
 * ausencia de datos en vivo NO es una falla (el libro está cerrado); durante la
 * rueda, un feed caído sí degrada a PARCIAL.
 */
export function mergeLiveMeta(base: Meta, live: LiveResult): Meta {
  const problemas = [...base.problemas];
  const rueda = ruedaAgroAbierta();
  let status = base.status;

  if (live.estado === "sin-config") {
    problemas.push("A3 en vivo sin configurar (puntas solo en producción)");
  } else if (live.estado === "caido") {
    if (rueda && base.status === "real") {
      status = "parcial";
      problemas.push("A3 en vivo caído: sin comprador/vendedor de la rueda");
    }
    // fuera de rueda: libro cerrado, no se degrada.
  } else if (live.estado === "parcial" && rueda) {
    problemas.push(`A3 en vivo incompleto: ${live.pedidos - live.respondidos} puntas sin responder`);
  }

  const hayVivo = live.respondidos > 0;
  return {
    source: base.source,
    updatedAt: hayVivo ? live.updatedAt : base.updatedAt,
    status,
    problemas,
  };
}
