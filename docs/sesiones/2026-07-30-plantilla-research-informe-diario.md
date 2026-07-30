# Sesión 2026-07-30 — plantilla "Research" para el informe diario (prototipo)

- **Rama:** `claude/informe-research-p2-ynnz07` · **PR:** #_ (base `main`)
- **Objetivo pedido por Lautaro:** importó desde Claude Design un mockup ("Informe Research P2" — one-pager
  tipo research de ALyC, oscuro, con tesis + KPIs + 2 gráficos + franja de referencia + agenda) y pidió
  probar el informe diario de hoy con ese formato.

## Hecho
- `src/lib/informe-research.ts`: derivaciones puras (cero fetch nuevo, cero número inventado) sobre los
  libs YA existentes — `buildDesfasaje` (A3 vs Chicago por grano, `getCierresGranos`+`getMonitorMercados`),
  `buildTnaImplicita` (mejor posición de TNA por grano vía `getArbitrajes` + 2 posiciones de dólar futuro
  vía `getDolarFuturo`), `buildTresCifras` (mayor movida de Chicago + WTI + mejor carry USD),
  `buildReferenciaPizarra`/`buildVolumenA3`/`buildComplejoSoja` (franja de abajo) + `nicePercentDomain`
  (escala de gráfico genérica, redondea el dominio a un número prolijo).
- `src/components/informe-research-charts.tsx`: 2 gráficos SVG a mano, genéricos (no hardcodeados a los
  datos del mockup) — `DesfasajeChart` (barras divergentes A3/Chicago) y `TnaChart` (barras horizontales
  TNA implícita grano+USD).
- `src/app/informes/plantilla/research/page.tsx`: página standalone nueva, mismo patrón que
  `/informes/plantilla/diario` (gate por `INFORME_TOKEN`, `noindex`, `force-dynamic`, paleta oscura FIJA
  igual al mockup — no depende del tema del sitio). Tamaño 816×1056 (carta a 96dpi, el mismo que el propio
  mockup ya traía en sus estilos inline) pensado para screenshotear a 2x con Playwright.
- `src/lib/informe-research-copy.ts`: la tesis del día + "lo que se lee acá" (los 2 bloques de prosa
  curada, no derivables de aritmética pura) quedan en un módulo de contenido por fecha — placeholder
  honesto ("sin tesis cargada") si la fecha no tiene entrada.

## Decisiones tomadas (y por qué)
- **Prototipo aparte de `/informes/plantilla/diario`**, no reemplazo: la placa vertical (WhatsApp, voz de
  Lautaro con "color de la rueda") sigue existiendo tal cual. Esta es una segunda plantilla para que
  Lautoro decida si le gusta el formato antes de tocar el pipeline de producción (skill `informe-diario`,
  Routine diaria).
- **TNA implícita por grano = la posición de MAYOR interés abierto, no la de mayor TNA.** Con datos reales
  (30/07) el trigo a 55 días (SEP26, solo 11 lotes/27 de interés abierto) anualizaba 41,74% TNA sobre el
  mismo spread que DIC26 (144 días, 4.567 de interés abierto) anualiza a 17,16% — mismo spread, denominador
  de días distinto. Elegir "la de mayor TNA" hubiera mostrado sistemáticamente el contrato más ilíquido y
  menos representativo. Se corrigió antes de mostrarlo, verificado con el JSON real de `/api/informes/datos`.
- **Los 2 tramos de dólar futuro del gráfico 2 saltan la posición casi-spot** (`dias<=5`): JUL26 a 1 día
  daba TNA 0,00% (no aporta nada a "dónde rinde el tiempo"), quedó AGO26/SEP26.
- **La tesis y "lo que se lee acá" NO se generan con una plantilla de texto automática**: son prosa real,
  redactada esta sesión con los números reales del día (ver `informe-research-copy.ts`), a falta de
  integrar esto como un Paso 2 del skill `informe-diario` (que sí usa un modelo grande con tiempo para
  pensar el título — ver `.claude/skills/informe-diario/SKILL.md`). Documentado en el código como
  prototipo explícito.

## Verificado
- lint / `tsc --noEmit` / `next build` ✅ (los 4 archivos nuevos, cero error/warning).
- `npm run build && npm run start` con `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`/`INFORME_TOKEN` reales del
  entorno: `/informes/plantilla/research?token=...` sirve 200 con los 5 bloques de datos en vivo
  (desfasaje, TNA, tres cifras, franja de referencia, agenda del día) — cotejados contra
  `/api/informes/datos` y contra el JSON crudo de `getArbitrajes`/`getDolarFuturo` a mano.
- Screenshot real con Playwright (`chromium` de `/opt/pw-browsers`, viewport 816×1056 @2x) del informe de
  HOY (30/07/2026) — enviado a Lautaro para feedback.

## Quedó pendiente / en vuelo
- **El OK de Lautaro sobre el formato.** Si aprueba: (1) decidir si reemplaza o convive con la placa
  vertical actual; (2) si convive, sumar el Paso 2 del skill `informe-diario` para que la Routine redacte
  la tesis/lectura todos los días (hoy solo tiene la entrada del 30/07 a mano en `informe-research-copy.ts`
  — cualquier otra fecha muestra el placeholder "sin tesis cargada"); (3) wirear el screenshot/mail/Storage
  de esta plantilla igual que los Pasos 4-7 del skill.
- La selección automática de "las tres cifras" (mayor movida de Chicago + WTI + mejor carry) es una regla
  fija, no editorial — si a Lautoro no le sirve ese criterio, es la primera perilla a ajustar.

## Trampas descubiertas (para la próxima sesión)
- El diseño de Claude Design ("Informe Research P2") trae ejemplos numéricos internamente inconsistentes
  entre sí (ej. el color muted-vs-bold de las etiquetas de barras del gráfico 1 no sigue una regla fija) —
  es un mockup ilustrativo, no una spec pixel-perfect. Se optó por una codificación propia, consistente
  (A3 y Chicago siempre con etiqueta en negrita y color por signo) en vez de perseguir el detalle exacto
  del mockup.
