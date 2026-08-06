/**
 * Lógica PURA de permisos por ítem dentro de una sección (pedido de Lautaro
 * 06/08/2026: además de habilitar/deshabilitar una sección entera — ej.
 * "Calculadoras" — poder elegir qué ítems concretos de esa sección ve una
 * empresa/usuario — ej. solo 3 de las 9 calculadoras).
 *
 * Separado a propósito de `dal.ts` (que es `server-only`, lee cookies/Supabase)
 * y de `admin/actions.ts` (`"use server"`) para que esta pieza sea testeable sin
 * mockear sesión ni FormData — mismo criterio que el resto del repo ("libs puras
 * con tests" — ver docs/CONTEXTO.md).
 *
 * Modelo de datos (columnas `empresas.items` / `profiles.items_override`, jsonb):
 * `{ [seccionKey]: string[] de hrefs }`. Una clave de sección AUSENTE del objeto
 * significa "sin restricción" (todos los ítems visibles, el comportamiento de
 * siempre) — solo una clave PRESENTE acota a ese subconjunto explícito.
 */

/** Un ítem configurable de una sección (dedupeado por ruta — ver biblioteca.ts). */
export type ItemConfigurable = { href: string };

/** Grupo mínimo que necesita esta lógica (subconjunto de `GrupoPermiso` de biblioteca.ts). */
export type GrupoConfigurable = { key: string; items: readonly ItemConfigurable[] };

/** Mapa de restricciones por sección, tal cual se guarda en `items`/`items_override`. */
export type ItemsPorSeccion = Record<string, string[]>;

/**
 * ¿Un ítem puntual (href) es visible? Reglas, en orden:
 *  1. Admin ve todo, siempre.
 *  2. Si la sección no está entre las visibles, nada de ella es visible.
 *  3. Sin restricción explícita para esa sección → todos sus ítems son visibles.
 *  4. Con restricción → solo si el href está en la lista.
 */
export function itemPermitido(
  esAdmin: boolean,
  seccionVisible: boolean,
  restringidos: string[] | undefined,
  href: string
): boolean {
  if (esAdmin) return true;
  if (!seccionVisible) return false;
  if (!restringidos) return true;
  return restringidos.includes(href);
}

/**
 * A partir de lo tildado en el form (por sección), arma el mapa `items` a
 * guardar. Tildar TODOS los ítems configurables de una sección equivale a NO
 * restringir nada (se omite la clave — mismo estado que una empresa vieja que
 * nunca tocó esto); solo un subconjunto estricto queda explícito. Las secciones
 * que no quedaron activas se ignoran (aunque el form traiga checkboxes de una
 * sección apagada — no deberían llegar deshabilitados, pero por las dudas).
 *
 * Secciones con ≤1 ítem configurable (Gráficos, Informes, Noticias — dos ítems
 * que comparten ruta cuentan como 1, ver `itemsConfigurables`) NUNCA se
 * restringen acá: el árbol de permisos del admin no les muestra sub-checkboxes
 * (nada que gatear aparte del todo/nada de la sección), así que tratarlas
 * igual que las demás guardaría "0 de 1 tildado" y las dejaría sin ítems por
 * accidente cada vez que se guarda el form.
 */
export function normalizarItems(
  grupos: readonly GrupoConfigurable[],
  seccionesActivas: readonly string[],
  marcadosPorSeccion: (seccionKey: string) => string[]
): ItemsPorSeccion {
  const activas = new Set(seccionesActivas);
  const out: ItemsPorSeccion = {};
  for (const g of grupos) {
    if (!activas.has(g.key) || g.items.length <= 1) continue;
    const validos = new Set(g.items.map((it) => it.href));
    const marcados = Array.from(new Set(marcadosPorSeccion(g.key).filter((h) => validos.has(h))));
    if (marcados.length < g.items.length) out[g.key] = marcados;
  }
  return out;
}
