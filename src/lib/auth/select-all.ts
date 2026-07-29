/**
 * select-all.ts — pagina un SELECT del cliente SSR autenticado (`createSupabaseServerClient`)
 * más allá de las 1.000 filas que PostgREST corta por default (`db-max-rows`).
 *
 * Mismo límite que ya resuelve `sbSelectAll` en `supabase.ts` (Fase 0 del plan de gráficos de
 * spreads, 11/07/2026) — pero ESE helper pega con `fetch` crudo usando la anon/service key, sin
 * sesión de usuario. No sirve para tablas con RLS interna mesa (`authenticated`+`is_admin()`,
 * ej. `pas_zonas`/`pas_condicion`): esas necesitan el cliente del SDK con la cookie de sesión del
 * admin. Bug real encontrado 29/07/2026: `getPasZonas`/`getPasCondicion` hacían un `.select()`
 * sin `.range()` — con 1.837/1.872 filas (ambas > 1.000), PostgREST devolvía las primeras 1.000
 * (ordenadas por campaña) y cortaba en silencio (sin 206 porque el SDK no chequea ese código como
 * error) — el panel mostraba solo hasta la campaña donde caía el corte, sin avisar.
 *
 * `.range(from, to)` fuerza el header `Range` de PostgREST (200 + `Content-Range`, no trunca
 * silencioso). El orden pasado a `query` DEBE ser determinístico (todas las columnas de la PK o
 * un prefijo único) — con un orden ambiguo, dos páginas consecutivas pueden repetir o saltear
 * filas si Postgres reordena empates entre requests.
 */

const PAGE = 1000;

export async function selectAllPaginado<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ filas: T[]; error: string | null }> {
  const filas: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await query(offset, offset + PAGE - 1);
    if (error) return { filas, error: error.message };
    const pagina = data ?? [];
    filas.push(...pagina);
    if (pagina.length < PAGE) break;
    offset += PAGE;
    if (offset > 200_000) break; // backstop anti-loop, mismo criterio que sbSelectAll
  }
  return { filas, error: null };
}
