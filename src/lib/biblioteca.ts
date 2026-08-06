import { CALCULADORAS } from "@/lib/calculadoras";
import { SECCIONES_META, type SeccionKey } from "@/lib/auth/config";

/**
 * Registro único del árbol de la biblioteca (C25, docs/PLAN_SIDEBAR.md §3-4). Fuente
 * de verdad para la sidebar, los índices de grupo (hub-grid) y los breadcrumbs — nada
 * de esto se duplica a mano en cada componente. Los grupos son 1:1 con las claves de
 * `SECCIONES_META` (que sigue siendo la fuente de permisos, acá NO se toca ni se
 * reordena): reagrupar tendría costo real en el modelo de permisos por sección.
 *
 * `soloMesa` marca los reportes internos de mesa (mismo criterio que el hub de
 * `/comercio` hoy: visibles siempre en la lista con un candado 🔒, la protección real
 * la hace cada página con `requireAdmin()`/su propio filtro — no hay nada nuevo que
 * ocultar acá, es la misma convención que ya usa `/granos` con "View de mesa").
 */
export type BibItem = {
  href: string;
  label: string;
  desc: string;
  soloMesa?: boolean;
};

export type BibGrupo = {
  key: SeccionKey;
  label: string;
  href: string;
  items: BibItem[];
};

const GRANOS: BibItem[] = [
  { href: "/granos/arbitrajes", label: "Arbitrajes", desc: "Futuro vs. pizarra: spread, tasa directa y TNA, con la 1ª columna en vivo en rueda." },
  { href: "/granos/pases", label: "Pases", desc: "Spread entre posiciones del mismo grano, tasa directa y TNA." },
  { href: "/granos/caja", label: "Mejor para hacer caja", desc: "Ranking de la menor tasa implícita disponible por grano." },
  { href: "/granos/capacidad", label: "Capacidad de pago", desc: "FAS teórico de BCR, el modelo propio y la pizarra, lado a lado." },
  { href: "/granos/monitor", label: "Monitor de mercados", desc: "Chicago (soja, maíz, trigo) y referencias macro en USD/tn." },
  { href: "/granos/view", label: "View de mesa", desc: "Research direccional semanal por grano: dirección, argumentos e invalidadores.", soloMesa: true },
];

const DOLAR: BibItem[] = [
  { href: "/dolar/futuro", label: "Dólar futuro", desc: "Curva de futuros MAE con TNA, TEA y TEM." },
  { href: "/dolar/oficial", label: "Dólar oficial", desc: "Mayorista A3500 y su variación semanal." },
  { href: "/dolar/linked", label: "Dólar linked", desc: "Tipo de cambio implícito y spread contra el oficial." },
  { href: "/dolar/implicitas", label: "Tasas implícitas", desc: "Futuro y linked combinados, por plazo." },
  { href: "/dolar/sinteticos", label: "Sintéticos", desc: "LECAPs sintéticas vs. futuro directo, con TIR." },
  { href: "/dolar/cambiario", label: "Panel cambiario", desc: "Volumen MAE y compras netas del BCRA (MULC)." },
];

const COMERCIO: BibItem[] = [
  { href: "/comercio/djve", label: "DJVE", desc: "Declaraciones juradas de venta al exterior, por producto." },
  { href: "/comercio/camiones", label: "Camiones en puerto", desc: "Entrada diaria por zona y producto (Williams Entregas)." },
  { href: "/comercio/puertos", label: "Line-up de puertos", desc: "Foto operativa de buques: qué cambió vs. la rueda anterior.", soloMesa: true },
  { href: "/comercio/empresas", label: "Empresas exportadoras", desc: "Cobertura DJVE vs. line-up por empresa, avance y ritmo.", soloMesa: true },
  { href: "/comercio/senal", label: "Señal física → precio", desc: "Cruce de la demanda física con la capacidad de pago.", soloMesa: true },
  { href: "/comercio/embarques", label: "Mesa de embarque", desc: "Programa DJVE por mes y producto, en idioma A3.", soloMesa: true },
  { href: "/comercio/temperatura", label: "Calor de mercadería", desc: "Índice MESA: qué grano diferir y cuál vender ya.", soloMesa: true },
  { href: "/comercio/negociado", label: "Negociado por producto", desc: "Volumen SIO Granos: % sobre cosecha y % priceado.", soloMesa: true },
];

const CALCULADORAS_ITEMS: BibItem[] = CALCULADORAS.map((c) => ({
  href: `/calculadoras/${c.slug}`,
  label: c.nombre,
  desc: c.desc,
  // Costos queda oculta hasta cerrar el tarifario con la empresa (relevamiento web
  // 29/07, punto 44, respuesta §5.6) — mismo criterio soloMesa que ya oculta las
  // páginas internas de /comercio a no-admins.
  soloMesa: c.slug === "costos",
}));

const GRAFICOS: BibItem[] = [
  { href: "/graficos", label: "Campañas", desc: "Spreads entre cosechas, con los años superpuestos al vencimiento." },
  { href: "/graficos?mc=periodo", label: "Período", desc: "Base contra varias posiciones, en el eje calendario." },
];

const PRODUCCION: BibItem[] = [
  { href: "/produccion/calendario", label: "Calendario de informes", desc: "Cuándo publica cada organismo (USDA, CONAB, BCR, BCBA, SAGyP)." },
  { href: "/produccion/estimaciones", label: "Estimaciones", desc: "Producción por país y grano, con la lectura de la mesa." },
  { href: "/produccion/zonas", label: "Producción por zona", desc: "BCBA-PAS por zona agroecológica: foto de campaña y evolución de participación.", soloMesa: true },
  { href: "/produccion/condicion", label: "Condición de cultivos", desc: "BCBA-PAS semanal: condición de cultivo, condición hídrica y fenología por campaña.", soloMesa: true },
];

// "Informes" queda como un feed cronológico con anclas (decisión del plan): partirlo en
// 3 rutas sería código redundante. Los anchors matchean los `id` reales de cada Panel
// en src/app/(site)/informes/page.tsx.
const INFORMES: BibItem[] = [
  { href: "/informes#informe-diario", label: "Informe diario", desc: "Research del día, post-cierre." },
  { href: "/informes#informe-semanal", label: "Informe semanal", desc: "La semana en números, los viernes." },
  { href: "/informes#lectura-mesa", label: "Lecturas de la mesa", desc: "Interpretación de los informes de organismos." },
];

// C31 (docs/PLAN_OPERACIONES_CLIENTES.md §4.5): sección de clientes, sin
// `soloMesa` — se habilita empresa por empresa desde /admin/empresas. Posición
// diaria/acumulada separadas en dos páginas (mejora post-C31, vuelta 4,
// 06/08/2026 — "así como existe posición diaria, para llevarlo por separado").
// Evolución pasó a `soloMesa` la misma vuelta ("no es útil para los clientes
// por ahora, no te digo de eliminarlo"): sigue en el repo, solo la ve la mesa.
const OPERACIONES: BibItem[] = [
  { href: "/operaciones", label: "Posición diaria", desc: "Movimientos del día sobre la posición inicial acumulada." },
  { href: "/operaciones/acumulada", label: "Posición acumulada", desc: "Posición neta comprado/vendido por producto y período de entrega, desde la primera operación." },
  { href: "/operaciones/registro", label: "Registro diario", desc: "Cargá tus compras y ventas del día." },
  { href: "/operaciones/evolucion", label: "Evolución", desc: "Curva de la posición física acumulada en el tiempo, por producto.", soloMesa: true },
];

const ITEMS_POR_SECCION: Record<SeccionKey, BibItem[]> = {
  granos: GRANOS,
  dolar: DOLAR,
  comercio: COMERCIO,
  calculadoras: CALCULADORAS_ITEMS,
  graficos: GRAFICOS,
  produccion: PRODUCCION,
  noticias: [],
  informes: INFORMES,
  operaciones: OPERACIONES,
};

/** Los 9 grupos de la biblioteca, en el orden de `SECCIONES_META` (fuente de permisos). */
export const BIBLIOTECA: BibGrupo[] = SECCIONES_META.map((s) => ({
  key: s.key,
  label: s.label,
  href: s.href,
  items: ITEMS_POR_SECCION[s.key],
}));

/**
 * Ítems de un grupo que se pueden habilitar/deshabilitar por separado desde
 * `/admin/empresas` (permisos por ítem, 06/08/2026): dedupeados por pathname —
 * dos ítems que comparten ruta (los 2 modos de Gráficos `/graficos`/`/graficos
 * ?mc=periodo`, las 3 anclas de Informes) no se pueden gatear aparte en el
 * servidor, solo cuentan una vez — y sin los `soloMesa` (esos nunca dependen de
 * la empresa: siempre `requireAdmin()`, jamás aparecen en un whitelist de cliente).
 */
export function itemsConfigurables(g: BibGrupo): { href: string; label: string }[] {
  const vistos = new Set<string>();
  const out: { href: string; label: string }[] = [];
  for (const it of g.items) {
    if (it.soloMesa) continue;
    // split por "?" y "#": las anclas de Informes (`/informes#informe-diario`) son la
    // misma ruta que las query strings de Gráficos (`/graficos?mc=periodo`) a estos fines.
    const path = it.href.split(/[?#]/)[0]!;
    if (vistos.has(path)) continue;
    vistos.add(path);
    out.push({ href: path, label: it.label });
  }
  return out;
}

export type GrupoPermiso = { key: SeccionKey; label: string; items: { href: string; label: string }[] };

/** Árbol de permisos para el panel admin (empresas + override individual): un grupo por
 *  sección con sus ítems configurables ya resueltos — nada se recalcula a mano ahí. */
export const BIBLIOTECA_PERMISOS: GrupoPermiso[] = BIBLIOTECA.map((g) => ({
  key: g.key,
  label: g.label,
  items: itemsConfigurables(g),
}));

/**
 * Grupo "Admin" — no es una sección con permisos (`SECCIONES_META` no lo incluye): es
 * el panel `/admin/*`, siempre protegido por `requireAdmin()` con su propio layout y
 * nav (`admin-tabs.tsx`). Estos ítems solo alimentan el atajo de navegación de la
 * sidebar del sitio público — rutas ya existentes, ninguna se crea acá.
 */
export const BIBLIOTECA_ADMIN = {
  key: "admin",
  label: "Admin",
  href: "/admin",
  items: [
    { href: "/admin", label: "Pendientes", desc: "Cuentas nuevas esperando aprobación." },
    { href: "/admin/usuarios", label: "Usuarios", desc: "Bloquear, cambiar empresa, promover a admin." },
    { href: "/admin/empresas", label: "Empresas", desc: "Alta y permisos por sección." },
    { href: "/admin/actividad", label: "Actividad", desc: "Historial de accesos por usuario y empresa." },
    { href: "/admin/datos", label: "Datos", desc: "Cargas manuales: DEA, PAS, camiones, LECAPs y más." },
    { href: "/admin/interpretaciones", label: "Interpretaciones", desc: "Borradores de la lectura de la mesa." },
    { href: "/admin/conexiones", label: "Conexiones", desc: "Crons, Routines y cargas manuales: qué corrió y qué falta." },
  ] as BibItem[],
};

/**
 * Etiqueta de una ruta exacta (sin query string) — usado por los breadcrumbs. El
 * grupo (o Admin) SIEMPRE gana su propio href: Gráficos tiene 2 ítems (Campañas
 * `/graficos`, Período `/graficos?mc=periodo`) que comparten el mismo pathname que
 * el grupo — sin este guard, el último en recorrerse pisaba la etiqueta del grupo
 * (mismo caso con "Pendientes" de Admin, href también `/admin`).
 */
const HREF_LABEL = new Map<string, string>();
for (const g of BIBLIOTECA) {
  HREF_LABEL.set(g.href, g.label);
  for (const it of g.items) {
    const path = it.href.split("?")[0]!;
    if (path !== g.href) HREF_LABEL.set(path, it.label);
  }
}
HREF_LABEL.set(BIBLIOTECA_ADMIN.href, BIBLIOTECA_ADMIN.label);
for (const it of BIBLIOTECA_ADMIN.items) {
  if (it.href !== BIBLIOTECA_ADMIN.href) HREF_LABEL.set(it.href, it.label);
}

export function labelDeHref(href: string): string | undefined {
  return HREF_LABEL.get(href);
}
