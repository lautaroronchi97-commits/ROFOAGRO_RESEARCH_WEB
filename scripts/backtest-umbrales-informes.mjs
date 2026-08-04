#!/usr/bin/env node
// Backtest de los umbrales-perilla del informe diario/semanal v3 (N16, E1 de
// docs/PLAN_INFORMES_V3.md §10 item 8) contra ~90 días reales — reporta cuántas veces
// cada regla habría disparado, para calibrarla a ~1-3 disparos/semana (la lección del
// 0,7/1,3 de cobertura de L4, que disparaba el 74-95% de los días por nunca haberse
// validado contra la distribución real).
//
// AD-HOC: no corre en CI ni en producción — se ejecuta a mano una vez, para documentar
// los valores finales en PLAN_INFORMES_V3.md §5.3/§6.2. Solo LECTURA.
//
// Uso: node scripts/backtest-umbrales-informes.mjs [--json]
// Entorno: SUPABASE_URL + SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY; con leer alcanza).

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const JSON_OUT = process.argv.includes("--json");
const DIAS = 90;

if (!SUPABASE_URL || !KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY) en el entorno.");
  process.exit(1);
}

function isoMenos(dias) {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
}
const DESDE = isoMenos(DIAS + 10); // colchón para las rolling-7 del arranque de la ventana
const HOY = isoMenos(0);

async function sbSelectAll(path) {
  const rows = [];
  let offset = 0;
  const sep = path.includes("?") ? "&" : "?";
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/${path}${sep}limit=1000&offset=${offset}`;
    const res = await fetch(url, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}: ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
    if (offset > 300_000) break; // backstop anti-loop
  }
  return rows;
}

function mediana(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function rango(dias) {
  return Array.from({ length: dias }, (_, i) => isoMenos(dias - 1 - i));
}
const DIAS_VENTANA = rango(DIAS);
const SEMANAS = DIAS / 7;

function reportarRegla(nombre, disparos, totalDias) {
  const porSemana = totalDias > 0 ? (disparos / totalDias) * 7 : null;
  const linea = `${nombre}: ${disparos}/${totalDias} días (${porSemana != null ? porSemana.toFixed(2) : "—"} disparos/semana)`;
  const ok = porSemana != null && porSemana >= 0.5 && porSemana <= 4; // banda holgada alrededor de 1-3
  console.log(`  ${ok ? "✅" : "⚠️ "} ${linea}`);
  return { nombre, disparos, totalDias, porSemana, calibrado: ok };
}

/* ---------------- 1. DJVE: ≥1,5× mediana de ton_7d/7 del producto ---------------- */

async function backtestDjve() {
  console.log(`\n== DJVE (umbral propuesto: ≥1,5× mediana de ton_7d/7 del producto) ==`);
  const rows = await sbSelectAll(
    `djve?select=producto,fecha_registro,toneladas&fecha_registro=gte.${DESDE}&fecha_registro=lte.${HOY}`,
  );
  const porProductoDia = new Map(); // producto -> Map(fecha -> toneladas)
  for (const r of rows) {
    if (!r.producto || !r.fecha_registro || !Number.isFinite(Number(r.toneladas))) continue;
    if (!porProductoDia.has(r.producto)) porProductoDia.set(r.producto, new Map());
    const m = porProductoDia.get(r.producto);
    m.set(r.fecha_registro, (m.get(r.fecha_registro) ?? 0) + Number(r.toneladas));
  }
  // Solo productos con volumen relevante en la ventana (evita ruido de productos marginales).
  const productos = [...porProductoDia.entries()]
    .map(([p, m]) => [p, [...m.values()].reduce((a, b) => a + b, 0)])
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([p]) => p);

  let disparosTotal = 0;
  let diasTotal = 0;
  for (const producto of productos) {
    const m = porProductoDia.get(producto);
    const serieDiaria = DIAS_VENTANA.map((f) => m.get(f) ?? 0);
    const rolling7 = DIAS_VENTANA.map((_, i) => {
      const desde = Math.max(0, i - 6);
      return serieDiaria.slice(desde, i + 1).reduce((a, b) => a + b, 0) / 7;
    });
    const med = mediana(rolling7.filter((v) => v > 0));
    if (!Number.isFinite(med) || med <= 0) continue;
    const disparos = rolling7.filter((v) => v >= 1.5 * med).length;
    disparosTotal += disparos;
    diasTotal += DIAS;
    console.log(`    ${producto}: mediana ton_7d/7 = ${med.toFixed(0)} tn/día`);
  }
  return reportarRegla("DJVE (agregado de los 6 productos con más volumen)", disparosTotal, diasTotal || DIAS);
}

/* ---------------- 2. Camiones: |Δ día| ≥30% (nacional, Williams) ---------------- */

async function backtestCamiones() {
  console.log(`\n== Camiones (umbral propuesto: |Δ día| ≥30%, solo la pata día-a-día) ==`);
  const rows = await sbSelectAll(
    `camiones?select=fecha,producto,cantidad&producto=eq.TOTAL&fecha=gte.${DESDE}&fecha=lte.${HOY}`,
  );
  const porDia = new Map();
  for (const r of rows) {
    if (!r.fecha || !Number.isFinite(Number(r.cantidad))) continue;
    porDia.set(r.fecha, (porDia.get(r.fecha) ?? 0) + Number(r.cantidad));
  }
  let disparos = 0;
  let medidos = 0;
  for (let i = 1; i < DIAS_VENTANA.length; i++) {
    const hoy = porDia.get(DIAS_VENTANA[i]);
    const ayer = porDia.get(DIAS_VENTANA[i - 1]);
    if (hoy == null || ayer == null || ayer === 0) continue;
    medidos++;
    if (Math.abs(hoy / ayer - 1) >= 0.3) disparos++;
  }
  if (medidos === 0) {
    console.log("  ⚠️  Sin datos de camiones en la ventana (tabla `camiones` es carga manual — puede no cubrir estos 90 días).");
    return { nombre: "Camiones", disparos: 0, totalDias: 0, porSemana: null, calibrado: null };
  }
  return reportarRegla("Camiones |Δ día| ≥30%", disparos, medidos);
}

/* ---------------- 3/4. Macro (Yahoo spark histórico): diario ≥3% y semanal ≥5% ---------------- */

const MACRO = [
  { yahoo: "CL=F", nombre: "Petróleo WTI" },
  { yahoo: "GC=F", nombre: "Oro" },
  { yahoo: "DX-Y.NYB", nombre: "Dólar (DXY)" },
  { yahoo: "BRL=X", nombre: "Real (USD/BRL)" },
];

async function fetchSerieMacro(yahoo) {
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(yahoo)}&range=6mo&interval=1d`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (ROFOAGRO backtest)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const r0 = data?.spark?.result?.[0]?.response?.[0];
  const timestamp = r0?.timestamp;
  const close = r0?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamp) || !Array.isArray(close)) return [];
  const out = [];
  for (let i = 0; i < timestamp.length; i++) {
    if (typeof timestamp[i] !== "number" || typeof close[i] !== "number") continue;
    out.push({ fecha: new Date(timestamp[i] * 1000).toISOString().slice(0, 10), valor: close[i] });
  }
  return out.filter((p) => p.fecha >= DESDE && p.fecha <= HOY).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

async function backtestMacro() {
  console.log(`\n== Otros mercados diario (umbral propuesto: |Δ| ≥3%) y semanal (≥5%) ==`);
  let disparosDia = 0, medidosDia = 0, disparosSemana = 0, medidosSemana = 0;
  for (const { yahoo, nombre } of MACRO) {
    const serie = await fetchSerieMacro(yahoo);
    if (serie.length < 2) {
      console.log(`    ${nombre}: sin serie suficiente (¿bloqueo de red del entorno?), se omite.`);
      continue;
    }
    for (let i = 1; i < serie.length; i++) {
      const d = serie[i].valor / serie[i - 1].valor - 1;
      medidosDia++;
      if (Math.abs(d) >= 0.03) disparosDia++;
    }
    for (let i = 5; i < serie.length; i++) {
      // ~5 ruedas ≈ 7 días calendario (fin de semana sin cotización).
      const d = serie[i].valor / serie[i - 5].valor - 1;
      medidosSemana++;
      if (Math.abs(d) >= 0.05) disparosSemana++;
    }
  }
  const diario = reportarRegla("Otros mercados diario |Δ| ≥3% (4 instrumentos combinados)", disparosDia, medidosDia || 1);
  const semanal = reportarRegla("Commodities semanal |Δ| ≥5% (4 instrumentos combinados)", disparosSemana, medidosSemana || 1);
  return { diario, semanal };
}

async function main() {
  console.log(`Backtest de umbrales — ventana ${DESDE} → ${HOY} (${DIAS} días, ~${SEMANAS.toFixed(1)} semanas)`);
  const resultados = { djve: null, camiones: null, macroDiario: null, macroSemanal: null };
  try {
    resultados.djve = await backtestDjve();
  } catch (e) {
    console.error(`  ✗ DJVE falló: ${e.message}`);
  }
  try {
    resultados.camiones = await backtestCamiones();
  } catch (e) {
    console.error(`  ✗ Camiones falló: ${e.message}`);
  }
  try {
    const { diario, semanal } = await backtestMacro();
    resultados.macroDiario = diario;
    resultados.macroSemanal = semanal;
  } catch (e) {
    console.error(`  ✗ Macro falló: ${e.message}`);
  }

  console.log(
    "\nObjetivo: ~1-3 disparos/semana por regla. ✅ = dentro de la banda holgada (0,5-4/semana) usada acá; ⚠️ = revisar el umbral antes de fijarlo en el plan.",
  );

  if (JSON_OUT) console.log(JSON.stringify(resultados, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
