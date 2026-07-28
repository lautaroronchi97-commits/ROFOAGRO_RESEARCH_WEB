#!/usr/bin/env node
import { canonShipper } from "../src/lib/lineup/shippers.ts";

// Healthcheck de frescura de las bases que alimenta ESTE repo (crons de GitHub Actions).
//
// Revisa el último dato de cada tabla propia y lo compara contra su cadencia esperada. Si algo se
// atrasó más de su umbral, sale con exit 1 → el workflow queda en ROJO y GitHub avisa por mail
// (notificación default de un scheduled workflow que falla). Es la red que faltaba: hasta ahora la
// única señal de vida era el exit code de cada ingesta, que MIENTE (un parser roto termina en verde
// sin insertar; ver los guards de 0-filas en los scripts de ingesta).
//
// Solo LECTURA. Uso:
//   node scripts/healthcheck-frescura.mjs           # revisa y sale 1 si hay atrasos
//   node scripts/healthcheck-frescura.mjs --json     # además imprime el detalle en JSON
// Entorno (NO en el repo): SUPABASE_URL + SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY; con leer alcanza).

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const JSON_OUT = process.argv.includes("--json");

if (!SUPABASE_URL || !KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY) en el entorno.");
  process.exit(1);
}

const HOY = new Date();

function diasDesde(fecha) {
  // fecha puede ser "YYYY-MM-DD" (date) o un timestamp ISO; normalizamos al día UTC.
  const iso = String(fecha).slice(0, 10);
  const d = new Date(`${iso}T00:00:00Z`);
  return Math.floor((HOY - d) / 86400000);
}

async function ultimaFecha(tabla, col, filtro) {
  const url =
    `${SUPABASE_URL}/rest/v1/${tabla}` +
    `?select=${col}&${col}=not.is.null&order=${col}.desc&limit=1${filtro ?? ""}`;
  const res = await fetch(url, {
    headers: { apikey: KEY, authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const j = await res.json();
  return j[0]?.[col] ?? null;
}

// Umbrales en días CALENDARIO, holgados para tolerar fines de semana + feriados/puentes (el mayor
// hueco legítimo de una serie diaria es ~5 días: feriado + puente + finde) sin dejar de detectar un
// freeze real (un parser roto se nota igual en < 1 semana). Ajustables.
const CHECKS = [
  { nombre: "futuros_cierres (A3/Matba)", tabla: "futuros_cierres", col: "fecha", maxDias: 7, cadencia: "diario hábil" },
  { nombre: "cbot_cierres (CBOT)", tabla: "cbot_cierres", col: "fecha", maxDias: 7, cadencia: "diario hábil (T-1)" },
  { nombre: "pizarra_historico (CAC)", tabla: "pizarra_historico", col: "fecha", maxDias: 7, cadencia: "diario hábil" },
  { nombre: "lineup (buques ISA)", tabla: "lineup", col: "fecha_consulta", maxDias: 7, cadencia: "diario hábil (ISA tiene huecos)" },
  { nombre: "djve (MAGyP)", tabla: "djve", col: "fecha_registro", maxDias: 5, cadencia: "diario" },
  { nombre: "compras (SIO Granos)", tabla: "compras", col: "fecha", maxDias: 14, cadencia: "semanal (upload manual Agrochat)" },
  // Camiones (C5): carga 100% MANUAL (Williams Entregas es un servicio pago sin API — Lautoro sube
  // el CSV de /admin/datos cuando le queda cómodo, sin cadencia fija comprometida). El check acá
  // NO significa "¿corrió el cron anoche?" (no hay cron) sino "¿hace cuánto que no sube un CSV
  // nuevo?" — umbral laxo (3 semanas) a propósito, para no generar ruido de un proceso manual sin
  // promesa de frecuencia; si se atrasa mucho más que eso sí vale la pena que Lautoro se acuerde.
  { nombre: "camiones (Williams Entregas)", tabla: "camiones", col: "fecha", maxDias: 21, cadencia: "irregular (upload manual, sin cron)" },
  // Camiones de Agroentregas (C24): ESTE sí tiene cron (2 corridas diarias, todos los días — los
  // puertos reciben también los sábados). La fuente es una foto del día en curso sin backfill
  // posible, así que un atraso de más de 2 días ya significa días perdidos para siempre: umbral
  // corto a propósito, al revés que el de Williams.
  { nombre: "camiones_plantas (Agroentregas)", tabla: "camiones_plantas", col: "fecha", maxDias: 3, cadencia: "diario (cron 2×/día)" },
  { nombre: "noticias", tabla: "noticias", col: "fecha_pub", maxDias: 2, cadencia: "horario" },
  // Compras netas BCRA / MULC (C4): la API v4 var 78 llega con ~3-4 días hábiles de rezago
  // (docs/negocio/07) — umbral holgado para no enrojecer por el rezago normal + fin de semana;
  // la carga manual de /admin/datos también cuenta acá (misma tabla), así que en la práctica
  // rara vez debería quedar tan atrás.
  { nombre: "compras_bcra (BCRA MULC)", tabla: "compras_bcra", col: "fecha", maxDias: 12, cadencia: "diario hábil (API, T-3/4) + manual" },
  { nombre: "estimaciones USDA", tabla: "estimaciones_produccion", col: "fecha_publicacion", filtro: "&organismo=eq.USDA", maxDias: 45, cadencia: "mensual (WASDE)" },
  { nombre: "estimaciones CONAB", tabla: "estimaciones_produccion", col: "fecha_publicacion", filtro: "&organismo=eq.CONAB", maxDias: 45, cadencia: "mensual" },
  { nombre: "estimaciones BCR-GEA", tabla: "estimaciones_produccion", col: "fecha_publicacion", filtro: "&organismo=eq.BCR", maxDias: 45, cadencia: "mensual" },
  { nombre: "estimaciones DEA-SAGyP", tabla: "estimaciones_produccion", col: "fecha_publicacion", filtro: "&organismo=eq.DEA", maxDias: 9, cadencia: "semanal" },
  // views_mercado tiene RLS solo-admin → este check requiere la SERVICE key (la del workflow); con anon da 401.
  { nombre: "views_mercado (view semanal MP3)", tabla: "views_mercado", col: "creado_en", maxDias: 10, cadencia: "semanal (Routine viernes)" },
];

// E5 #9: "seeds de futuro" — datos que no se atrasan hacia el pasado sino que se AGOTAN hacia
// adelante (el ángulo ciego de los checks de frescura). Fallan con meses de anticipación.
const FUTURO = [
  {
    nombre: "vencimientos con futuro suficiente",
    tabla: "vencimientos",
    col: "vencimiento",
    minDiasFuturo: 180,
    nota: "los refresca ingest-cierres.mjs desde el CEM cada noche hábil",
  },
];

// Última fecha OFICIAL sembrada en src/lib/calendario.ts (CONAB_2026 termina el 15/12/2026).
// ⚠️ Mantener EN SYNC al sembrar el seed del año siguiente (y subir SEED_ACTUAL en
// refresh-calendario.mjs). Con <60 días de seed restante este check enrojece el healthcheck.
const ULTIMO_SEED_CALENDARIO = "2026-12-15";

// Erosión del roster de exportadores (lote L4, auditoría E7, 23/07/2026, decisión de Lautaro):
// `shippers.ts` colapsa ~280 variantes de razón social a un puñado de jugadores estables + "OTROS".
// Si "OTROS" crece (fusión, jugador nuevo, typo nuevo de ISA) el mapeo pierde representatividad
// SIN que nada rompa — no es un problema de frescura, así que va aparte. Al 22/07 el share real era
// 2,6% (sano); umbral de aviso 15% (~6× ese nivel). NO hace fallar el healthcheck (solo ::warning +
// fila) porque un roster que erosiona no es una fuente caída, es una señal para actualizar shippers.ts.
const ROSTER_UMBRAL_OTROS_PCT = 15;

// Matviews de mesa: no tienen fecha de "hoy" propia; se controla que su última fila coincida con la de
// su tabla base (si la base avanzó y la matview no, quedó sin refrescar y muestra datos viejos callada).
const MATVIEWS = [
  { nombre: "compras_avance_hist", mv: "compras_avance_hist", mvCol: "fecha", base: "compras", baseCol: "fecha" },
  { nombre: "lineup_gap_hist", mv: "lineup_gap_hist", mvCol: "fecha", base: "lineup", baseCol: "fecha_consulta" },
  { nombre: "lineup_densidad_hist", mv: "lineup_densidad_hist", mvCol: "fecha", base: "lineup", baseCol: "fecha_consulta" },
];

/** Share de "OTROS" (shippers no reconocidos por shippers.ts) en la última rueda del line-up. */
async function erosionRoster() {
  const fechaUrl = `${SUPABASE_URL}/rest/v1/lineup?select=fecha_consulta&es_agro=eq.true&order=fecha_consulta.desc&limit=1`;
  const fechaRes = await fetch(fechaUrl, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (!fechaRes.ok) throw new Error(`HTTP ${fechaRes.status} ${(await fechaRes.text()).slice(0, 120)}`);
  const fecha = (await fechaRes.json())[0]?.fecha_consulta ?? null;
  if (!fecha) return { fecha: null, pctOtros: null, tnOtros: 0, tnTotal: 0 };

  const rowsUrl =
    `${SUPABASE_URL}/rest/v1/lineup?select=shipper,quantity` +
    `&fecha_consulta=eq.${fecha}&es_agro=eq.true&ops=eq.LOAD`;
  const rowsRes = await fetch(rowsUrl, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (!rowsRes.ok) throw new Error(`HTTP ${rowsRes.status} ${(await rowsRes.text()).slice(0, 120)}`);
  const rows = await rowsRes.json();

  let tnTotal = 0;
  let tnOtros = 0;
  for (const r of rows) {
    const q = Number(r.quantity ?? 0);
    if (!Number.isFinite(q) || q <= 0) continue;
    tnTotal += q;
    if (canonShipper(r.shipper).canon === "OTROS") tnOtros += q;
  }
  const pctOtros = tnTotal > 0 ? (100 * tnOtros) / tnTotal : null;
  return { fecha, pctOtros, tnOtros, tnTotal };
}

async function main() {
  const detalle = [];
  let fallas = 0;

  for (const c of CHECKS) {
    let fecha = null;
    let error = null;
    try {
      fecha = await ultimaFecha(c.tabla, c.col, c.filtro);
    } catch (e) {
      error = e.message;
    }
    const dias = fecha ? diasDesde(fecha) : null;
    const atrasado = error != null || fecha == null || dias > c.maxDias;
    if (atrasado) fallas++;
    const marca = error ? "✗ ERROR" : fecha == null ? "✗ SIN DATOS" : atrasado ? "✗ ATRASADO" : "✓";
    console.log(
      `${marca}  ${c.nombre}: ` +
        (error
          ? error
          : fecha == null
            ? "sin filas"
            : `último ${String(fecha).slice(0, 10)} (${dias}d · ${c.cadencia} · umbral ${c.maxDias}d)`),
    );
    detalle.push({ ...c, fecha, dias, atrasado, error });
  }

  // Matviews de mesa: su última fila debe coincidir con la de su tabla base.
  for (const m of MATVIEWS) {
    let mvF = null;
    let baseF = null;
    let error = null;
    try {
      mvF = await ultimaFecha(m.mv, m.mvCol);
      baseF = await ultimaFecha(m.base, m.baseCol);
    } catch (e) {
      error = e.message;
    }
    // Rezagada si la base tiene fecha más nueva que la matview (más de 1 día de diferencia tolerado).
    const rezago = error == null && mvF && baseF ? diasDesde(mvF) - diasDesde(baseF) : null;
    const atrasado = error != null || mvF == null || (rezago != null && rezago > 1);
    if (atrasado) fallas++;
    const marca = error ? "✗ ERROR" : mvF == null ? "✗ SIN DATOS" : atrasado ? "✗ SIN REFRESCAR" : "✓";
    console.log(
      `${marca}  matview ${m.nombre}: ` +
        (error
          ? error
          : mvF == null
            ? "sin filas"
            : `matview ${String(mvF).slice(0, 10)} vs base ${String(baseF).slice(0, 10)} (rezago ${rezago}d)`),
    );
    detalle.push({ nombre: `matview ${m.nombre}`, mvF, baseF, rezago, atrasado, error });
  }

  // Seeds de futuro (E5 #9): días RESTANTES en vez de días de atraso.
  for (const f of FUTURO) {
    let fecha = null;
    let error = null;
    try {
      fecha = await ultimaFecha(f.tabla, f.col);
    } catch (e) {
      error = e.message;
    }
    const restantes = fecha ? -diasDesde(fecha) : null;
    const agotado = error != null || fecha == null || restantes < f.minDiasFuturo;
    if (agotado) fallas++;
    const marca = error ? "✗ ERROR" : agotado ? "✗ POR AGOTARSE" : "✓";
    console.log(
      `${marca}  ${f.nombre}: ` +
        (error ? error : fecha == null ? "sin filas" : `hasta ${String(fecha).slice(0, 10)} (${restantes}d de futuro · mínimo ${f.minDiasFuturo}d · ${f.nota})`),
    );
    detalle.push({ nombre: f.nombre, fecha, restantes, atrasado: agotado, error });
  }

  {
    const restantes = -diasDesde(ULTIMO_SEED_CALENDARIO);
    const agotado = restantes < 60;
    if (agotado) fallas++;
    console.log(
      `${agotado ? "✗ POR AGOTARSE" : "✓"}  seed calendario oficial: hasta ${ULTIMO_SEED_CALENDARIO} ` +
        `(${restantes}d de futuro · mínimo 60d · sembrar el año próximo en src/lib/calendario.ts y actualizar ULTIMO_SEED_CALENDARIO acá)`,
    );
    detalle.push({ nombre: "seed calendario oficial", fecha: ULTIMO_SEED_CALENDARIO, restantes, atrasado: agotado });
  }

  // Erosión del roster: NO suma a `fallas` (no es una fuente caída) — solo avisa.
  {
    let r = { fecha: null, pctOtros: null, tnOtros: 0, tnTotal: 0 };
    let error = null;
    try {
      r = await erosionRoster();
    } catch (e) {
      error = e.message;
    }
    const erosionado = error == null && r.pctOtros != null && r.pctOtros > ROSTER_UMBRAL_OTROS_PCT;
    const marca = error ? "✗ ERROR" : r.pctOtros == null ? "· SIN DATOS" : erosionado ? "⚠ EROSIONADO" : "✓";
    const msg = error
      ? error
      : r.pctOtros == null
        ? "sin rueda reciente"
        : `OTROS ${r.pctOtros.toFixed(1)}% de la rueda ${r.fecha} (${Math.round(r.tnOtros).toLocaleString("es-AR")} de ${Math.round(r.tnTotal).toLocaleString("es-AR")} t · umbral ${ROSTER_UMBRAL_OTROS_PCT}%)`;
    console.log(`${marca}  roster de exportadores (shippers.ts): ${msg}`);
    if (erosionado) console.log(`::warning::Roster de shippers erosionado — OTROS ${r.pctOtros.toFixed(1)}% (umbral ${ROSTER_UMBRAL_OTROS_PCT}%). Revisar src/lib/lineup/shippers.ts.`);
    detalle.push({ nombre: "roster de exportadores", ...r, atrasado: erosionado, error });
  }

  if (JSON_OUT) console.log("\n" + JSON.stringify(detalle, null, 2));

  if (fallas > 0) {
    console.error(`\n${fallas} tabla(s) con problemas de frescura. Revisar el cron / la fuente.`);
    process.exit(1);
  }
  console.log("\nTodas las tablas al día. ✔");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
