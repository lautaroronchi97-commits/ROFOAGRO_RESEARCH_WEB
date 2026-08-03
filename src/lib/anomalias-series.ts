/**
 * anomalias-series.ts — catálogo de QUÉ serie se chequea con QUÉ perfil (D7/L7).
 *
 * `anomalias.ts` tiene el motor (mediana/MAD, magnitud, monotonía, identidades, duplicados) y los
 * PERFILES por tipo de dato. Acá vive el mapeo concreto: cada tabla de la base, cómo se parte en
 * series, con qué perfil se mide y qué valores son físicamente imposibles para ESE campo. Mismo
 * patrón que `noticias-reglas.json` (reglas separadas del motor que las aplica), pero en TS para
 * que el tipo del perfil se chequee en compilación.
 *
 * Lo consumen dos lados:
 *   · `scripts/chequeo-anomalias.mjs` — barrido diario sobre lo que entró (y calibración retroactiva);
 *   · las server actions de los uploaders de `/admin/datos` — chequeo en la previsualización.
 *
 * Los límites de `rango` NO son umbrales estadísticos: son cotas físicas/agronómicas duras, elegidas
 * con holgura sobre el máximo histórico real de cada campo (medido por SQL contra la base el
 * 28/07/2026) para que nunca marquen un dato bueno. Ver el doc de sesión de D7.
 */

// `import type` a propósito: se borra en compilación, así este módulo no tiene NINGÚN import de
// valor y Node lo puede cargar directo desde `scripts/*.mjs` sin resolver rutas `.ts` internas
// (misma restricción que documenta `camiones/williams.ts`). Por eso el perfil se referencia por
// NOMBRE y el consumidor lo busca en `PERFILES` — la config queda como dato puro.
import type { NombrePerfil } from "./anomalias";

export type ConfigSerie = {
  /** Tabla de Supabase. */
  tabla: string;
  /** Columna de fecha que ordena la serie. */
  colFecha: string;
  /** Columna numérica que se chequea. */
  colValor: string;
  /** Columnas que, combinadas, identifican UNA serie (el resto son dimensiones distintas). */
  clave: string[];
  /** Filtro PostgREST extra (ej. `&variable=eq.rinde`). */
  filtro?: string;
  perfil: NombrePerfil;
  /** Pisa el rango del perfil con la cota física de ESTE campo. */
  rango?: { min?: number; max?: number };
  /** Piso absoluto de aviso, en la unidad del campo (ver `Perfil.minDelta`). */
  minDelta: number;
  /**
   * La serie se compara contra la MISMA época de años anteriores (y contra su ventana reciente)
   * en vez de contra su historia lineal. Sólo para conteos fuertemente estacionales.
   */
  estacional?: boolean;
  unidad?: string;
  /** Texto para el humano que lee la alerta. */
  descripcion: string;
};

export const SERIES = {
  pizarra_usd: {
    tabla: "pizarra_historico",
    colFecha: "fecha",
    colValor: "precio_usd",
    clave: ["grano"],
    perfil: "precio_diario",
    // Máximo histórico real: girasol 715,60 USD/tn (2022). 2.000 deja aire para cualquier rally.
    rango: { min: 0, max: 2000 },
    // Nada por debajo de 5 USD/tn de movimiento merece un mail.
    minDelta: 5,
    unidad: "USD/tn",
    descripcion: "pizarra CAC en dólares",
  },
  futuros_settlement: {
    tabla: "futuros_cierres",
    colFecha: "fecha",
    colValor: "settlement",
    clave: ["symbol"],
    perfil: "precio_diario",
    // Sólo granos (los 3 productos MATba en USD/tn); el dólar futuro vive en otra tabla.
    filtro: "&producto=in.(%22SOJ%20Dolar%20MATba%22,%22MAI%20Dolar%20MATba%22,%22TRI%20Dolar%20MATba%22)",
    rango: { min: 0, max: 2000 },
    minDelta: 5,
    unidad: "USD/tn",
    descripcion: "cierres de futuros A3/Matba",
  },
  cbot_settlement: {
    tabla: "cbot_cierres",
    colFecha: "fecha",
    colValor: "settlement_usd_tn",
    clave: ["symbol"],
    perfil: "precio_diario",
    rango: { min: 0, max: 2000 },
    minDelta: 5,
    unidad: "USD/tn",
    descripcion: "cierres CBOT normalizados a USD/tn",
  },
  compras_acumulado: {
    tabla: "compras",
    colFecha: "fecha",
    colValor: "toneladas",
    clave: ["campana", "codigo_interno", "sector"],
    perfil: "acumulado",
    // La campaña argentina más grande de un solo grano ronda 60 Mt (maíz); 80 Mt por grano×sector
    // es imposible. Cota que agarra el spike de 49,9 Mt de trigo INDUSTRIA 2019/20 sólo si el grano
    // fuera enorme — el trabajo pesado lo hacen `salto` e `identidad` (ver doc de sesión).
    rango: { min: 0, max: 80_000_000 },
    // 50 kt sobre acumulados de millones de toneladas: por debajo de eso son redondeos del origen.
    minDelta: 50_000,
    unidad: "t",
    descripcion: "comprado acumulado por campaña/grano/sector (SIO Granos)",
  },
  camiones_conteo: {
    tabla: "camiones",
    colFecha: "fecha",
    colValor: "cantidad",
    clave: ["zona", "producto"],
    perfil: "conteo_estacional",
    estacional: true,
    // Máximo histórico real: 18.992 camiones (TOTAL, Rosario, pico de cosecha).
    rango: { min: 0, max: 40_000 },
    minDelta: 50,
    unidad: "camiones",
    descripcion: "entrada diaria de camiones a puerto (Williams Entregas)",
  },
  camiones_plantas_conteo: {
    tabla: "camiones_plantas",
    colFecha: "fecha",
    colValor: "cantidad",
    clave: ["planta_id", "producto"],
    perfil: "conteo_estacional",
    estacional: true,
    // Universo mucho más chico que `camiones` (Williams, nacional): acá es UNA planta de
    // Up River + Paraná bonaerense por vez. Máximo histórico real medido 03/08/2026: 842
    // camiones (TOTAL de la planta más grande, ~1 semana de datos desde que arrancó el
    // cron el 28/07). 3.000 da aire de sobra sin acercarse a la escala nacional.
    rango: { min: 0, max: 3000 },
    minDelta: 10,
    unidad: "camiones",
    descripcion: "entrada diaria de camiones por planta/producto (Agroentregas)",
  },
  bcra_mulc: {
    tabla: "compras_bcra",
    colFecha: "fecha",
    colValor: "monto_musd",
    clave: [],
    perfil: "flujo_diario",
    // Extremos históricos reales desde 2003: −1.471,7 / +700 M USD en un día.
    rango: { min: -3000, max: 3000 },
    minDelta: 50,
    unidad: "M USD",
    descripcion: "compras netas diarias del BCRA en el MULC",
  },
  estimacion_produccion: {
    tabla: "estimaciones_produccion",
    colFecha: "fecha_publicacion",
    colValor: "valor",
    clave: ["organismo", "pais", "grano", "campania"],
    filtro: "&variable=eq.produccion",
    perfil: "estimacion",
    // Producción mundial de maíz ≈ 1.230 Mt (el valor más grande que existe en la tabla).
    rango: { min: 0, max: 2000 },
    minDelta: 0.3,
    unidad: "Mt",
    descripcion: "producción estimada por vintage",
  },
  estimacion_area: {
    tabla: "estimaciones_produccion",
    colFecha: "fecha_publicacion",
    colValor: "valor",
    clave: ["organismo", "pais", "grano", "campania"],
    filtro: "&variable=eq.area",
    perfil: "estimacion",
    // Área mundial de trigo ≈ 220 Mha. Nada puede superar 300 Mha.
    rango: { min: 0, max: 300 },
    minDelta: 0.2,
    unidad: "Mha",
    descripcion: "área sembrada estimada por vintage",
  },
  estimacion_rinde: {
    tabla: "estimaciones_produccion",
    colFecha: "fecha_publicacion",
    colValor: "valor",
    clave: ["organismo", "pais", "grano", "campania"],
    filtro: "&variable=eq.rinde",
    perfil: "estimacion",
    // El rinde de maíz más alto del mundo (EEUU irrigado) ronda 11-12 tn/ha. Un valor mayor es
    // casi siempre qq/ha guardado como tn/ha, o una división al revés.
    rango: { min: 0, max: 15 },
    minDelta: 0.3,
    unidad: "tn/ha",
    descripcion: "rinde estimado por vintage",
  },
} as const satisfies Record<string, ConfigSerie>;

export type NombreSerie = keyof typeof SERIES;

/**
 * Tolerancias de las identidades contables (§d de `anomalias.ts`). Medidas contra la base real el
 * 28/07/2026: `compras` cumple 9.468/9.533 (99,3%) a 0,5%; `camiones` cumple 10.646/10.656 (99,9%).
 */
export const IDENTIDADES = {
  /** compras: precio hecho + fijado + saldo a fijar = comprado acumulado. */
  compras: { tolerancia: 0.02, modo: "igual" as const },
  /** camiones: la suma por producto no puede superar la serie TOTAL (sí puede quedar por debajo:
   *  la TOTAL incluye granos que todavía no se cargaron por separado). */
  camiones: { tolerancia: 0.02, modo: "partes_menor" as const },
};
