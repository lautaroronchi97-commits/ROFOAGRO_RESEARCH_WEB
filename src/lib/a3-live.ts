import "server-only";
import { cache } from "react";
import WebSocket from "ws";
import { a3Configured, getA3Token, invalidateA3Token, getA3InstrumentsBySegment } from "./a3";
import { getPases } from "./pases-cierres";
import { getCierresGranos } from "./futuros";
import { ruedaAgroAbierta } from "./rueda";
import type { Meta } from "./market";

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
    } catch (e) {
      console.error(`[a3-live] WS no se pudo instanciar: ${e instanceof Error ? e.message : String(e)}`);
      return finish();
    }

    // DIAGNÓSTICO TEMPORAL (troubleshooting 28/07): el feed viene sin snapshots hace
    // horas con token fresco, así que el corte no es de auth — hace falta ver en qué
    // punto se cae la conexión (nunca abre / abre pero sin mensajes / mensajes con un
    // shape distinto al esperado). Loguea como mucho una vez por tipo por conexión.
    let openLogged = false;
    let unknownTypeLogged = false;
    let msgCount = 0;

    ws.on("open", () => {
      openLogged = true;
      console.error(`[a3-live] WS abierto, suscribiendo ${symbols.length} símbolos`);
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
      msgCount++;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        if (!unknownTypeLogged) {
          unknownTypeLogged = true;
          console.error(`[a3-live] WS mensaje no-JSON: ${data.toString().slice(0, 200)}`);
        }
        return;
      }
      if (msg.type !== "Md") {
        if (!unknownTypeLogged) {
          unknownTypeLogged = true;
          console.error(`[a3-live] WS mensaje con type inesperado: ${JSON.stringify(msg).slice(0, 300)}`);
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

    ws.on("error", (err: Error) => {
      console.error(`[a3-live] WS error: ${err.message}`);
      finish();
    });
    ws.on("close", (code: number, reason: Buffer) => {
      if (!openLogged) console.error(`[a3-live] WS cerró sin llegar a abrir (code=${code})`);
      else if (msgCount === 0) console.error(`[a3-live] WS cerró sin ningún mensaje (code=${code} reason=${reason.toString().slice(0, 100)})`);
      finish();
    });
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
  const { granos } = await getCierresGranos();
  const symbols = granos.flatMap((g) =>
    g.posiciones.filter((p) => p.venc > 0).map((p) => p.symbol),
  );
  return fetchPuntas(symbols);
});

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
