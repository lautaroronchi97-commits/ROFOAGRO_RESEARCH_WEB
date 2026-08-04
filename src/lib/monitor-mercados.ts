import "server-only";
import { cache } from "react";
import { FACTOR_BU_SOJA_TRIGO, FACTOR_BU_MAIZ, FACTOR_ST_HARINA, FACTOR_LB_ACEITE } from "./factores-commodities";
import type { Meta } from "./market";
import { calcularDeltaSerie, type DeltaSerie, type PuntoValor } from "./informe-v3-calc";

/**
 * Monitor de mercados (Chicago + macro) — SOLO VISTA, no se guarda nada.
 *
 * Igual que el feed A3 por WebSocket: dato en vivo que viaja con la
 * regeneración de la página (`/granos` tiene `revalidate = 30`), sin tabla,
 * sin cron, sin backfill. Si la fuente falla, cada instrumento degrada a "—"
 * y la página sigue entera.
 *
 * Fuente: endpoint batch `spark` de Yahoo Finance — 1 request trae los 13
 * instrumentos sin auth (requiere User-Agent de navegador, si no da 429/403).
 * Delay medido con mercado abierto (20/07/2026): futuros CBOT/NYMEX/COMEX +
 * DXY = 10 min exactos (piso de licencia CME/ICE para feeds gratis, ninguna
 * fuente gratis lo baja); SPY y USD/BRL en tiempo real. El sello lo dice.
 * MERVAL (^MERV) y EWZ agregados el 23/07/2026: el endpoint responde bien para
 * los dos (probado fuera de horario de rueda porteña), pero su delay exacto en
 * rueda abierta de Buenos Aires queda sin medir todavía (a diferencia de los
 * de arriba, verificados con mercado abierto real) — igual degrada solo si el
 * dato viene viejo o falta.
 *
 * Regla del repo "institución sí, puente no": el sello nombra el mercado de
 * origen (CBOT·NYMEX·COMEX·ICE), nunca el proveedor técnico.
 *
 * Conversión a USD/tn de los agro (factores idénticos a `ingest-cbot.mjs` +
 * los estándar short-ton/lb→tn), aplicados sobre el precio en unidad de origen:
 *   soja/trigo  ¢/bu × 0.3674371     maíz  ¢/bu × 0.3936826
 *   harina      USD/st × 1.1023113   aceite ¢/lb × 22.046226
 *
 * MANÍ: no cotiza en Chicago — el ÚNICO futuro de maní del mundo es el de la
 * Bolsa de Zhengzhou (ZCE, China), en CNY/tn. Viene de otra fuente (Sina
 * Finance, contrato continuo principal `nf_PK0`) y se pasa a USD/tn con el
 * USD/CNY (que se pide en el mismo batch de Yahoo). Solo se leen campos
 * numéricos por índice (ASCII) → no hace falta decodificar el GBK del feed.
 */

const REVALIDATE = 30;
const SPARK = "https://query1.finance.yahoo.com/v7/finance/spark";
const SINA_PEANUT = "https://hq.sinajs.cn/list=nf_PK0"; // ZCE maní continuo (主力)
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (ROFOAGRO research)";
// Símbolo FX auxiliar (no se muestra): USD/CNY para pasar el maní a USD/tn.
const FX_HELPER = "CNY=X";

export type MonitorGrupo = "agro" | "macro";
export type MonitorGlyph = "soja" | "maiz" | "trigo" | "mani" | null;

type Instr = {
  yahoo: string;
  grupo: MonitorGrupo;
  nombre: string;
  glyph: MonitorGlyph;
  emoji: string; // relevamiento 29/07, punto 29 — uno por posición, sin repetir
  factorTn: number | null; // agro → USD/tn; null en macro
  unidad: string; // etiqueta de la unidad de origen
  unidadDec: number; // decimales del valor en unidad de origen
  mercado: string; // CBOT / NYMEX / COMEX / ICE / FX
  esFuturo: boolean; // muestra posición del contrato
};

/** Orden fijo: agro primero (destacado), macro después (informativo). */
const INSTRUMENTOS: Instr[] = [
  { yahoo: "ZS=F", grupo: "agro", nombre: "Soja", glyph: "soja", emoji: "🫘", factorTn: FACTOR_BU_SOJA_TRIGO, unidad: "¢/bu", unidadDec: 2, mercado: "CBOT", esFuturo: true },
  { yahoo: "ZL=F", grupo: "agro", nombre: "Aceite de soja", glyph: "soja", emoji: "🫗", factorTn: FACTOR_LB_ACEITE, unidad: "¢/lb", unidadDec: 2, mercado: "CBOT", esFuturo: true },
  { yahoo: "ZM=F", grupo: "agro", nombre: "Harina de soja", glyph: "soja", emoji: "🥣", factorTn: FACTOR_ST_HARINA, unidad: "USD/st", unidadDec: 1, mercado: "CBOT", esFuturo: true },
  { yahoo: "ZC=F", grupo: "agro", nombre: "Maíz", glyph: "maiz", emoji: "🌽", factorTn: FACTOR_BU_MAIZ, unidad: "¢/bu", unidadDec: 2, mercado: "CBOT", esFuturo: true },
  { yahoo: "ZW=F", grupo: "agro", nombre: "Trigo", glyph: "trigo", emoji: "🌾", factorTn: FACTOR_BU_SOJA_TRIGO, unidad: "¢/bu", unidadDec: 2, mercado: "CBOT", esFuturo: true },
  { yahoo: "CL=F", grupo: "macro", nombre: "Petróleo WTI", glyph: null, emoji: "🛢️", factorTn: null, unidad: "USD/bbl", unidadDec: 2, mercado: "NYMEX", esFuturo: true },
  { yahoo: "GC=F", grupo: "macro", nombre: "Oro", glyph: null, emoji: "🥇", factorTn: null, unidad: "USD/oz", unidadDec: 1, mercado: "COMEX", esFuturo: true },
  { yahoo: "SI=F", grupo: "macro", nombre: "Plata", glyph: null, emoji: "🥈", factorTn: null, unidad: "USD/oz", unidadDec: 3, mercado: "COMEX", esFuturo: true },
  { yahoo: "DX-Y.NYB", grupo: "macro", nombre: "Dólar (DXY)", glyph: null, emoji: "💵", factorTn: null, unidad: "índice", unidadDec: 2, mercado: "ICE", esFuturo: false },
  { yahoo: "BRL=X", grupo: "macro", nombre: "Real (USD/BRL)", glyph: null, emoji: "🇧🇷", factorTn: null, unidad: "R$", unidadDec: 4, mercado: "FX", esFuturo: false },
  { yahoo: "SPY", grupo: "macro", nombre: "S&P 500 (SPY)", glyph: null, emoji: "📈", factorTn: null, unidad: "USD", unidadDec: 2, mercado: "NYSE", esFuturo: false },
  { yahoo: "^MERV", grupo: "macro", nombre: "Merval", glyph: null, emoji: "📊", factorTn: null, unidad: "índice", unidadDec: 0, mercado: "BYMA", esFuturo: false },
  { yahoo: "EWZ", grupo: "macro", nombre: "Brasil (EWZ)", glyph: null, emoji: "🏦", factorTn: null, unidad: "USD", unidadDec: 2, mercado: "NYSE", esFuturo: false },
];

// Chequeo en build-time (módulo): los emoji de INSTRUMENTOS + el de Maní (agregado
// aparte más abajo) deben ser todos distintos — "no se pueden repetir" (punto 29).
if (new Set([...INSTRUMENTOS.map((i) => i.emoji), "🥜"]).size !== INSTRUMENTOS.length + 1) {
  throw new Error("monitor-mercados: hay emoji repetidos en INSTRUMENTOS/Maní");
}

export type MonitorRow = {
  yahoo: string;
  grupo: MonitorGrupo;
  nombre: string;
  glyph: MonitorGlyph;
  emoji: string;
  pos: string | null; // posición del contrato, p.ej. "NOV26"
  ultimo: number | null; // en unidad de origen
  usdTn: number | null; // solo agro
  deltaPct: number | null; // variación del día vs cierre anterior
  unidad: string;
  unidadDec: number;
  mercado: string;
};

export type MonitorData = { agro: MonitorRow[]; macro: MonitorRow[]; meta: Meta };

/* ---------------- parser de posición (mes siempre intacto; año a veces truncado) ---------------- */

const EN2ES: Record<string, string> = {
  Jan: "ENE", Feb: "FEB", Mar: "MAR", Apr: "ABR", May: "MAY", Jun: "JUN",
  Jul: "JUL", Aug: "AGO", Sep: "SEP", Oct: "OCT", Nov: "NOV", Dec: "DIC",
};
const EN_IDX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * El `shortName` del spark viene en dos formatos ("Soybean Futures,Nov-2026" y
 * "Crude Oil Sep 26") y TRUNCA el año en los nombres largos ("Chicago SRW Wheat
 * Futures,Sep-2"). El mes (3 letras) siempre queda entero → se parsea el mes y,
 * si el año no vino con ≥2 dígitos, se infiere el front-month (el próximo año en
 * que ese mes todavía no pasó).
 */
function parsePos(shortName: string | null): string | null {
  if (!shortName) return null;
  const m = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[- ]?(\d{2,4})?/.exec(shortName);
  if (!m) return null;
  const mon = m[1]!; // grupo obligatorio del regex
  const raw = m[2];
  let yy: number;
  if (raw && raw.length >= 2) {
    yy = raw.length === 4 ? Number(raw) % 100 : Number(raw);
  } else {
    const now = new Date();
    // mon es uno de los 12 literales del regex de arriba → siempre está en EN_IDX/EN2ES.
    yy = (EN_IDX[mon]! < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear()) % 100;
  }
  return `${EN2ES[mon]!}${String(yy).padStart(2, "0")}`;
}

/* ---------------- fetch batch (Result, degrada solo) ---------------- */

const asNum = (x: unknown): number | null =>
  typeof x === "number" && Number.isFinite(x) ? x : null;
const asStr = (x: unknown): string | null =>
  typeof x === "string" && x.length > 0 ? x : null;
const asObj = (x: unknown): Record<string, unknown> | null =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

type SparkMeta = {
  price: number | null;
  prevClose: number | null;
  shortName: string | null;
  marketTime: number | null; // epoch segundos
};

const fetchSpark = cache(async (): Promise<Map<string, SparkMeta> | null> => {
  // + FX_HELPER (USD/CNY): no se muestra, se usa para pasar el maní a USD/tn.
  const symbols = [...INSTRUMENTOS.map((i) => i.yahoo), FX_HELPER].join(",");
  const url = `${SPARK}?symbols=${encodeURIComponent(symbols)}&range=1d&interval=15m`;
  let data: unknown;
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json", "user-agent": UA },
    });
    if (!res.ok) {
      console.error(`[monitor] HTTP ${res.status}`);
      return null;
    }
    data = await res.json();
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    console.error(`[monitor] ${timeout ? "timeout" : "error de red"}`);
    return null;
  }

  const root = asObj(data);
  const spark = root ? asObj(root.spark) : null;
  const result = spark && Array.isArray(spark.result) ? spark.result : null;
  if (!result) return null;

  const out = new Map<string, SparkMeta>();
  for (const item of result) {
    const it = asObj(item);
    const sym = it ? asStr(it.symbol) : null;
    const resp = it && Array.isArray(it.response) ? it.response : null;
    const meta = resp ? asObj(asObj(resp[0])?.meta ?? null) : null;
    if (!sym || !meta) continue;
    out.set(sym, {
      price: asNum(meta.regularMarketPrice),
      prevClose: asNum(meta.previousClose) ?? asNum(meta.chartPreviousClose),
      shortName: asStr(meta.shortName),
      marketTime: asNum(meta.regularMarketTime),
    });
  }
  return out.size ? out : null;
});

/* ---------------- serie histórica (para el Δ semanal, informe semanal/view v3) ---------------- */

/** `resp[0]` de un símbolo con `range` > 1d trae, además de `meta`, `timestamp` (epoch seg) +
 *  `indicators.quote[0].close` paralelos — la sparkline que da nombre al endpoint. */
function serieDeRespuesta(resp: unknown): { timestamp: number[]; close: (number | null)[] } | null {
  const r0 = asObj(Array.isArray(resp) ? resp[0] : null);
  if (!r0) return null;
  const timestamp = Array.isArray(r0.timestamp) ? (r0.timestamp as unknown[]).map((t) => asNum(t) ?? NaN) : null;
  const indicators = asObj(r0.indicators);
  const quoteArr = indicators && Array.isArray(indicators.quote) ? indicators.quote : null;
  const q0 = quoteArr ? asObj(quoteArr[0]) : null;
  const close = q0 && Array.isArray(q0.close) ? (q0.close as unknown[]).map((c) => asNum(c)) : null;
  if (!timestamp || !close || timestamp.length !== close.length) return null;
  return { timestamp, close };
}

/** Serie diaria (~2 meses) de cada instrumento, en unidad de origen (sin convertir a USD/tn —
 *  eso lo hace el caller si lo necesita) — insumo del Δ semanal/mensual, separado del snapshot
 *  `fetchSpark` (que solo trae el precio del momento) para no pesar la carga normal de `/granos`. */
const fetchSparkHistorico = cache(async (): Promise<Map<string, PuntoValor[]> | null> => {
  const symbols = INSTRUMENTOS.map((i) => i.yahoo).join(",");
  const url = `${SPARK}?symbols=${encodeURIComponent(symbols)}&range=2mo&interval=1d`;
  let data: unknown;
  try {
    const res = await fetch(url, {
      next: { revalidate: 6 * 3600 }, // serie histórica: no hace falta refrescar cada 30s
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json", "user-agent": UA },
    });
    if (!res.ok) {
      console.error(`[monitor] histórico HTTP ${res.status}`);
      return null;
    }
    data = await res.json();
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    console.error(`[monitor] histórico ${timeout ? "timeout" : "error de red"}`);
    return null;
  }

  const root = asObj(data);
  const spark = root ? asObj(root.spark) : null;
  const result = spark && Array.isArray(spark.result) ? spark.result : null;
  if (!result) return null;

  const out = new Map<string, PuntoValor[]>();
  for (const item of result) {
    const it = asObj(item);
    const sym = it ? asStr(it.symbol) : null;
    const serie = it ? serieDeRespuesta(it.response) : null;
    if (!sym || !serie) continue;
    const puntos: PuntoValor[] = [];
    for (let i = 0; i < serie.timestamp.length; i++) {
      const c = serie.close[i];
      const t = serie.timestamp[i];
      if (c == null || t == null || Number.isNaN(t)) continue;
      puntos.push({ fecha: new Date(t * 1000).toISOString().slice(0, 10), valor: c });
    }
    out.set(sym, puntos);
  }
  return out.size ? out : null;
});

export type DeltaMacro = {
  yahoo: string;
  nombre: string;
  grupo: MonitorGrupo;
  glyph: MonitorGlyph;
  unidad: string;
  unidadDec: number;
  delta: DeltaSerie;
};

/**
 * Δ semanal (~7 días) de cada instrumento de `INSTRUMENTOS` (agro Chicago + macro), en unidad de
 * origen — insumo de "otros commodities si influyeron" del informe semanal (§6.1) y del view
 * (§7.2). El caller filtra a los que le interesan citar (el Word pide WTI/oro/DXY/BRL como
 * ejemplo, "solo si influyeron"; el resto queda disponible por si hace falta).
 */
export const getVariacionSemanalMacro = cache(async (hastaISO: string): Promise<DeltaMacro[]> => {
  const historico = await fetchSparkHistorico();
  if (!historico) return [];
  return INSTRUMENTOS.map((def) => ({
    yahoo: def.yahoo,
    nombre: def.nombre,
    grupo: def.grupo,
    glyph: def.glyph,
    unidad: def.unidad,
    unidadDec: def.unidadDec,
    delta: calcularDeltaSerie(historico.get(def.yahoo) ?? [], hastaISO, 7),
  }));
});

/* ---------------- maní ZCE (Sina, contrato continuo principal) ---------------- */

type Peanut = { last: number; prevSettle: number };

/**
 * Sina devuelve una línea `var hq_str_nf_PK0="花生连续,150000,OPEN,HIGH,LOW,
 * PREVCLOSE,BID,ASK,LAST,SETTLE,PREVSETTLE,...";` en GBK. Solo leemos campos
 * numéricos por índice (ASCII), así que alcanza con partir por coma: [8]=último,
 * [9]=cierre anterior (昨结算, corroborado por el campo [27] duplicado). El maní
 * no tiene "previous close" tipo acción → como el resto de los futuros, la
 * variación se mide contra el settlement anterior.
 */
const fetchPeanut = cache(async (): Promise<Peanut | null> => {
  let text: string;
  try {
    const res = await fetch(SINA_PEANUT, {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": UA, referer: "https://finance.sina.com.cn" },
    });
    if (!res.ok) {
      console.error(`[monitor] maní HTTP ${res.status}`);
      return null;
    }
    text = await res.text();
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    console.error(`[monitor] maní ${timeout ? "timeout" : "error de red"}`);
    return null;
  }

  const body = text.split('"')[1];
  if (!body) return null;
  const f = body.split(",");
  const last = Number(f[8]);
  const prevSettle = Number(f[9]);
  if (!Number.isFinite(last) || last <= 0 || !Number.isFinite(prevSettle) || prevSettle <= 0) {
    return null;
  }
  return { last, prevSettle };
});

export const getMonitorMercados = cache(async (): Promise<MonitorData> => {
  const [raw, peanut] = await Promise.all([fetchSpark(), fetchPeanut()]);

  let maxTime = 0; // hora del dato más fresco (para el sello)
  let respondidos = 0;

  const build = (def: Instr): MonitorRow => {
    const m = raw?.get(def.yahoo) ?? null;
    const ultimo = m?.price ?? null;
    if (ultimo !== null) {
      respondidos++;
      if (m?.marketTime && m.marketTime > maxTime) maxTime = m.marketTime;
    }
    const prev = m?.prevClose ?? null;
    const deltaPct = ultimo !== null && prev !== null && prev !== 0 ? (ultimo / prev - 1) * 100 : null;
    const usdTn = ultimo !== null && def.factorTn !== null ? ultimo * def.factorTn : null;
    return {
      yahoo: def.yahoo,
      grupo: def.grupo,
      nombre: def.nombre,
      glyph: def.glyph,
      emoji: def.emoji,
      pos: def.esFuturo ? parsePos(m?.shortName ?? null) : null,
      ultimo,
      usdTn,
      deltaPct,
      unidad: def.unidad,
      unidadDec: def.unidadDec,
      mercado: def.mercado,
    };
  };

  const agro = INSTRUMENTOS.filter((i) => i.grupo === "agro").map(build);
  const macro = INSTRUMENTOS.filter((i) => i.grupo === "macro").map(build);

  // Maní ZCE (China): va con los otros commodities (bloque de referencias), no
  // con los granos de Chicago (otro mercado, otra fuente). Se muestra ya pasado
  // a USD/tn con el USD/CNY del batch. Encabeza el bloque (es lo más agro).
  const cnyPerUsd = raw?.get(FX_HELPER)?.price ?? null; // yuanes por 1 USD
  const maniUsdTn = peanut && cnyPerUsd && cnyPerUsd > 0 ? peanut.last / cnyPerUsd : null;
  macro.unshift({
    yahoo: "PK.ZCE",
    grupo: "macro",
    nombre: "Maní",
    glyph: null,
    emoji: "🥜",
    pos: "China", // aclaración: benchmark de Zhengzhou, no el maní argentino
    ultimo: maniUsdTn, // ya en USD/tn (el bloque de referencias muestra "ultimo")
    usdTn: maniUsdTn,
    deltaPct:
      peanut && peanut.prevSettle > 0 ? (peanut.last / peanut.prevSettle - 1) * 100 : null,
    unidad: "USD/tn",
    unidadDec: 0,
    mercado: "ZCE",
  });

  const problemas: string[] = [];
  if (raw === null) problemas.push("mercados de referencia no respondieron");
  else if (respondidos < INSTRUMENTOS.length) problemas.push("algún mercado sin dato");
  if (peanut === null) problemas.push("maní (ZCE) sin dato");

  return {
    agro,
    macro,
    meta: {
      source: "CBOT · NYMEX · COMEX · ICE · ZCE",
      updatedAt: maxTime > 0 ? maxTime * 1000 : null,
      status: raw !== null && respondidos > 0 ? "real" : "parcial",
      problemas,
    },
  };
});
