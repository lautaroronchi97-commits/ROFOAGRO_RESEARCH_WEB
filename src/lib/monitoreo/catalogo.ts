/**
 * Catálogo único de conexiones externas del proyecto (crons, cargas manuales, Routines
 * de Claude). Fuente de verdad compartida por dos consumidores que antes vivían
 * separados sin ningún vínculo:
 *   - `scripts/healthcheck-frescura.mjs` (Node, corre 1×/día en el cron y avisa por
 *     mail si algo se atrasó) — antes tenía `CHECKS`/`MATVIEWS`/`FUTURO` hardcodeados
 *     acá mismo; ahora los importa de este módulo.
 *   - el panel `/admin/conexiones` (Next, se mira en vivo durante el día) — necesita
 *     los mismos umbrales MÁS el mapeo a workflows de GitHub y a las secciones de
 *     `/admin/datos` que ninguno de los dos tenía todavía.
 *
 * Sin `import "server-only"` a propósito: el script de Node (`.mjs`, fuera de Next)
 * también lo importa — mismo mecanismo que ya usa para `src/lib/lineup/shippers.ts`
 * (Node 22 hace type-stripping de `.ts` sin flags).
 */

export type Check = {
  nombre: string;
  tabla: string;
  col: string;
  filtro?: string;
  maxDias: number;
  cadencia: string;
};

// Umbrales en días CALENDARIO, holgados para tolerar fines de semana + feriados/puentes (el mayor
// hueco legítimo de una serie diaria es ~5 días: feriado + puente + finde) sin dejar de detectar un
// freeze real (un parser roto se nota igual en < 1 semana). Ajustables.
export const CHECKS: Check[] = [
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
  // pas_zonas (C23): misma RLS solo-admin que views_mercado → este check TAMBIÉN requiere la
  // SERVICE key, anon da 401. Umbral holgado (21d, como Williams): el desglose zonal solo se
  // mueve de verdad en ventanas de siembra/cosecha, la cadencia real es "cuando sale el PAS del
  // jueves" sin fecha fija comprometida — no hay cron, es 100% carga manual de Lautaro.
  { nombre: "pas_zonas (BCBA zonal)", tabla: "pas_zonas", col: "actualizado_en", maxDias: 21, cadencia: "manual (PAS jueves; el zonal cambia fuerte solo en siembra/cosecha)" },
];

// E5 #9: "seeds de futuro" — datos que no se atrasan hacia el pasado sino que se AGOTAN hacia
// adelante (el ángulo ciego de los checks de frescura). Fallan con meses de anticipación.
export type SeedFuturo = { nombre: string; tabla: string; col: string; minDiasFuturo: number; nota: string };

export const FUTURO: SeedFuturo[] = [
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
export const ULTIMO_SEED_CALENDARIO = "2026-12-15";
export const MIN_DIAS_SEED_CALENDARIO = 60;

// Erosión del roster de exportadores (lote L4, auditoría E7, 23/07/2026, decisión de Lautaro):
// `shippers.ts` colapsa ~280 variantes de razón social a un puñado de jugadores estables + "OTROS".
// Si "OTROS" crece (fusión, jugador nuevo, typo nuevo de ISA) el mapeo pierde representatividad
// SIN que nada rompa — no es un problema de frescura, así que va aparte. Al 22/07 el share real era
// 2,6% (sano); umbral de aviso 15% (~6× ese nivel). NO hace fallar el healthcheck (solo ::warning +
// fila) porque un roster que erosiona no es una fuente caída, es una señal para actualizar shippers.ts.
export const ROSTER_UMBRAL_OTROS_PCT = 15;

// Matviews de mesa: no tienen fecha de "hoy" propia; se controla que su última fila coincida con la de
// su tabla base (si la base avanzó y la matview no, quedó sin refrescar y muestra datos viejos callada).
export type MatviewCheck = { nombre: string; mv: string; mvCol: string; base: string; baseCol: string };

export const MATVIEWS: MatviewCheck[] = [
  { nombre: "compras_avance_hist", mv: "compras_avance_hist", mvCol: "fecha", base: "compras", baseCol: "fecha" },
  { nombre: "lineup_gap_hist", mv: "lineup_gap_hist", mvCol: "fecha", base: "lineup", baseCol: "fecha_consulta" },
  { nombre: "lineup_densidad_hist", mv: "lineup_densidad_hist", mvCol: "fecha", base: "lineup", baseCol: "fecha_consulta" },
];

/* -------------------------------------------------------------------------------------------- */
/* Workflows de GitHub Actions — solo para el panel (el healthcheck no los necesita: ya lee las   */
/* tablas directo). `checkNombre` referencia el `Check.nombre` de arriba que cubre ese workflow,  */
/* para que el panel muestre "última corrida real" y "frescura del dato" en la misma fila.        */
/* -------------------------------------------------------------------------------------------- */

export type Workflow = {
  /** Nombre de archivo en .github/workflows/, sin extensión — coincide con el endpoint de la API de GitHub. */
  archivo: string;
  nombre: string;
  /** Horario en ART, texto humano (no hace falta parsear el cron para mostrarlo). */
  horarioArt: string;
  /** Checks de frescura que este workflow alimenta (puede ser más de uno, ej. ingest-compras). */
  checkNombres: string[];
  /** false = solo workflow_dispatch, sin schedule (dea_probe/pas_probe/backfills). */
  tieneSchedule: boolean;
};

export const REPO_GITHUB = "lautaroronchi97-commits/ROFOAGRO_RESEARCH_WEB";

export const WORKFLOWS: Workflow[] = [
  { archivo: "ingest-noticias", nombre: "Ingesta noticias", horarioArt: "cada hora, minuto :17", checkNombres: ["noticias"], tieneSchedule: true },
  { archivo: "ingest-pizarra", nombre: "Ingesta pizarra (CAC)", horarioArt: "10:30 · 10:45 · 11:00 · 18:00 (L-V)", checkNombres: ["pizarra_historico (CAC)"], tieneSchedule: true },
  { archivo: "ingest-lineup", nombre: "Ingesta line-up de buques (ISA)", horarioArt: "10:00 y 22:00, todos los días", checkNombres: ["lineup (buques ISA)"], tieneSchedule: true },
  { archivo: "ingest-camiones-agroentregas", nombre: "Ingesta camiones (Agroentregas)", horarioArt: "18:00 y 22:00, todos los días", checkNombres: ["camiones_plantas (Agroentregas)"], tieneSchedule: true },
  { archivo: "ingest-bcra-mulc", nombre: "Ingesta compras BCRA (MULC)", horarioArt: "10:00 (L-V)", checkNombres: ["compras_bcra (BCRA MULC)"], tieneSchedule: true },
  { archivo: "ingest-cbot", nombre: "Ingesta cierres CBOT", horarioArt: "19:00 (L-V)", checkNombres: ["cbot_cierres (CBOT)"], tieneSchedule: true },
  { archivo: "ingest-cierres", nombre: "Ingesta cierres granos (CEM)", horarioArt: "20:00 (L-V)", checkNombres: ["futuros_cierres (A3/Matba)"], tieneSchedule: true },
  { archivo: "ingest-compras", nombre: "Ingesta compras de granos (MAGyP)", horarioArt: "lunes y jueves 10:00", checkNombres: ["compras (SIO Granos)", "djve (MAGyP)"], tieneSchedule: true },
  { archivo: "ingest-conab", nombre: "Ingesta estimaciones CONAB", horarioArt: "08:30 (L-V)", checkNombres: ["estimaciones CONAB"], tieneSchedule: true },
  // Este workflow solo corre GEA (BCR) por schedule — DEA y PAS son 100% carga manual (fuentes
  // bloqueadas por IP/Cloudflare, ver CARGAS_MANUALES abajo); dea_probe/pas_probe existen en el
  // mismo YAML pero solo por workflow_dispatch, para reintentar si algún día se destraban.
  { archivo: "ingest-estimaciones-ar", nombre: "Ingesta estimaciones Argentina (BCR-GEA)", horarioArt: "miércoles 22:00", checkNombres: ["estimaciones BCR-GEA"], tieneSchedule: true },
  { archivo: "ingest-usda", nombre: "Ingesta estimaciones USDA", horarioArt: "17:00, días 9 al 13 de cada mes", checkNombres: ["estimaciones USDA"], tieneSchedule: true },
  { archivo: "healthcheck", nombre: "Healthcheck de frescura", horarioArt: "20:45, todos los días", checkNombres: [], tieneSchedule: true },
  { archivo: "chequeo-anomalias", nombre: "Chequeo de anomalías", horarioArt: "20:50, todos los días", checkNombres: [], tieneSchedule: true },
  { archivo: "refresh-calendario", nombre: "Refresh calendario (centinela)", horarioArt: "día 1 de cada mes, 09:00", checkNombres: [], tieneSchedule: true },
  // Dispatch-only: sin schedule, Lautaro (o una sesión) los corre a mano cuando hace falta.
  { archivo: "cargar-camiones-williams", nombre: "Cargar histórico camiones (Williams)", horarioArt: "manual (workflow_dispatch)", checkNombres: [], tieneSchedule: false },
  { archivo: "cargar-compras", nombre: "Cargar histórico compras (Agrochat)", horarioArt: "manual (workflow_dispatch)", checkNombres: [], tieneSchedule: false },
];

/* -------------------------------------------------------------------------------------------- */
/* Cargas manuales — las 7 secciones de /admin/datos + las 2 pantallas de revisión (interpreta-  */
/* ciones, feedback del view) que también son actos manuales recurrentes de Lautaro.             */
/* -------------------------------------------------------------------------------------------- */

export type CargaManual = {
  id: string;
  nombre: string;
  /** Ancla en /admin/datos (id= del bloque) para el link "Cargar →"; null si vive en otra página. */
  href: string;
  cadenciaTexto: string;
};

export const CARGAS_MANUALES: CargaManual[] = [
  { id: "agrochat", nombre: "Comercialización (Agrochat)", href: "/admin/datos#agrochat", cadenciaTexto: "semanal" },
  { id: "camiones", nombre: "Camiones en puerto (Williams)", href: "/admin/datos#camiones", cadenciaTexto: "irregular, sin cadencia fija" },
  { id: "mesa-color", nombre: "Datos del día (color de la rueda)", href: "/admin/datos#mesa-color", cadenciaTexto: "diaria, días hábiles" },
  { id: "bcra-manual", nombre: "Compras BCRA (MULC) — manual", href: "/admin/datos#bcra-manual", cadenciaTexto: "diaria hábil, tapa el rezago de la API" },
  { id: "dea", nombre: "Estimaciones DEA-SAGyP", href: "/admin/datos#dea", cadenciaTexto: "semanal" },
  { id: "pas", nombre: "Estimaciones BCBA-PAS", href: "/admin/datos#pas", cadenciaTexto: "en cada salida del informe (sin fecha fija)" },
  { id: "pas-zonas", nombre: "Estimaciones BCBA-PAS por zona", href: "/admin/datos#pas-zonas", cadenciaTexto: "en cada salida del informe (sin fecha fija)" },
  { id: "lecap", nombre: "Pago final de letras (LECAP)", href: "/admin/datos#lecap", cadenciaTexto: "esporádica (~cada 1-2 meses)" },
  { id: "interpretaciones", nombre: "Revisar interpretaciones", href: "/admin/interpretaciones", cadenciaTexto: "cuando hay un borrador esperando" },
  { id: "view-feedback", nombre: "Calificar el view de mercado", href: "/granos/view", cadenciaTexto: "semanal, tras la Routine del viernes" },
];

/* -------------------------------------------------------------------------------------------- */
/* Routines de Claude Code — no viven en el repo (se crean con create_trigger), documentadas acá */
/* para que el panel sepa qué tabla y qué ventana esperar de cada una.                            */
/* -------------------------------------------------------------------------------------------- */

export type RoutineDef = {
  id: "informe-diario" | "informe-semanal" | "view-mercado";
  nombre: string;
  horarioArt: string;
  /** Día de semana que dispara (0=domingo…6=sábado) — para hallar "la última ventana esperada". */
  diasSemana: number[];
};

export const ROUTINES: RoutineDef[] = [
  { id: "informe-diario", nombre: "Informe diario", horarioArt: "18:30 (L-V)", diasSemana: [1, 2, 3, 4, 5] },
  { id: "informe-semanal", nombre: "Informe semanal", horarioArt: "viernes 19:00", diasSemana: [5] },
  { id: "view-mercado", nombre: "View de mercado", horarioArt: "viernes 09:00", diasSemana: [5] },
];
