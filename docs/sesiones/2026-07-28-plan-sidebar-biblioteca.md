# Sesión 2026-07-28 — Plan biblioteca + menú lateral (C25)

- **Rama:** `claude/sidebar-menu-web-architecture-ychqgb` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** cranear (sin construir) un menú desplegable al costado
  izquierdo — la nav deja la parte superior — con la web reorganizada como "biblioteca": grupos
  genéricos y, adentro, cada reporte disponible para seleccionar. Relevar todas las partes de la
  web y proponer el orden juntos; el build lo corre otra sesión (él cambia el modelo).

## Hecho
- **Relevamiento completo** de las 38 rutas / ~35 reportes reales (qué panel vive en qué página,
  qué ya tiene ruta propia y qué está apilado en páginas compuestas) — tabla en
  `docs/PLAN_SIDEBAR.md` §2.
- **Hallazgo previo al diseño**: las 8 claves de `SECCIONES_META` (`src/lib/auth/config.ts`) no
  son solo navegación — son el **modelo de permisos por sección** (empresa + override del admin).
  Eso convirtió "¿reagrupamos?" en una decisión con costo real, y se le presentó así.
- **4 decisiones estructurales cerradas con Lautaro** por AskUserQuestion (eligió la recomendada
  en las 4 — ver abajo).
- **`docs/PLAN_SIDEBAR.md`** nuevo: decisiones, inventario, árbol final del menú (con cada ruta
  nueva marcada), arquitectura (registro único `src/lib/biblioteca.ts`, cáscaras finas por
  reporte, índices de grupo, layout 2 columnas, permisos heredados por prefijo) y **prompt de
  ejecución autocontenido** en §5.
- **C25 registrado** en el backlog maestro (`auditoria/E7-sintesis.md` §4, sección C).

## Decisiones tomadas (y por qué)
- **Página propia por reporte** (no anclas, no híbrido) — es la "biblioteca" de verdad: URL
  compartible, páginas más livianas (fetchean solo su dato), breadcrumb limpio. Componentes se
  reusan tal cual, cero fórmula tocada.
- **Se mantienen los 8 grupos actuales** — mapean 1:1 con permisos por sección; el menú gana el
  nivel "reporte" sin migrar permisos ni romper URLs (las páginas de grupo quedan como índices).
- **Header mínimo + cinta** — arriba solo logo, cinta, estado de rueda, tema y sesión; toda la
  navegación a la sidebar. La cinta sigue siendo la identidad "pizarra electrónica".
- **Solo-mesa mezclados en su grupo temático con 🔒** (visible solo admins, como el hub de
  `/comercio` hoy) — la señal física queda al lado de la DJVE que la explica.
- **Excepciones deliberadas del árbol**: Informes queda como un feed con anclas (partirlo en 3
  rutas sería código redundante); Gráficos linkea sus 2 modos vía el `?mc=` ya persistido (C10).
- **Sidebar = biblioteca, no acordeón excluyente** (varios grupos abiertos a la vez — pedido
  literal) · drawer en mobile obligatorio en v1 · colapso a riel de íconos = opcional.
- **Modelo del build: Sonnet** (regla de PLAN_BACKLOG: patrón claro → Sonnet) + **cargar
  `ui-ux-pro-max` antes de la UI** (pedido explícito de Lautaro en esta sesión).

## Verificado
- Solo docs, sin código: no aplica lint/build. El relevamiento se hizo leyendo las páginas reales
  (`src/app/(site)/*/page.tsx`, `SECCIONES_META`, `CALCULADORAS`, `graficos-client.tsx` — la
  clave del modo es `mc`, confirmada archivo:línea) — no de memoria.
- Verificado que **no existía prompt previo** para esto en el backlog maestro ni en
  `PLAN_BACKLOG.md` (es pedido nuevo; lo más cercano era el plan UX del 12/07 que definió la nav
  superior de hoy).

## Quedó pendiente / en vuelo
- **Ejecutar el prompt de `PLAN_SIDEBAR.md` §5** en una sesión nueva (Lautaro cambia el modelo).
- La grilla "Explorá el sitio" de la home y el colapso a íconos quedaron explícitos como pulido
  opcional, fuera del v1.

## Trampas descubiertas (para la próxima sesión)
- `seccionDeRuta()` matchea por prefijo → las rutas nuevas heredan el gate de su sección sin
  tocar el proxy, pero hay que VERIFICARLO, no asumirlo.
- `/informes/plantilla/*` las screenshotea la Routine de informes — no tocarles el layout al
  reformar el header/sidebar (viven fuera de `(site)`, no deberían verse afectadas; confirmar).
- Los comentarios con `*/` literal en `globals.css` ya rompieron dev dos veces — ojo al sumar el
  bloque CSS de la sidebar.
