#!/usr/bin/env node
/**
 * chequeo-anomalias — barrido diario de valores implausibles en las tablas propias (D7/L7 del
 * backlog maestro, `docs/auditoria/E7-sintesis.md` §4).
 *
 * Complementa a `healthcheck-frescura.mjs`: aquel pregunta "¿la tabla se atrasó?", éste pregunta
 * "¿lo que entró es plausible contra la historia de su propia serie?". El motor (mediana/MAD,
 * orden de magnitud, monotonía, identidades contables, duplicado exacto) vive en
 * `src/lib/anomalias.ts` y el catálogo de series en `src/lib/anomalias-series.ts` — este script
 * sólo trae los datos y arma las series (Node 22 importa `.ts` directo, mismo patrón que
 * `cargar-compras.mjs` con `parse-agrochat.ts`).
 *
 * POR QUÉ UN BARRIDO Y NO UN CHEQUEO ADENTRO DE CADA `ingest-*.mjs`
 * ----------------------------------------------------------------
 * El prompt de L7 pedía "correr después del upsert y avisar por mail". Un barrido diario cumple
 * exactamente eso (corre después de TODOS los upserts del día, por construcción) con una sola
 * implementación en vez de trece copias del mismo bloque en cada script de ingesta, y de yapa cubre
 * las tablas que NO tienen cron (camiones, DEA, PAS, LECAP: carga manual). El costo es detectar
 * dentro de las 24 h en vez de al instante — irrelevante para una alerta que no bloquea nada y que
 * Lautaro lee por mail. Los uploaders manuales de `/admin/datos` sí chequean en el acto y BLOQUEAN,
 * porque ahí hay alguien mirando la pantalla.
 *
 * Uso:
 *   node scripts/chequeo-anomalias.mjs                  # últimos 3 días (lo que corre el cron)
 *   node scripts/chequeo-anomalias.mjs --dias 30        # ventana más ancha
 *   node scripts/chequeo-anomalias.mjs --desde 2026-07-01
 *   node scripts/chequeo-anomalias.mjs --calibrar       # TODO el histórico + alertas/mes por serie
 *   node scripts/chequeo-anomalias.mjs --serie compras_acumulado   # una sola
 *   node scripts/chequeo-anomalias.mjs --salida /tmp/anomalias.txt # resumen a archivo (para el mail)
 *
 * Sale 1 si hay alguna anomalía de severidad ALTA → el workflow queda en rojo y dispara el mail.
 * Solo LECTURA. Entorno: SUPABASE_URL + SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY).
 */

import { writeFileSync } from "node:fs";
import {
  PERFILES,
  chequearSerie,
  chequearIdentidad,
  chequearDuplicados,
  ventanaEstacional,
  ordenar,
  resumir,
} from "../src/lib/anomalias.ts";
import { SERIES, IDENTIDADES } from "../src/lib/anomalias-series.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY) en el entorno.");
  process.exit(1);
}

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

const CALIBRAR = flag("calibrar");
const SOLO_SERIE = arg("serie");
const SALIDA = arg("salida");
const DIAS = Number(arg("dias", "3"));
const DESDE =
  arg("desde") ??
  (CALIBRAR ? "1900-01-01" : new Date(Date.now() - DIAS * 86_400_000).toISOString().slice(0, 10));

/* ---------------------------------------------------------------- */
/* Acceso a datos                                                    */
/* ---------------------------------------------------------------- */

const PAGE = 1000;
/** Observaciones de la propia serie que forman la "ventana reciente" de las series estacionales. */
const VENTANA_RECIENTE = 30;

/** SELECT paginado completo de una tabla (PostgREST corta en 1000 filas por request). */
async function traer(tabla, cols, filtro = "", orden) {
  const filas = [];
  for (let off = 0; ; off += PAGE) {
    const url =
      `${SUPABASE_URL}/rest/v1/${tabla}?select=${cols.join(",")}${filtro}` +
      `&order=${orden}&limit=${PAGE}&offset=${off}`;
    const res = await fetch(url, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`${tabla}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    filas.push(...j);
    if (j.length < PAGE) break;
    if (off > 500_000) throw new Error(`${tabla}: más de 500k filas, revisá el filtro`);
  }
  return filas;
}

const num = (x) => (x == null || x === "" ? null : Number(x));

/* ---------------------------------------------------------------- */
/* Chequeo de las series del catálogo                                */
/* ---------------------------------------------------------------- */

/** Métricas de calibración por serie (se imprimen en modo --calibrar). */
const stats = [];

async function chequearConfig(nombre, cfg) {
  const perfil = PERFILES[cfg.perfil];
  const cols = [cfg.colFecha, cfg.colValor, ...cfg.clave];
  // El orden DEBE ser total: con sólo `fecha.asc` y cientos de filas por fecha, la paginación por
  // offset de PostgREST repite y saltea filas entre páginas (medido: camiones daba 42.636 puntos
  // sobre una tabla de 10.668). Las columnas de clave rompen todos los empates.
  const orden = [cfg.colFecha, ...cfg.clave].map((c) => `${c}.asc`).join(",");
  const filas = await traer(cfg.tabla, [...new Set(cols)], cfg.filtro ?? "", orden);

  // Partir en series por clave.
  const porClave = new Map();
  for (const f of filas) {
    const v = num(f[cfg.colValor]);
    const fecha = String(f[cfg.colFecha] ?? "").slice(0, 10);
    if (v == null || !Number.isFinite(v) || !fecha) continue;
    const k = cfg.clave.map((c) => f[c] ?? "—").join(" · ") || "(única)";
    if (!porClave.has(k)) porClave.set(k, []);
    porClave.get(k).push({ fecha, valor: v });
  }

  const anomalias = [];
  let puntosEvaluados = 0;
  for (const [k, puntos] of porClave) {
    puntos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const corte = puntos.findIndex((p) => p.fecha >= DESDE);
    if (corte < 0) continue;
    const etiqueta = `${cfg.tabla} · ${k}`;

    if (cfg.estacional) {
      // Serie estacional: cada punto se compara contra la MISMA época de años anteriores (si no,
      // todo pico de cosecha dispara) Y contra su propia ventana reciente — el aviso sale sólo si
      // se despega de las dos, así un cambio de régimen real no alerta todos los días (ver
      // `historiaReciente` en anomalias.ts).
      for (let i = Math.max(corte, 0); i < puntos.length; i++) {
        const p = puntos[i];
        puntosEvaluados++;
        anomalias.push(
          ...chequearSerie({
            serie: etiqueta,
            perfil,
            historia: ventanaEstacional(puntos.slice(0, i), p.fecha),
            historiaReciente: puntos.slice(Math.max(0, i - VENTANA_RECIENTE), i),
            nuevos: [p],
            rango: cfg.rango,
            minDelta: cfg.minDelta,
            unidad: cfg.unidad,
          }),
        );
      }
    } else {
      const historia = puntos.slice(0, Math.max(corte, 0));
      const nuevos = puntos.slice(Math.max(corte, 0));
      puntosEvaluados += nuevos.length;
      anomalias.push(
        ...chequearSerie({ serie: etiqueta, perfil, historia, nuevos, rango: cfg.rango, minDelta: cfg.minDelta, unidad: cfg.unidad }),
      );
    }
  }

  stats.push({ nombre, series: porClave.size, puntos: puntosEvaluados, anomalias });
  return anomalias;
}

/* ---------------------------------------------------------------- */
/* Identidades contables y duplicados                                */
/* ---------------------------------------------------------------- */

/** compras: precio hecho + fijado + saldo a fijar = comprado acumulado. */
async function identidadCompras() {
  const filas = await traer(
    "compras",
    ["fecha", "grano_raw", "sector", "campana", "toneladas", "precio_hecho_tn", "fijado_tn", "saldo_a_fijar_tn"],
    `&fecha=gte.${DESDE}`,
    "fecha.asc,campana.asc,codigo_interno.asc,sector.asc",
  );
  const out = [];
  let evaluadas = 0;
  for (const f of filas) {
    const ph = num(f.precio_hecho_tn), fj = num(f.fijado_tn), sf = num(f.saldo_a_fijar_tn);
    // Las 3 columnas ricas (precio hecho/fijado/saldo) llegaron con MP3/L1 (22/07/2026) — las filas
    // LEGACY viejas las tienen en null, no en 0. Con un solo valor presente ya "suma" algo muy
    // chico contra el acumulado y dispara siempre (medido: 75 falsas alertas retroactivas, casi
    // todo compras LEGACY 2019-2022). Exigir las 3 no-null es la identidad real.
    if (ph == null || fj == null || sf == null) continue;
    evaluadas++;
    const a = chequearIdentidad({
      serie: `compras · ${f.grano_raw} · ${f.sector} · ${f.campana}`,
      fecha: String(f.fecha).slice(0, 10),
      total: num(f.toneladas),
      partes: [ph, fj, sf],
      ...IDENTIDADES.compras,
      unidad: "t",
    });
    if (a) out.push(a);
  }
  stats.push({ nombre: "compras (identidad)", series: 1, puntos: evaluadas, anomalias: out });
  return out;
}

/** camiones: la suma por producto no puede superar la serie TOTAL del mismo día y zona. */
async function identidadCamiones() {
  const filas = await traer("camiones", ["fecha", "zona", "producto", "cantidad"], `&fecha=gte.${DESDE}`, "fecha.asc,zona.asc,producto.asc");
  const dias = new Map();
  for (const f of filas) {
    const k = `${String(f.fecha).slice(0, 10)}|${f.zona}`;
    if (!dias.has(k)) dias.set(k, { total: null, partes: [] });
    const d = dias.get(k);
    if (f.producto === "TOTAL") d.total = num(f.cantidad);
    else d.partes.push(num(f.cantidad));
  }
  const out = [];
  for (const [k, d] of dias) {
    const [fecha, zona] = k.split("|");
    const a = chequearIdentidad({
      serie: `camiones · ${zona}`,
      fecha,
      total: d.total,
      partes: d.partes,
      ...IDENTIDADES.camiones,
      unidad: "camiones",
    });
    if (a) out.push(a);
  }
  stats.push({ nombre: "camiones (identidad)", series: dias.size, puntos: dias.size, anomalias: out });
  return out;
}

/**
 * estimaciones: una campaña nueva idéntica columna por columna a otra del MISMO informe es una
 * copia del origen (el PAS de BCBA trajo trigo 2025/26 byte-a-byte igual a 2024/25).
 */
async function duplicadosEstimaciones() {
  const filas = await traer(
    "estimaciones_produccion",
    ["fecha_publicacion", "organismo", "pais", "grano", "campania", "variable", "valor"],
    `&fecha_publicacion=gte.${DESDE}`,
    "fecha_publicacion.asc,organismo.asc,pais.asc,grano.asc,campania.asc,variable.asc",
  );
  // Firma por (organismo, país, grano, vintage, campaña) = sus variables ordenadas.
  const porFila = new Map();
  for (const f of filas) {
    const k = `${f.organismo}|${f.pais}|${f.grano}|${f.fecha_publicacion}|${f.campania}`;
    if (!porFila.has(k)) porFila.set(k, []);
    porFila.get(k).push(`${f.variable}=${num(f.valor)}`);
  }
  // Se comparan sólo campañas del mismo informe/grano entre sí (grupos de vintage).
  const grupos = new Map();
  for (const [k, vars] of porFila) {
    const [organismo, pais, grano, vintage, campania] = k.split("|");
    const g = `${organismo}|${pais}|${grano}|${vintage}`;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push({
      etiqueta: `${organismo} ${grano} ${campania} (informe ${vintage})`,
      fecha: vintage,
      firma: vars.sort().join(";"),
    });
  }
  const out = [];
  for (const filasGrupo of grupos.values()) out.push(...chequearDuplicados(filasGrupo));
  stats.push({ nombre: "estimaciones (duplicado)", series: grupos.size, puntos: porFila.size, anomalias: out });
  return out;
}

/* ---------------------------------------------------------------- */

async function main() {
  const todas = [];
  for (const [nombre, cfg] of Object.entries(SERIES)) {
    if (SOLO_SERIE && SOLO_SERIE !== nombre) continue;
    todas.push(...(await chequearConfig(nombre, cfg)));
  }
  if (!SOLO_SERIE) {
    todas.push(...(await identidadCompras()));
    todas.push(...(await identidadCamiones()));
    todas.push(...(await duplicadosEstimaciones()));
  }

  const orden = ordenar(todas);
  const altas = orden.filter((a) => a.severidad === "alta");

  console.log(`Chequeo de anomalías — puntos con fecha >= ${DESDE}\n`);
  for (const s of stats) {
    const porTipo = new Map();
    for (const a of s.anomalias) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);
    const detalle = [...porTipo.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${n}`).join(" ");
    console.log(
      `  ${s.nombre.padEnd(28)} ${String(s.series).padStart(5)} series · ${String(s.puntos).padStart(7)} puntos · ${String(s.anomalias.length).padStart(4)} anomalías  ${detalle}`,
    );
  }
  console.log("");

  if (CALIBRAR) {
    // Ruido por mes sobre datos sanos: la métrica que decide si el detector se usa o se ignora.
    const porMes = new Map();
    for (const a of orden) {
      const m = a.fecha.slice(0, 7);
      porMes.set(m, (porMes.get(m) ?? 0) + 1);
    }
    const meses = [...porMes.keys()].sort();
    const total = orden.length;
    const span = meses.length || 1;
    console.log(`CALIBRACIÓN — ${total} anomalías sobre ${span} meses con alerta = ${(total / span).toFixed(2)} por mes con alerta.`);
    const primero = meses[0];
    const ultimo = meses[meses.length - 1];
    if (primero && ultimo) {
      const mesesTotales =
        (Number(ultimo.slice(0, 4)) - Number(primero.slice(0, 4))) * 12 +
        (Number(ultimo.slice(5, 7)) - Number(primero.slice(5, 7))) + 1;
      console.log(`  Sobre el período completo (${primero} → ${ultimo}, ${mesesTotales} meses): ${(total / mesesTotales).toFixed(2)} alertas/mes.`);
    }
    console.log(`  Meses con más ruido: ${[...porMes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, n]) => `${m}=${n}`).join(" · ")}\n`);
  }

  const texto = resumir(orden, CALIBRAR ? 200 : 30);
  console.log(texto);

  if (SALIDA) {
    try {
      writeFileSync(SALIDA, texto);
    } catch (e) {
      console.log(`::warning::no pude escribir ${SALIDA}: ${e.message}`);
    }
  }

  if (altas.length > 0 && !CALIBRAR) {
    console.error(`\n${altas.length} anomalía(s) de severidad ALTA — revisá el dato antes de usarlo.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`chequeo-anomalias: ${e.message}`);
  process.exit(1);
});
