# PLAN — Biblioteca + menú lateral (sidebar)

> **Qué es esto.** Plan cerrado con Lautaro el 28/07/2026 (sesión de craneo, cero código): la web
> deja la nav superior de 8 links y pasa a un **menú desplegable fijo al costado izquierdo**, con la
> web reorganizada como **biblioteca**: grupos desplegables y, adentro de cada grupo, **cada reporte
> con su propio ítem y su propia página**. Registrado como **C25** en el backlog maestro
> ([`auditoria/E7-sintesis.md`](auditoria/E7-sintesis.md) §4). El prompt de ejecución autocontenido
> está en §5. Modelo sugerido para el build: **Sonnet** (patrón claro, regla de PLAN_BACKLOG);
> el juicio de diseño ya está tomado acá.

## 1. Decisiones cerradas (28/07/2026, las 4 por AskUserQuestion)

1. **Página propia por reporte** (biblioteca real). Cada panel de las páginas compuestas pasa a
   tener su ruta (p. ej. `/granos/arbitrajes`, `/dolar/futuro`), reusando el componente existente
   **tal cual** (cero fórmula/dato tocado). La página de grupo (`/granos`, `/dolar`, …) queda como
   **índice** con tarjetas (patrón `hub-grid` que ya usa `/comercio`).
2. **Se mantienen los 8 grupos actuales** (= las 8 claves de `SECCIONES_META`): Granos · Dólar y
   tasas · Comercio exterior · Calculadoras · Gráficos · Producción · Noticias · Informes. Motivo:
   mapean 1:1 con el modelo de permisos por sección (empresa + override) — el menú cambia de lugar
   y gana el nivel "reporte" sin migrar permisos ni romper URLs.
3. **Header mínimo + cinta**: arriba quedan solo logo, cinta de cotizaciones (marquee), estado de
   rueda, toggle de tema y menú de sesión. TODA la navegación vive en la sidebar.
4. **Los reportes solo-mesa van mezclados en su grupo temático** con candado 🔒 visible solo para
   admins (mismo criterio que el hub de `/comercio` hoy). El cliente ni los ve.

Reglas derivadas (parte del pedido literal de Lautaro):
- La sidebar es **biblioteca, no acordeón excluyente**: varios grupos pueden estar abiertos a la
  vez; "quiero que todo esté disponible para una vez seleccionar".
- Desktop: sidebar **fija** (visible siempre); mobile: **drawer** con hamburguesa (la nav no puede
  perderse en mobile). Colapso de la sidebar a riel de íconos en desktop = opcional si sobra
  tiempo, NO requisito de v1.

## 2. Inventario relevado (28/07/2026 — la materia prima de la biblioteca)

| Grupo (clave de sección) | Reportes | Hoy viven en |
|---|---|---|
| Inicio | Novedades del día + El mercado hoy + Próximos informes + Última estimación | `/` (queda igual) |
| `granos` | Arbitrajes · Pases · Mejor para hacer caja · Capacidad de pago · Monitor de mercados · View de mesa 🔒 | todos apilados en `/granos` (+ `/granos/view` ya con ruta) |
| `dolar` | Dólar futuro · Dólar oficial · Dólar linked · Implícitas · Sintéticos · Panel cambiario | todos apilados en `/dolar` |
| `comercio` | DJVE · Camiones · Line-up 🔒 · Empresas 🔒 · Señal física→precio 🔒 · Embarques 🔒 · Calor de mercadería 🔒 · Negociado 🔒 | hub + 7 subpáginas ya existentes; DJVE embebida en el hub |
| `calculadoras` | las 9 calculadoras | ya tienen página propia c/u |
| `graficos` | Campañas · Período | un panel con 2 modos, persistidos en URL (`?mc=`) |
| `produccion` | Calendario de informes · Estimaciones (con La lectura de la mesa) | pestañas dentro de `/produccion` |
| `noticias` | el portal | `/noticias` |
| `informes` | Diario · Semanal · Lecturas de la mesa | un solo feed en `/informes` |
| Admin 🔒 | Pendientes · Usuarios · Empresas · Actividad · Datos · Interpretaciones | `/admin/*` ya con rutas |

## 3. Árbol final del menú (lo que se construye)

```
Inicio                      /
Granos                      /granos (índice)
  ├ Arbitrajes              /granos/arbitrajes        (nuevo)
  ├ Pases                   /granos/pases             (nuevo)
  ├ Mejor para hacer caja   /granos/caja              (nuevo)
  ├ Capacidad de pago       /granos/capacidad         (nuevo)
  ├ Monitor de mercados     /granos/monitor           (nuevo)
  └ View de mesa 🔒         /granos/view              (ya existe)
Dólar y tasas               /dolar (índice)
  ├ Dólar futuro            /dolar/futuro             (nuevo)
  ├ Dólar oficial           /dolar/oficial            (nuevo)
  ├ Dólar linked            /dolar/linked             (nuevo)
  ├ Tasas implícitas        /dolar/implicitas         (nuevo)
  ├ Sintéticos              /dolar/sinteticos         (nuevo)
  └ Panel cambiario         /dolar/cambiario          (nuevo)
Comercio exterior           /comercio (índice, ya lo es)
  ├ DJVE                    /comercio/djve            (nuevo — sale del hub)
  ├ Camiones en puerto      /comercio/camiones        (ya existe)
  ├ Line-up de puertos 🔒   /comercio/puertos         (ya existe)
  ├ Empresas 🔒             /comercio/empresas        (ya existe)
  ├ Señal física→precio 🔒  /comercio/senal           (ya existe)
  ├ Mesa de embarque 🔒     /comercio/embarques       (ya existe)
  ├ Calor de mercadería 🔒  /comercio/temperatura     (ya existe)
  └ Negociado 🔒            /comercio/negociado       (ya existe)
Producción                  /produccion (índice)
  ├ Calendario de informes  /produccion/calendario    (nuevo — hoy pestaña)
  └ Estimaciones            /produccion/estimaciones  (nuevo — hoy pestaña; incluye La lectura de la mesa)
Gráficos                    /graficos
  ├ Campañas                /graficos                 (modo default)
  └ Período                 /graficos?mc=periodo      (modo ya persistido en URL — verificar la clave en graficos-client.tsx)
Calculadoras                /calculadoras (índice, ya lo es)
  └ las 9, desde CALCULADORAS (src/lib/calculadoras.ts), c/u a /calculadoras/[slug]
Informes                    /informes
  ├ Informe diario          /informes#diario          (anclas: es UN feed cronológico,
  ├ Informe semanal         /informes#semanal          partirlo en rutas sería código
  └ Lecturas de la mesa     /informes#lecturas         redundante — excepción deliberada)
Noticias                    /noticias
Admin 🔒                    /admin
  └ Pendientes · Usuarios · Empresas · Actividad · Datos · Interpretaciones (rutas ya existentes)
```

## 4. Arquitectura (cómo, sin sorpresas)

- **Registro único `src/lib/biblioteca.ts`**: la estructura del árbol (grupo → ítems con
  `href`/`label`/`desc`/`soloMesa?`/`ancla?`) como fuente única. La consumen: la sidebar, las
  páginas índice de grupo (tarjetas `hub-grid` generadas del registro — nada duplicado a mano) y
  los breadcrumbs. Los grupos referencian su `SeccionKey` de `SECCIONES_META` (que NO se toca:
  sigue siendo la fuente de permisos).
- **Permisos**: grupo visible ⇔ el usuario tiene su sección (mismo filtro `visibles` que hoy usa
  `NavLinks`); ítems `soloMesa` solo para admins. `seccionDeRuta()` matchea por prefijo → las
  rutas nuevas (`/granos/*`, `/dolar/*`, `/produccion/*`) heredan el gate de su sección sin tocar
  el proxy (verificarlo igual). `/granos/view` conserva su `requireAdmin`.
- **Páginas nuevas = cáscaras finas**: `requireSeccion(clave)` + `PageHead` + el componente
  existente, con `metadata` y el `revalidate` que su dato necesita (30 en granos vivos, 60 en
  dólar, 3600 donde era 3600 — copiar de la página compuesta actual). Al partir, cada página
  fetchea SOLO su dato → más rápidas que las compuestas de hoy.
- **Índices de grupo**: `/granos`, `/dolar`, `/produccion` pasan a índice con tarjetas (patrón de
  `/comercio`); `/comercio` suma la tarjeta DJVE (su `DjvePanel` se muda a `/comercio/djve`).
  Las URLs de sección no cambian → bookmarks y links internos existentes siguen vivos.
- **Layout**: `(site)/layout.tsx` pasa a dos columnas (sidebar + contenido). `SiteHeader` pierde
  `NavLinks` y queda mínimo (logo · cinta · estado de rueda · tema · sesión). La sidebar es un
  client component nuevo (`src/components/sidebar.tsx`): estado abierto/cerrado por grupo
  (localStorage), grupo de la ruta activa auto-expandido, `aria-current` en el ítem activo,
  `aria-expanded` en los grupos, drawer mobile con foco atrapado, motion gated en
  `prefers-reduced-motion`. `NavLinks` muere con la nav superior (borrarlo si queda sin
  importadores).
- **Estética**: sistema vigente ("Fundación" + tokens premium): hairlines, oro solo acento,
  números SIEMPRE en mono. **Cargar la skill `ui-ux-pro-max` ANTES de diseñar la sidebar**
  (pedido explícito de Lautaro) y `frontend-design` como apoyo.
- **Lo que NO se toca**: fórmulas, libs de datos, permisos (`SECCIONES_META`), `/admin/*`,
  `/bienvenida`, `(auth)`, plantillas de informes (`/informes/plantilla/*` — las screenshotea la
  Routine, cuidado con moverles el layout), proxy (salvo verificación).

## 5. PROMPT DE EJECUCIÓN (autocontenido — pegar en una sesión nueva)

> Leé `docs/ESTADO.md` y la última entrada de `docs/sesiones/`. Trabajá en una rama `claude/*`
> desde `main`, un PR base `main`, draft hasta verificar. Ejecutá **C25 — Biblioteca + menú
> lateral** siguiendo `docs/PLAN_SIDEBAR.md` (decisiones YA cerradas con Lautaro: NO re-preguntar
> granularidad/agrupación/header/candados; cualquier duda NUEVA sí se consulta).
>
> **Antes de escribir una línea de UI**: cargá la skill `ui-ux-pro-max` (pedido explícito de
> Lautaro) y repasá `frontend-design`; el design system vigente (tokens de `globals.css`,
> tipografía "Fundación", oro solo acento, números en mono) manda sobre cualquier default de la
> skill. Leé también la guía de Next en `node_modules/next/dist/docs/` que aplique (breaking
> changes; el middleware acá se llama `src/proxy.ts`).
>
> **Orden sugerido de obra:**
> 1. `src/lib/biblioteca.ts` (registro único del árbol de §3) + rutas nuevas de `/granos/*` y
>    `/dolar/*` (cáscaras finas: `requireSeccion` + `PageHead` + componente existente + metadata +
>    `revalidate` copiado de la página compuesta). Después `/comercio/djve` y
>    `/produccion/{calendario,estimaciones}` (reemplazan las pestañas de `ProduccionTabs`).
> 2. Índices de grupo: `/granos`, `/dolar`, `/produccion` a tarjetas generadas del registro;
>    `/comercio` suma DJVE como tarjeta. Revisar links internos que apuntaban a paneles embebidos
>    (hero de la home "Arbitrajes y pases →", `ng-admin-link` de granos, etc.).
> 3. `src/components/sidebar.tsx` + layout de dos columnas + `SiteHeader` mínimo + drawer mobile
>    (reemplaza el colapso H2 del header). Breadcrumbs alimentados del registro. Borrar
>    `nav-links.tsx` si queda muerto.
> 4. CSS en `globals.css` con los tokens existentes (bloque nuevo de sidebar; cuidado con los
>    comentarios `*/` literales — ya rompió dev dos veces).
>
> **Guardas duras:** cero cambios de fórmula/dato/permiso; `SECCIONES_META` intacta;
> `AUTH_ENFORCED` apagado en local = web pública idéntica salvo la navegación; verificar que
> `seccionDeRuta()` cubre las rutas nuevas por prefijo; `/informes/plantilla/*` sin tocar.
> Los ítems 🔒 se filtran igual que el hub de `/comercio` hoy (admins).
>
> **Verificación (protocolo + `verification-before-completion`):** `npm run lint` + `npx tsc
> --noEmit` + tests + `npm run build`; Playwright con datos reales, claro/oscuro,
> desktop 1280 + mobile 390: sidebar (expandir/colapsar grupos, ítem activo, drawer mobile, sin
> scroll horizontal), CADA ruta nueva renderizando su panel con números 1:1 contra la página
> compuesta vieja (misma regeneración), índices, breadcrumbs, cero errores de consola. Páginas
> gateadas: bypass temporal revertido antes de cerrar (`git diff` limpio). Al cerrar: doc de
> sesión + actualizar «Ahora» de `ESTADO.md` + tachar C25 en el backlog maestro.

## 6. Riesgos conocidos (mirarlos al ejecutar)

- **Playwright/ISR**: las páginas vivas de granos usan poll de 30 s (`RefreshOnFocus` vive en el
  layout compartido — sigue cubriendo a las subpáginas, confirmar).
- **`ProduccionTabs`**: al partir en dos rutas, la pestaña deja de existir — revisar si alguna URL
  con query/estado de pestaña quedó linkeada en informes o docs.
- **Home**: la grilla "Explorá el sitio" puede quedar igual (linkea a los índices); pulirla es
  opcional, no alcance de v1.
- **Sitemap/noindex**: heredar el criterio actual (páginas de mesa con noindex propio).
