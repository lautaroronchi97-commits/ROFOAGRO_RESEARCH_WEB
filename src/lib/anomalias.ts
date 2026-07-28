/**
 * anomalias.ts — detector estadístico de valores implausibles en las ingestas (D7/L7 del backlog
 * maestro, `docs/auditoria/E7-sintesis.md` §4).
 *
 * QUÉ PROBLEMA RESUELVE
 * --------------------
 * Hoy el proyecto chequea dos cosas: FRESCURA (`healthcheck-frescura.mjs`, 17 checks: ¿la tabla se
 * atrasó?) y CERO FILAS (guard anti falso-verde de cada `scripts/ingest-*.mjs`: ¿el parser devolvió
 * algo?). Nadie valida que los VALORES que entran sean plausibles contra la historia de su propia
 * serie. Todos estos bugs REALES pasaron sin detección y se descubrieron a ojo, días después:
 *
 *   · la semana del 08/07/2026 de `compras` cargada ÷1000 (export de Agrochat en miles de tn);
 *   · 529 valores en 6,4e15 en `compras` (bug de `num()` con floats de punto decimal);
 *   · el spike de 49,9 Mt de trigo INDUSTRIA 2019/20 en `compras`;
 *   · el typo de BCR en la celda de pellets de girasol, que corría el índice de columnas y le
 *     asignaba a girasol un valor de soja;
 *   · la fila de trigo 2025/26 del PAS duplicada byte-a-byte de la de 2024/25.
 *
 * Cada chequeo de abajo está atado a uno de esos bugs — no hay chequeos "por si acaso".
 *
 * DECISIONES DE DISEÑO
 * --------------------
 * 1. MEDIANA + MAD, nunca promedio/desvío. Un solo outlier destruye la media y el desvío: con los
 *    529 valores en 6,4e15 adentro, el desvío estándar de esa serie es tan enorme que NADA queda
 *    fuera de rango — por eso el bug fue invisible. La mediana y el MAD ignoran hasta el 50% de
 *    contaminación.
 * 2. UMBRALES POR TIPO DE DATO, no uno global (`PERFILES`). Un precio diario se mueve 5% con un
 *    WASDE y eso es noticia, no error; un acumulado que baja es SIEMPRE un error. Un umbral único
 *    o grita en precios o duerme en acumulados.
 * 3. DISPERSIÓN SOBRE `nivel` o `delta` según la serie. Los precios y los acumulados TIENEN
 *    tendencia (inflación, cosecha) → el nivel de hoy no se compara contra el de hace 3 meses; lo
 *    estacionario es el CAMBIO. Los conteos estacionales, en cambio, sí se comparan en nivel, pero
 *    contra la misma época de años anteriores (`ventanaEstacional`).
 * 4. Chequeos UNIVARIADOS por serie. Nada de machine learning: sin muestras etiquetadas de "dato
 *    malo" no hay nada que entrenar, y estos chequeos cubren los 5 bugs reales a una fracción de la
 *    complejidad (conversación con Lautaro del 24/07, registrada en E7 §4 D7).
 *
 * Módulo PURO (sin `server-only`, sin red, sin DB): lo importan tanto las server actions de los
 * uploaders de `/admin/datos` como `scripts/chequeo-anomalias.mjs` (Node 22 importa `.ts` directo,
 * mismo patrón que `parse-agrochat.ts` en `cargar-compras.mjs`).
 */

export type TipoAnomalia = "salto" | "magnitud" | "monotonia" | "identidad" | "duplicado" | "rango";

/** `alta` = casi seguro un error de dato (bloquea un upload). `media` = mirar, puede ser real. */
export type Severidad = "alta" | "media";

export type Anomalia = {
  tipo: TipoAnomalia;
  /** Etiqueta legible de la serie, ej. "compras · soja · EXPORTACION · 2025/26". */
  serie: string;
  fecha: string;
  severidad: Severidad;
  valor: number | null;
  /** Contra qué se comparó (mediana, último valor, total de las partes...). */
  referencia: number | null;
  mensaje: string;
};

export type Punto = { fecha: string; valor: number };

export type Perfil = {
  /** Nombre del perfil (aparece en los mensajes, ayuda a calibrar leyendo el mail). */
  nombre: string;
  /**
   * Sobre qué se mide la dispersión:
   *  · `delta`: cambios entre observaciones consecutivas (series con tendencia: precios, acumulados,
   *    estimaciones entre vintages);
   *  · `nivel`: el valor en sí (series sin tendencia dentro de su ventana: conteos estacionales,
   *    flujos diarios).
   */
  base: "delta" | "nivel";
  /** Umbral de |x − referencia| / MAD normalizado. `null` = no chequear salto. */
  madK: number | null;
  /** Contra qué se compara el valor nuevo. */
  referencia: "ultimo" | "mediana";
  /** Observaciones mínimas de historia para que el chequeo tenga sentido estadístico. */
  minObs: number;
  /** Chequear si el ratio contra la referencia es ×1000, ÷1000, ×100 o ÷100 (error de UNIDAD). */
  magnitud: boolean;
  /** La serie es acumulada: no puede decrecer nunca. */
  monotona: boolean;
  /**
   * Piso ABSOLUTO en unidades de la serie: por debajo de esta diferencia no se avisa NUNCA, por más
   * que el z-score dé alto. Es la mitad que falta de la calibración: una serie con MAD 0 (conteos
   * que repiten el mismo valor, acumulados planos fuera de temporada) tiene dispersión cero y
   * cualquier movimiento da z infinito. Sin este piso, camiones tiraba ~480 alertas retroactivas aun
   * con el umbral en 100×. Se fija por serie en `anomalias-series.ts`, en la unidad del campo.
   */
  minDelta: number;
  /** Límites físicamente imposibles (por serie se puede pisar con `rango` en la llamada). */
  rango?: { min?: number; max?: number };
};

/**
 * Perfiles por TIPO DE DATO. Los valores salen de la calibración retroactiva contra el histórico
 * real de cada tabla (tabla de resultados en `docs/sesiones/2026-07-28-d7-detector-anomalias.md`):
 * se subieron hasta que el ruido sobre datos sanos quedó en ≤1-2 alertas/mes SIN perder ninguno de
 * los 5 bugs conocidos. Un detector que grita se ignora, y un detector ignorado es peor que nada.
 */
export const PERFILES = {
  /** Precios diarios (pizarra, futuros A3, CBOT): volátiles por naturaleza. */
  precio_diario: {
    nombre: "precio diario",
    base: "delta",
    madK: 20,
    referencia: "ultimo",
    minObs: 20,
    magnitud: true,
    monotona: false,
    minDelta: 0,
    rango: { min: 0 },
  },
  /** Series acumuladas (compras/farmer selling): casi monótonas, se mueven de a poco. */
  acumulado: {
    nombre: "acumulado",
    base: "delta",
    madK: 40,
    referencia: "ultimo",
    minObs: 8,
    magnitud: true,
    monotona: true,
    minDelta: 0,
    rango: { min: 0 },
  },
  /** Estimaciones de producción entre vintages: se mueven poco de un informe al siguiente. */
  estimacion: {
    nombre: "estimación",
    base: "delta",
    madK: 20,
    referencia: "ultimo",
    minObs: 4,
    magnitud: true,
    monotona: false,
    minDelta: 0,
    rango: { min: 0 },
  },
  /** Conteos fuertemente estacionales (camiones en puerto): se comparan contra la misma época. */
  conteo_estacional: {
    nombre: "conteo estacional",
    base: "nivel",
    madK: 12,
    referencia: "mediana",
    minObs: 10,
    // SIN chequeo de orden de magnitud, y esto salió de la calibración: un conteo diario recorre 3
    // órdenes de magnitud por razones REALES (1 camión un feriado o un domingo, 4.000 en el pico de
    // cosecha), así que el ratio ×100/÷100 se cumple todo el tiempo sin que haya ningún error de
    // unidad. Con el chequeo prendido, camiones solo aportaba ~1.100 alertas retroactivas, todas
    // falsas. Los outliers reales de esta serie los agarra el salto contra su ventana estacional.
    magnitud: false,
    monotona: false,
    minDelta: 0,
    rango: { min: 0 },
  },
  /** Flujos diarios con signo (compras netas BCRA): cambian de signo, el ratio no significa nada. */
  flujo_diario: {
    nombre: "flujo diario",
    base: "nivel",
    madK: 20,
    referencia: "mediana",
    minObs: 20,
    magnitud: false,
    monotona: false,
    minDelta: 0,
  },
} as const satisfies Record<string, Perfil>;

export type NombrePerfil = keyof typeof PERFILES;

/* ------------------------------------------------------------------ */
/* Estadística robusta                                                 */
/* ------------------------------------------------------------------ */

/** Mediana de una lista (no la muta). `null` si está vacía. */
export function mediana(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/**
 * MAD normalizado (mediana de |x − mediana| × 1,4826). El factor lo hace comparable a un desvío
 * estándar cuando los datos son normales → los `madK` de los perfiles se leen como "sigmas".
 * `null` si no hay datos.
 */
export function madNormalizado(xs: number[]): number | null {
  const med = mediana(xs);
  if (med == null) return null;
  const desv = mediana(xs.filter(Number.isFinite).map((x) => Math.abs(x - med)));
  return desv == null ? null : desv * 1.4826;
}

/** Diferencias entre observaciones consecutivas. */
function deltas(xs: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i]! - xs[i - 1]!);
  return out;
}

/* ------------------------------------------------------------------ */
/* Chequeo de una serie                                                */
/* ------------------------------------------------------------------ */

/** Órdenes de magnitud que delatan un error de unidad (miles ↔ unidades, % ↔ fracción). */
const ORDENES = [3, 2, -2, -3];
/** Tolerancia en dex: 0,15 ≈ ±41%. Un ÷1000 real cae en 0,000-0,002 del ratio, muy adentro. */
const TOL_DEX = 0.15;

function fmt(x: number): string {
  const abs = Math.abs(x);
  const dec = abs >= 1000 ? 0 : abs >= 1 ? 2 : 6;
  return x.toLocaleString("es-AR", { maximumFractionDigits: dec });
}

export type OpcionesSerie = {
  /** Etiqueta legible de la serie (aparece en el mensaje). */
  serie: string;
  perfil: Perfil;
  /** Historia previa ORDENADA por fecha ascendente, sin los puntos nuevos. */
  historia: Punto[];
  /** Puntos que se están por cargar (o se acaban de cargar), ordenados por fecha ascendente. */
  nuevos: Punto[];
  /** Pisa el `rango` del perfil para esta serie puntual (ej. rinde de soja ≤ 10 tn/ha). */
  rango?: { min?: number; max?: number };
  /** Piso absoluto de la serie (pisa el del perfil). Ver `Perfil.minDelta`. */
  minDelta?: number;
  /**
   * Segunda referencia para el chequeo de SALTO: el aviso sale sólo si el punto se despega de las
   * DOS (`historia` y ésta). Se usa en las series estacionales, donde `historia` es la ventana de
   * la misma época de años anteriores y ésta es la ventana reciente de la propia serie.
   *
   * Sin este cruce, un cambio de RÉGIMEN real (en 2025 Bahía Blanca pasó de ~45 a ~700 camiones de
   * soja por día — noticia de mercado, no error de dato) tira una alerta por día durante meses:
   * medido en la calibración, era el 95% del ruido de camiones (12/mes → 0,5/mes con el cruce). Un
   * nivel nuevo sostenido deja de ser anomalía en pocos días; un pinchazo de un solo día no.
   */
  historiaReciente?: Punto[];
  /** Unidad para los mensajes (ej. "t", "USD/tn", "Mt"). */
  unidad?: string;
};

/** z-score robusto del punto contra una historia, o `null` si no hay historia suficiente. */
function zRobusto(perfil: Perfil, historia: number[], valor: number): { z: number; ref: number } | null {
  if (historia.length < perfil.minObs) return null;
  const ultimo = historia[historia.length - 1]!;
  const ref = perfil.referencia === "ultimo" ? ultimo : (mediana(historia) ?? ultimo);
  const muestra = perfil.base === "delta" ? deltas(historia) : historia;
  const centro = mediana(muestra);
  const disp = madNormalizado(muestra);
  if (centro == null || disp == null) return null;
  const x = perfil.base === "delta" ? valor - ultimo : valor;
  // Piso de dispersión: una serie plana da MAD 0 y todo daría z infinito. 1% de |ref| como mínimo
  // (o 1e-9 si la referencia es 0) evita el falso positivo por serie constante.
  const escala = Math.max(disp, Math.abs(ref) * 0.01, 1e-9);
  return { z: Math.abs(x - centro) / escala, ref };
}

/**
 * Corre TODOS los chequeos del perfil sobre los puntos nuevos de UNA serie.
 *
 * Cada punto nuevo se evalúa contra la historia acumulada hasta ese momento (historia + los puntos
 * nuevos anteriores a él), así una carga de varias semanas se valida semana a semana en vez de
 * comparar todo contra la misma foto vieja.
 */
export function chequearSerie(o: OpcionesSerie): Anomalia[] {
  const { serie, perfil, historia, nuevos } = o;
  const unidad = o.unidad ? ` ${o.unidad}` : "";
  const rango = o.rango ?? perfil.rango;
  const minDelta = o.minDelta ?? perfil.minDelta;
  const out: Anomalia[] = [];
  const acumulada = historia.map((p) => p.valor).filter(Number.isFinite);
  // Ventana secundaria (opcional): se extiende igual que la principal a medida que se procesan los
  // puntos nuevos, para que una carga de varias fechas se valide fecha a fecha.
  const reciente = o.historiaReciente?.map((p) => p.valor).filter(Number.isFinite);

  for (const p of nuevos) {
    if (!Number.isFinite(p.valor)) continue;
    const base = { serie, fecha: p.fecha, valor: p.valor };
    const ultimo = acumulada.length ? acumulada[acumulada.length - 1]! : null;

    // (f) RANGO FÍSICAMENTE IMPOSIBLE — no necesita historia; es lo único que protege una serie nueva.
    if (rango) {
      const { min, max } = rango;
      if (min != null && p.valor < min) {
        out.push({ ...base, tipo: "rango", severidad: "alta", referencia: min,
          mensaje: `${serie}: ${fmt(p.valor)}${unidad} es imposible (mínimo ${fmt(min)}${unidad}).` });
      } else if (max != null && p.valor > max) {
        out.push({ ...base, tipo: "rango", severidad: "alta", referencia: max,
          mensaje: `${serie}: ${fmt(p.valor)}${unidad} es imposible (máximo ${fmt(max)}${unidad}).` });
      }
    }

    if (acumulada.length >= perfil.minObs && ultimo != null) {
      const ref = perfil.referencia === "ultimo" ? ultimo : (mediana(acumulada) ?? ultimo);

      // (b) ORDEN DE MAGNITUD — error de unidad, no dato raro. Casi sin falsos positivos: agarra el
      // ÷1000 del export de Agrochat en miles de toneladas.
      if (perfil.magnitud && ref !== 0 && p.valor !== 0 && Math.sign(p.valor) === Math.sign(ref)) {
        const dex = Math.log10(Math.abs(p.valor / ref));
        const orden = ORDENES.find((o2) => Math.abs(dex - o2) <= TOL_DEX);
        if (orden != null) {
          const factor = orden > 0 ? `×${10 ** orden}` : `÷${10 ** -orden}`;
          out.push({ ...base, tipo: "magnitud", severidad: "alta", referencia: ref,
            mensaje: `${serie}: ${fmt(p.valor)}${unidad} es ${factor} su referencia (${fmt(ref)}${unidad}) — huele a error de UNIDADES, no a dato de mercado.` });
        }
      }

      // (c) MONOTONÍA — un acumulado no puede bajar. La matview `compras_avance_hist` ya clampea
      // esto EN SILENCIO para que el panel no muestre disparates; ese silencio es exactamente lo
      // que dejó pasar el ÷1000 días enteros. El clamp se mantiene; acá además AVISA.
      if (perfil.monotona && ultimo - p.valor > minDelta) {
        const caida = (1 - p.valor / ultimo) * 100;
        out.push({ ...base, tipo: "monotonia", severidad: caida >= 5 ? "alta" : "media", referencia: ultimo,
          mensaje: `${serie}: el acumulado BAJÓ de ${fmt(ultimo)} a ${fmt(p.valor)}${unidad} (−${caida.toFixed(1)}%) y un acumulado no puede bajar.` });
      }

      // (a) SALTO VS HISTORIA — mediana y MAD, nunca promedio/desvío.
      if (perfil.madK != null) {
        const principal = zRobusto(perfil, acumulada, p.valor);
        const desvio = perfil.base === "delta" ? p.valor - ultimo : p.valor;
        const centro = mediana(perfil.base === "delta" ? deltas(acumulada) : acumulada) ?? 0;
        const segunda = reciente ? zRobusto(perfil, reciente, p.valor) : null;
        const pasaSegunda = !reciente || (segunda != null && segunda.z > perfil.madK);
        if (
          principal != null &&
          principal.z > perfil.madK &&
          pasaSegunda &&
          Math.abs(desvio - centro) >= minDelta
        ) {
          out.push({ ...base, tipo: "salto", severidad: principal.z > perfil.madK * 2 ? "alta" : "media", referencia: ref,
            mensaje: `${serie}: ${fmt(p.valor)}${unidad} se despega ${principal.z.toFixed(0)}× de lo normal para esta serie (perfil "${perfil.nombre}", umbral ${perfil.madK}×; referencia ${fmt(ref)}${unidad}).` });
        }
      }
    }

    acumulada.push(p.valor);
    reciente?.push(p.valor);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Identidades contables                                               */
/* ------------------------------------------------------------------ */

export type OpcionesIdentidad = {
  serie: string;
  fecha: string;
  total: number | null;
  partes: (number | null)[];
  /**
   *  · `igual`: total = suma de partes (compras: precio hecho + fijado + saldo = acumulado;
   *    estimaciones: área × rinde = producción);
   *  · `partes_menor`: la suma de las partes no puede SUPERAR al total, pero sí quedar por debajo
   *    (camiones: la serie TOTAL incluye granos que todavía no se cargaron por separado —
   *    verificado contra la base: 10.646 de 10.656 días×zona cumplen, y los 10 que no son defectos
   *    reales del origen).
   */
  modo: "igual" | "partes_menor";
  /** Tolerancia relativa (0,01 = 1%). */
  tolerancia: number;
  unidad?: string;
};

/**
 * (d) IDENTIDAD CONTABLE. Si una identidad se rompe no es noticia de mercado: es un parser leyendo
 * mal (el typo de BCR en pellets de girasol corría el índice de columnas y sólo se nota así).
 */
export function chequearIdentidad(o: OpcionesIdentidad): Anomalia | null {
  const { serie, fecha, total, modo, tolerancia } = o;
  const unidad = o.unidad ? ` ${o.unidad}` : "";
  if (total == null || !Number.isFinite(total)) return null;
  const partes = o.partes.filter((x): x is number => x != null && Number.isFinite(x));
  if (partes.length === 0) return null;
  const suma = partes.reduce((a, b) => a + b, 0);
  const margen = Math.max(Math.abs(total) * tolerancia, 1e-9);
  const rompe = modo === "igual" ? Math.abs(suma - total) > margen : suma - total > margen;
  if (!rompe) return null;
  const rel = total === 0 ? Infinity : ((suma - total) / total) * 100;
  return {
    tipo: "identidad", serie, fecha, severidad: "alta", valor: suma, referencia: total,
    mensaje:
      modo === "igual"
        ? `${serie}: las partes suman ${fmt(suma)}${unidad} pero el total dice ${fmt(total)}${unidad} (${rel > 0 ? "+" : ""}${rel.toFixed(1)}%) — si una identidad contable se rompe, es el parser, no el mercado.`
        : `${serie}: las partes suman ${fmt(suma)}${unidad}, MÁS que el total ${fmt(total)}${unidad} (${rel > 0 ? "+" : ""}${rel.toFixed(1)}%), y eso es imposible.`,
  };
}

/* ------------------------------------------------------------------ */
/* Duplicado exacto                                                    */
/* ------------------------------------------------------------------ */

export type FilaFirmada = {
  /** Etiqueta del período/fila nueva (ej. "trigo 2025/26"). */
  etiqueta: string;
  fecha: string;
  /** Firma = todos los valores medidos concatenados. Filas distintas con la misma firma = copia. */
  firma: string;
};

/**
 * (e) DUPLICADO EXACTO. Una fila nueva idéntica columna por columna a otro período es una copia del
 * origen, no un dato: el PAS de BCBA trajo la fila de trigo 2025/26 byte-a-byte igual a la de
 * 2024/25 (`parse-pas.ts` ya la descarta; esto generaliza el chequeo al resto de las fuentes).
 *
 * Firmas vacías o que representan "todo en cero" NO cuentan: dos filas sin dato coinciden siempre y
 * eso no delata nada.
 */
export function chequearDuplicados(nuevas: FilaFirmada[], previas: FilaFirmada[] = []): Anomalia[] {
  const vistas = new Map<string, string>();
  for (const p of previas) if (p.firma) vistas.set(p.firma, p.etiqueta);
  const out: Anomalia[] = [];
  for (const n of nuevas) {
    if (!n.firma) continue;
    const gemela = vistas.get(n.firma);
    if (gemela != null && gemela !== n.etiqueta) {
      out.push({
        tipo: "duplicado", serie: n.etiqueta, fecha: n.fecha, severidad: "alta", valor: null, referencia: null,
        mensaje: `${n.etiqueta}: llega idéntica columna por columna a ${gemela} — el origen está repitiendo una fila vieja, no publicando un dato nuevo.`,
      });
    }
    vistas.set(n.firma, n.etiqueta);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Ventana estacional                                                  */
/* ------------------------------------------------------------------ */

const DIA_MS = 86_400_000;

/**
 * Historia de la MISMA época del año en años anteriores (±`ventanaDias`), para las series
 * fuertemente estacionales. Sin esto, un pico de camiones en plena cosecha se compara contra el
 * promedio anual y dispara siempre.
 *
 * Alineación CALENDARIO, no por semana de campaña: `lineup/estacional.ts` alinea por campaña porque
 * sus métricas son por producto (la soja arranca 1-abr, el maíz 1-mar), pero la serie de camiones
 * tiene una clave TOTAL que mezcla todos los granos y no pertenece a ninguna campaña. El calendario
 * es la única alineación que aplica a todas sus claves por igual.
 */
export function ventanaEstacional(
  historia: Punto[],
  fecha: string,
  ventanaDias = 15,
  anios = 5,
  /**
   * Restringir la ventana al MISMO día de semana. Imprescindible en las series diarias de actividad
   * portuaria: un domingo entran ~0 camiones y un martes de cosecha 4.000, así que comparar un
   * domingo contra una ventana que mezcla días hábiles lo marca como outlier TODAS las semanas
   * (medido en la calibración: era la fuente #1 de ruido, ~12 alertas/mes de puro fin de semana).
   */
  mismoDiaSemana = false,
): Punto[] {
  const t = Date.parse(`${fecha.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(t)) return [];
  const centros: number[] = [];
  for (let a = 1; a <= anios; a++) {
    const d = new Date(t);
    d.setUTCFullYear(d.getUTCFullYear() - a);
    centros.push(d.getTime());
  }
  const dow = new Date(t).getUTCDay();
  return historia.filter((p) => {
    const tp = Date.parse(`${p.fecha.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(tp)) return false;
    if (mismoDiaSemana && new Date(tp).getUTCDay() !== dow) return false;
    return centros.some((c) => Math.abs(tp - c) <= ventanaDias * DIA_MS);
  });
}

/* ------------------------------------------------------------------ */
/* Salida                                                              */
/* ------------------------------------------------------------------ */

/** Orden de lectura: primero lo que más probablemente sea un error de dato. */
const ORDEN_TIPO: TipoAnomalia[] = ["magnitud", "identidad", "monotonia", "rango", "duplicado", "salto"];

export function ordenar(as: Anomalia[]): Anomalia[] {
  return [...as].sort((a, b) => {
    if (a.severidad !== b.severidad) return a.severidad === "alta" ? -1 : 1;
    const d = ORDEN_TIPO.indexOf(a.tipo) - ORDEN_TIPO.indexOf(b.tipo);
    return d !== 0 ? d : a.fecha.localeCompare(b.fecha);
  });
}

/** Texto plano listo para el mail de alerta o para el cartel del uploader. */
export function resumir(as: Anomalia[], max = 20): string {
  if (as.length === 0) return "Sin anomalías.";
  const orden = ordenar(as);
  const altas = orden.filter((a) => a.severidad === "alta").length;
  const cabeza = `${as.length} anomalía(s) detectada(s) — ${altas} de severidad alta.`;
  const lineas = orden.slice(0, max).map((a) => `· [${a.severidad}/${a.tipo}] ${a.fecha} — ${a.mensaje}`);
  const resto = orden.length > max ? [`… y ${orden.length - max} más.`] : [];
  return [cabeza, "", ...lineas, ...resto].join("\n");
}
