# Sesión 2026-07-29 — Plan del relevamiento web de Lautaro (56 puntos)

- **Rama:** `claude/website-changes-review-ttqsq4` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** subió el docx "RELEVAMIENTO DE LA WEB" (56 puntos + 73
  capturas, relevado a mano por él) y pidió: elaborar los pasos para implementar TODOS los
  cambios, juntar las decisiones/preguntas al final, y registrar en el backlog lo que aún no pudo
  ver (páginas de mesa + /admin).

## Hecho

- **Extracción e interpretación completa del docx**: texto de los 56 puntos + mapeo de cada una
  de las 73 capturas a su punto (varias eran la única forma de saber a qué se refería un
  "eliminalo" o "destacar esto" — p. ej. el punto 13 resultó ser el badge "V0 · datos de cierre"
  del footer, el 14 la marca de agua de login con su email, el 56 las páginas de mesa sin
  relevar).
- **Exploración del código en paralelo (3 agentes)**: cada punto quedó anclado a archivo:línea
  real (landing/shell/home/cinta · granos/dólar · calculadoras/gráficos/producción/comercio).
- **Entregable: [`PLAN_RELEVAMIENTO_WEB.md`](../PLAN_RELEVAMIENTO_WEB.md)** (mismo formato que
  `PLAN_SIDEBAR`/`PLAN_PAS_ZONAS`): §2 los 56 puntos interpretados y mapeados · §3 **10 lotes
  R1–R10 con prompt autocontenido cada uno** (un PR por lote, orden sugerido
  R1→R3→R4→R6→R2→R5→R7→R8→R9→R10) · §4 respuestas directas (3 cosas que preguntó ya tienen
  respuesta sin código) · §5 las **10 preguntas juntas al final**, como pidió · §6 backlog.
- **Backlog maestro**: registrado **C28** en `auditoria/E7-sintesis.md` §4 con los ítems
  derivados (mail de la empresa, tanda 2 del relevamiento, zonas, aviso DL opcional).

## Decisiones tomadas (y por qué)

- **Sesión de solo docs, cero código** — 56 puntos tocan ~60 archivos en 10 áreas distintas; el
  protocolo del repo (plan → prompts → builds con un PR por sesión) es exactamente para esto.
- **Lotes por área y no por tipo de cambio** — cada lote deja una página/sección terminada y
  verificable con Playwright, en vez de "todos los strings" / "todos los CSS" transversales.
- **Los dos rediseños grandes (camiones R9, puertos R10) van al final y con maqueta previa** —
  Lautaro lo pidió explícito para puertos ("si tenés dudas me preguntás, fuimos y vinimos mucho").
- **Donde "dio letra" (landing), el copy se redacta con `voz-lautaro`** — él mismo aclaró "no
  escribas tal cual".
- **Sintéticos NO se toca sin ejemplo numérico del Excel** (pregunta 3) — regla dura del repo
  para fórmulas; él mismo ofreció re-chequearla.

## Verificado

- Los 56 puntos tienen destino: lote (1–50, 52–55), backlog (51, 56) o respuesta directa (partes
  de 16, 33, 48). Checklist cruzado a mano al cerrar el plan.
- Hallazgos de exploración que cambian el trabajo estimado (documentados en el plan):
  `rofoagro-logo-marca.svg` es una copia idéntica del logo con ~20 fills casi-blancos → el punto
  46 se arregla limpiando UN svg, sin tocar componentes; la pizarra en pesos (`pizarraArs`) y el
  TC BNA de CAC (`tcBna`) ya se parsean y están sin usar → los puntos 25/40 tienen el dato
  servido; "(vía BCR)" vive en DOS lugares espejo (ingesta + fallback vivo) y además en filas ya
  guardadas de `noticias` → el punto 15 incluye un UPDATE de datos; el grupo Admin de la sidebar
  YA es solo-admin (16b sin cambio); la detección de dólar linked YA es dinámica (33 sin cambio).
- Docs-only: sin lint/build de código que correr.

## Quedó pendiente / en vuelo

- **Lautaro contesta las 10 preguntas de §5 del plan** — varias gatean lotes: la fórmula de
  sintéticos con ejemplo del Excel (gatea parte de R6), el −9 del BNA (R3/R4), watermark y cinta
  (R1), posiciones ambiguas (R1/R4).
- **Ejecutar los lotes** R1→R10 (prompts en §3 del plan), cada uno en sesión nueva.
- Backlog: mail de la empresa · tanda 2 del relevamiento (mesa/informes/admin) · zonas · aviso DL.

## Trampas descubiertas (para la próxima sesión)

- El docx de Lautaro trae los puntos SIN el contexto visual en el texto — sin mapear las capturas
  del `word/media/` (por orden de `r:embed` en `document.xml`) varios puntos se malinterpretan.
  Si manda una tanda 2, repetir ese procedimiento.
- `ChartTabla` es usado por ~16 consumidores en todo el sitio: cualquier cambio de
  orden/recorte/colapso tiene que entrar como prop opt-in, nunca cambiando el default (los lotes
  R6 y R9 lo tienen anotado).
- El punto 19 (sidebar corta la cinta) tienta a mover `getCintaData()` al layout compartido — eso
  ya se probó en C25 y arrastra revalidate a TODAS las páginas (guarda documentada en
  `(site)/layout.tsx:20-27`). El fix es de CSS/estructura, no de data fetching.
