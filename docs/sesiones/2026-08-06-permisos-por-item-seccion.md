# Sesión 2026-08-06 — Permisos por ítem dentro de cada sección

- **Rama:** `claude/client-section-visibility-7a7ukb` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** hoy `/admin/empresas` solo permite prender/apagar una
  sección ENTERA (ej. "Calculadoras") para cada empresa cliente. Pidió poder indicar,
  dentro de cada sección, qué se puede ver y qué no — ej. no mostrarle todas las
  calculadoras a una empresa — habilitando la sección completa O solo una parte.

## Hecho
- **Migración `20260806120000_permisos_items_por_seccion.sql`** (escrita, SIN aplicar —
  protocolo de siempre): `empresas.items` y `profiles.items_override` (jsonb,
  `{ [seccionKey]: string[] de hrefs }` — clave de sección ausente = sin restricción,
  todos sus ítems visibles; comportamiento IDÉNTICO al de hoy para toda empresa
  existente, cero migración de datos necesaria) · guard anti-escalada
  (`protect_profile_fields()`) suma `items_override` a los campos que un no-admin no
  puede tocarse a sí mismo · `admin_usuarios()`/`admin_empresas()` (RPC de
  `20260716180000_auth_admin_panel.sql`) recreadas con los 2 campos nuevos.
- **`src/lib/auth/permisos.ts`** (lib PURA, sin `server-only`, con 12 tests): `itemPermitido()`
  (admin ve todo · sección no visible = nada de ella · sin restricción explícita = todos
  los ítems · con restricción = solo el whitelist) y `normalizarItems()` (arma el mapa a
  guardar desde lo tildado en el form — tildar TODOS los ítems de una sección = sin
  restricción, se omite la clave; solo un subconjunto estricto queda explícito; secciones
  con ≤1 ítem configurable —Gráficos, Informes, Noticias— nunca se restringen, el árbol
  del admin no les muestra sub-checkboxes).
- **`src/lib/biblioteca.ts`** suma `itemsConfigurables(grupo)` (dedupea por pathname —
  dos ítems que comparten ruta, como los 2 modos de Gráficos o las 3 anclas de Informes,
  no se pueden gatear aparte en el servidor — y excluye los `soloMesa`, que nunca
  dependen de la empresa) y `BIBLIOTECA_PERMISOS` (los 9 grupos ya resueltos para el panel
  admin). 9 tests nuevos.
- **`src/lib/auth/dal.ts`**: `Acceso.items` + `Perfil.items_override` · `getAcceso()`
  resuelve `items` con el mismo criterio de par que `visibles` (override si
  `secciones_override` no es null, si no los de la empresa) · `itemVisible(acceso,
  seccion, href)` nueva (para filtrar listas: hub-grid, sidebar) · `requireSeccion(seccion,
  item?)` ahora acepta un 2º parámetro opcional (el href sin query/hash) y redirige a
  `/sin-acceso` si el ítem puntual está fuera del whitelist.
- **26 páginas de sección** pasan su propio href a `requireSeccion` (granos ×5, dólar ×6,
  comercio/djve+camiones, producción ×2, operaciones ×2, `calculadoras/[slug]` con el slug
  dinámico) · los 5 índices de grupo (`/granos`, `/dolar`, `/comercio`, `/produccion`,
  `/calculadoras`) filtran su hub-grid con `itemVisible` · `(site)/layout.tsx` filtra los
  ítems de la sidebar con el mismo criterio (los `soloMesa` siguen su filtro de siempre por
  `esAdmin`, sin tocar).
- **Panel admin**: componente nuevo `admin/permisos-tree.tsx` (`PermisosTree`, client,
  controlado) — un checkbox por sección (`name="secciones"`, igual que antes) que, si
  tiene ≥2 ítems configurables, despliega sub-checkboxes (`name="items__<seccionKey>"`);
  tildar todos los ítems de una sección al desmarcarla no pierde el estado (queda en
  memoria, deshabilitado, por si se reactiva). Reemplaza el fieldset plano en
  `empresa-crear.tsx`/`empresa-editor.tsx` (`/admin/empresas`) y en el override individual
  de `usuario-row.tsx` (`/admin/usuarios`) — mismo componente, 3 usos. `admin/actions.ts`
  (`crearEmpresa`/`guardarEmpresa`/`guardarOverride`) arma `items`/`items_override` con
  `normalizarItems()` antes de escribir.
- CSS nuevo (`.admin-permisos`/`.admin-permiso-grupo`/`.admin-permiso-items`/
  `.admin-check-sub`) para el árbol anidado, reusando los tokens/clases que ya existían.

## Decisiones tomadas (y por qué)
- **Whitelist explícita, clave ausente = sin restricción** (no al revés, "blacklist de
  ocultos") — así el default para toda empresa/usuario existente (columna nueva en
  `'{}'::jsonb`) es EXACTAMENTE el comportamiento de hoy, sin tocar una fila.
- **Tildar todos los ítems = se omite la clave** (no se guarda un array con todo
  adentro): más liviano y evita que una sección "sin querer restringida" quede fosilizada
  — si mañana se agrega una calculadora nueva, una empresa sin restricción la ve sola; una
  con un subconjunto explícito NO la ve hasta que el admin la tilde a mano (mismo criterio
  de opt-in que ya rige `secciones` con secciones nuevas).
- **`soloMesa` queda 100% fuera de este sistema**: nunca aparece en el árbol de permisos
  del admin (no tiene sentido ofrecer a una empresa activar algo que solo ve Lautoro/Mauro
  vía `requireAdmin()`), y el filtro por empresa nunca lo oculta ni lo muestra — sigue
  gateado como siempre.
- **Gráficos/Informes sin sub-checkboxes**: sus "ítems" (Campañas/Período, las 3 anclas de
  Informes) comparten el mismo pathname — no hay forma de gatearlos aparte en el server
  sin inventar un mecanismo nuevo (query param/hash), así que quedan como sección
  todo-o-nada, igual que hoy.
- **`normalizarItems` corta en ≤1 ítem, no en 0**: si se cortara solo en 0, una sección de
  1 ítem real (Gráficos) guardaría "0 de 1 tildado" cada vez que se guarda el form (porque
  el árbol nunca le muestra checkbox), dejándola sin ítems por accidente — encontrado
  escribiendo el test, antes de que llegara a pisar datos reales.

## Verificado
- `npm run lint` / `npx tsc --noEmit` / `npx vitest run` (**576/576**, 21 nuevos:
  `permisos.test.ts` + `biblioteca.test.ts`) / `npm run build` — los 4 en verde.
- **Build comparado con el comportamiento de siempre**: con `AUTH_ENFORCED` apagado (el
  estado real de producción hoy) todas las rutas de sección siguen listadas `○` (estática)
  con el mismo `revalidate` que antes (`/granos/arbitrajes 30s`, `/calculadoras/[slug] 1m`,
  `/dolar/futuro 1m`, etc.) — el requisito duro de "con el flag apagado, cero cambios de
  render" se sostiene.
- **Sin verificar con sesión real** (este sandbox no tiene credenciales de Supabase ni
  `AUTH_ENFORCED=true`): el flujo completo login→empresa restringida→página bloqueada no
  se probó en navegador. La lógica de permisos en sí (`itemPermitido`/`normalizarItems`)
  está cubierta por tests unitarios exhaustivos (bordes: admin, sección apagada, sin
  restricción, restricción vacía, ≤1 ítem); el resto es wiring mecánico (mismo patrón que
  ya usa `soloMesa`/`esAdmin` en cada página, revisado archivo por archivo).

## Quedó pendiente / en vuelo
- **Aplicar la migración por MCP** con el OK de Lautaro (protocolo de siempre — nunca se
  aplica desde acá sin su confirmación explícita).
- Primera verificación real en navegador con `AUTH_ENFORCED=true` y una empresa con
  restricciones de ítem de verdad (ej. tildar solo 3 calculadoras y confirmar que las
  otras 6 dan `/sin-acceso` y no aparecen en la sidebar/índice).
- El árbol de permisos no tiene un botón "marcar todos"/"desmarcar todos" por sección —
  hay que tildar/destildar uno por uno. Si con más secciones (Comercio creciera, etc.)
  resulta tedioso, es un follow-up chico sobre el mismo componente.

## Trampas descubiertas (para la próxima sesión)
- Los ítems de Informes usan anclas (`/informes#informe-diario`) y los de Gráficos, query
  string (`/graficos?mc=periodo`) — el dedup de `itemsConfigurables` tiene que partir por
  `/[?#]/`, no solo por `"?"` (el primer intento solo cortaba en `?` y dejaba las 3 anclas
  de Informes como 3 ítems "distintos"; el test lo agarró antes de tocar código real).
