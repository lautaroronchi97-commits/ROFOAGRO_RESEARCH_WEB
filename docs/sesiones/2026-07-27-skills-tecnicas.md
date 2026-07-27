# Sesión 2026-07-27 — skills técnicas de skills.sh

- **Rama:** `claude/project-skills-analysis-r0o67y` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** evaluar 16 skills candidatas de skills.sh (más research
  propio del directorio) y cargar las que sirvan para este proyecto.

## Hecho
- **Research** (2 agentes en paralelo): análisis detallado de las 16 skills que pasó Lautaro
  (contenido real de cada `SKILL.md`, no solo la tagline) + relevamiento propio de skills.sh
  (leaderboard, topics testing/databases/agent-workflows, repos grandes) buscando qué más
  sirve para este proyecto puntual (Next.js/Supabase/Playwright/Vitest/informes PDF-PNG/
  research con citas verificadas).
- **Instaladas 13 skills técnicas** vía `npx skills add <repo> --skill <nombre>` (CLI del
  paquete `skills`, quedan en `.agents/skills/<nombre>/` con symlink en
  `.claude/skills/<nombre>` + registro en `skills-lock.json`):
  - `supabase` + `supabase-postgres-best-practices` (supabase/agent-skills, oficial)
  - `vercel-react-best-practices` + `vercel-composition-patterns` + `web-design-guidelines`
    (vercel-labs/agent-skills)
  - `frontend-design` + `webapp-testing` (anthropics/skills)
  - `grill-with-docs` (mattpocock/skills — elegida en vez de `grill-me` del mismo autor,
    porque ancla la discusión en docs existentes tipo `CONTEXTO.md`/`ESTADO.md`, que es
    justo la cultura de este repo)
  - `find-skills` (vercel-labs/skills)
  - `verification-before-completion` + `systematic-debugging` (obra/superpowers)
  - `data-quality-frameworks` + `backtesting-frameworks` (wshobson/agents)
- **Descartadas** (de las 16 originales): `vercel-react-native-skills` (es para apps
  React Native/Expo, este proyecto es web) · `css-animations` de heygen-com (específica del
  producto HyperFrames, no una guía general de CSS) · `nextjs-supabase-auth` de sickn33 (repo
  chico/comunitario, exige 2 skills prerequisito, y nuestro login ya está construido y
  auditado con lógica propia — una skill genérica de auth contra eso es riesgo) ·
  `vercel-react-view-transitions` (requiere React Canary, estamos en Next 16 estable) ·
  `deploy-to-vercel` (nuestro deploy es git push → PR → Vercel automático; una skill que
  deploya directo por CLI contradice el protocolo del repo) · `agent-browser` (ya usamos
  Playwright + Chromium en cada sesión para verificación visual; redundante, y con warning
  de Snyk) · `typescript-advanced-types` (el proyecto ya está en strict +
  `noUncheckedIndexedAccess` saneado, valor marginal) · `improve-codebase-architecture` (se
  solaparía con la auditoría integral E1→E7 recién cerrada).

## Decisiones tomadas (y por qué)
- **Una sola de las dos "grill"** (`grill-with-docs`, no `grill-me`) — mismo autor, mismo
  propósito (entrevista adversarial de planes), pero la versión doc-grounded encaja mejor con
  un repo que vive de `CONTEXTO.md`/`ESTADO.md`/planes versionados.
- **`webapp-testing` en vez de `agent-browser`** para automatización de navegador — el
  proyecto ya tiene el patrón "levantar server + Playwright headless + screenshot claro/
  oscuro" asentado a mano en decenas de sesiones; esta skill lo sistematiza sin sumar un
  binario nuevo.
- Revisado el contenido completo de las 2 skills con Snyk "Med Risk" (`find-skills` y
  `web-design-guidelines`) antes de commitear: ambas son solo instrucciones en markdown
  (una explica cómo usar el CLI `npx skills`, la otra hace un `WebFetch` de un archivo de
  reglas en el momento de la revisión) — nada ejecutable ni alarmante.
- Se agregaron también las 3 de "tanda 2" (`data-quality-frameworks`, `backtesting-frameworks`,
  `vercel-composition-patterns`) a pedido explícito de Lautaro en la misma sesión, aunque en
  la devolución original quedaban como "para cuando el trabajo lo pida" — decisión de él,
  no autónoma.

## Verificado
- `npm install` (el sandbox no tenía `node_modules`) · `npm run lint` ✅ · `npx tsc --noEmit`
  ✅ · `npm run build` ✅ · `npx vitest run` 201/201 ✅. Ningún cambio de código — solo archivos
  de skills — así que la verificación es sobre todo para confirmar que la instalación no rompió
  nada (symlinks válidos, sin colisión de nombres con las 4 skills propias del proyecto).
- Sin colisión de nombres: las 13 nuevas conviven con `informe-diario`/`informe-semanal`/
  `view-mercado`/`voz-lautaro` sin pisarlas.

## Quedó pendiente / en vuelo
- Nada bloqueado. Las skills quedan disponibles para todas las sesiones futuras vía
  `.claude/skills/`.
- Tanda opcional NO instalada (queda para cuando el trabajo puntual lo amerite, según la
  devolución original): `improve-codebase-architecture` de mattpocock. Se puede sumar en
  30 segundos con `npx skills add https://github.com/mattpocock/skills --skill improve-codebase-architecture`
  si en algún momento se retoma un refactor de arquitectura grande.

## Trampas descubiertas (para la próxima sesión)
- El CLI `npx skills add <repo> --skill a,b,c` (coma) **no funciona** para pedir varias
  skills de un mismo repo en una sola instalación — hay que repetir el flag: `--skill a
  --skill b --skill c`.
- El sandbox de esta sesión arrancó sin `node_modules` (repo recién clonado) — antes de
  correr `lint`/`tsc`/`build` hace falta `npm install`, si no todo tira errores de módulos
  no encontrados que parecen bugs de código pero son solo falta de dependencias.
- El CLI instala en `.agents/skills/<nombre>/` (carpeta "universal", pensada para convivir
  con otros agentes además de Claude Code) y deja un symlink relativo en
  `.claude/skills/<nombre>` → `../../.agents/skills/<nombre>`. Ambas carpetas van al repo
  (el symlink no sirve de nada sin el contenido real detrás). Hay también un
  `skills-lock.json` en la raíz que trackea origen + hash de cada skill instalada — sirve
  para `npx skills update` más adelante.
