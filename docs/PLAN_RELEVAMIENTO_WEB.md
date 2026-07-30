# PLAN — Relevamiento de la web (29/07/2026): 56 puntos → 10 lotes de ejecución

> **Qué es esto.** Lautaro relevó a mano TODA la web (documento "RELEVAMIENTO DE LA WEB", 29/07/2026,
> 56 puntos + 73 capturas) y pidió: (1) los pasos a seguir para implementar todos los cambios,
> (2) las decisiones/preguntas juntas al final, (3) registrar en el backlog lo que no llegó a
> relevar. Este plan transcribe e interpreta los 56 puntos, los mapea a archivos reales (relevado
> con el código el mismo día) y los organiza en **10 lotes ejecutables (R1–R10)** con un prompt
> autocontenido cada uno. Registrado como **C28** en el backlog maestro
> ([`auditoria/E7-sintesis.md`](auditoria/E7-sintesis.md) §4). Modelo sugerido para los builds:
> **Sonnet** (regla de `PLAN_BACKLOG.md`); los lotes de UI cargan la skill **`ui-ux-pro-max`**
> antes de tocar pantalla, y todo copy en nombre de Lautaro usa **`voz-lautaro`**.

## 1. Origen y reglas de lectura

- Fuente: docx subido por Lautaro el 29/07/2026. Cada punto fue cruzado con su captura; donde el
  texto era ambiguo, la captura definió la interpretación (anotada acá).
- **Donde Lautaro "dio letra"** (puntos 8, 10, 11, 12…) el texto final NO se copia textual — él lo
  dijo explícito: *"No escribas tal cual, te estoy dando letra"*. Se redacta con `voz-lautaro`.
- Regla transversal que él mismo enunció y se repite en varios puntos — queda como **patrón**:
  - **Tablas**: siempre orden descendente (el dato más reciente primero). En `/dolar`, además,
    solo los últimos 5 datos visibles.
  - **Calculadoras**: precio disponible sugerido (grano seleccionable → última pizarra), editable
    en pesos Y USD con recálculo cruzado; los cálculos siempre corren sobre el USD.
  - **Chips/filtros**: click = filtrar (dejar solo eso), no excluir.
  - **Jerarquía visual**: resultados grandes y destacados; datos auxiliares (días, TNA, directa)
    presentes pero más chicos. Resaltar siempre el día de pago.

## 2. Los 56 puntos, interpretados y mapeados

### A. Landing `/bienvenida` (1–13) — archivos: `src/app/bienvenida/page.tsx` (arrays `SERVICIOS`/`DIFERENCIALES`/`FAQ` + JSX inline), `src/components/theme-toggle.tsx`, `src/components/landing/contacto-form.tsx`, `src/lib/auth/emails.ts`

| # | Pedido (interpretado con la captura) | Anclaje |
|---|---|---|
| 1 | El botón de tema dice "Modo pizarra"/"Modo rueda" → que diga **modo claro / modo oscuro** | `theme-toggle.tsx:29` (afecta también al header del sitio) |
| 2 | Copy del bloque "Accedé a las mismas herramientas…": decir que acompaña a decidir *cuándo, cómo y a qué precio* **comprar/vender** (hoy solo "vender") | JSX hero/problema |
| 3 | **Destacar** "Servicio a medida para productores y acopios" | JSX |
| 4 | Reformular la grilla de 6 servicios: **dar indicios, no describir exacto** lo que hacemos ("generar interés") | array `SERVICIOS` (líneas 12-47) |
| 5 | **Destacar** "…especialistas en estrategia que te ayudan a diagramar tu jugada, no solo datos" | JSX |
| 6 | "Así se ve por dentro": mostrar **más y más real** — un poco de line-ups y de cosas complejas ya armadas, "sin decir tanto, pero atrapando al cliente" | `Teaser()` (líneas 351-403, hoy mockups fake) |
| 7 | "Por qué ROFO AGRO" → **"¿Por qué ROFO AGRO?"**; "Alineados con tu resultado" → *"Nuestro foco está puesto en donde vos decidas: en tu rentabilidad y volumen de operaciones"* (dio letra) | array `DIFERENCIALES` |
| 8 | Sección acopios: sacar "replicá el modelo de un correacopio" → enfoque *profesionalizá tu mesa de negocios / potenciá tu originación / te ayudamos a diseñar e instrumentar tus propias condiciones / agregale valor a tu cartera* (dio letra) | JSX `.lp-acopios` |
| 9 | FAQ "¿Esto reemplaza a mi corredor?": el cliente puede venderle a **acopio, cooperativa, exportador o corredor** — no asumir solo corredor | array `FAQ` |
| 10 | FAQ "¿Los datos son en tiempo real?": aclarar **información conectada a mercado real time**, *actualizada e interpretada por nuestros especialistas* (dio letra) | array `FAQ` |
| 11 | CTA final: *"Sumá toda nuestra experiencia a tu equipo"*; *no decir "tablero", decir "web"*. **Verificar destino del mail de consulta** (debe llegar a lautaroronchi97@gmail.com por ahora) | JSX contacto + `emails.ts::enviarConsulta` (destino = env `ADMIN_EMAILS`; ⚠️ si falta la key o la env, hoy degrada en silencio y el visitante ve "OK" igual — verificar en Vercel) |
| 12 | "Tomá cada decisión con una mesa de granos de tu lado" → *"sumá un equipo de profesionales a tu lado"* | JSX `.lp-cierre` |
| 13 | Eliminar el badge **"V0 · datos de cierre · algunos provisorios"** | `site-footer.tsx:19-21` (footer compartido: landing Y sitio) |

### B. Shell del sitio (14–19, 22–24, 46) + noticias (15, 37)

| # | Pedido | Anclaje |
|---|---|---|
| 14 | **Quitar el mail de Lautaro del fondo de toda la web** (es la marca de agua de login, tileada con su email) | `watermark.tsx` + `(site)/layout.tsx:65`. Pregunta 5: ¿sacar del todo o texto neutro? |
| 15 | **Nunca mostrar "(vía BCR)"** aunque la noticia venga por ese scrape | dos lugares espejo: `scripts/ingest-noticias.mjs:164` y `src/lib/noticias.ts:304` + limpiar las filas ya guardadas en la tabla `noticias` (UPDATE del campo fuente) |
| 16 | Sidebar: al abrir un grupo, **cerrar el que estaba abierto** (acordeón excluyente). Lo de "Admin solo visible para admins" **ya funciona así** (`sidebar.tsx:180`, gated por `esAdmin`; él lo ve porque es admin) — sin cambio | `sidebar.tsx::toggleGrupo` (hoy Set múltiple + localStorage; pasar a un solo abierto, mantener persistencia y "grupo activo siempre expandido") |
| 17 | Horas de rueda **con minutos**: "Dólar 10:00–15:00 · Agro 10:30–17:00" | `src/lib/rueda.ts:13-15` (labels literales) |
| 18 | Quitar **"Pizarra electrónica · granos"** del masthead | `site-header.tsx:28` (`.brand-sub`) |
| 19 | La sidebar **corta la cinta** de cotizaciones → bajarla al lineamiento del logo, como antes | la cinta vive DENTRO de `.site-main` (columna derecha del grid `.site-shell`, `globals.css:203-209`) y la sidebar es sticky `top:64px`. Ajustar layout/offsets para que la cinta corra completa y la sidebar arranque bajo el header. ⚠️ NO mover `getCintaData()` al layout compartido: arrastra revalidate a todas las páginas (guarda documentada en `(site)/layout.tsx:20-27`, hallazgo real de C25) |
| 37 | Noticias: eliminar "30 fuentes", "categorización propia" y "vía BCR" | `noticias/page.tsx:19` (kicker hardcodeado) + `noticias-panel.tsx:25` (sub dinámico) + punto 15 |
| 46 | En modo oscuro **se ve blanco dentro del logo** de la marca de agua de los gráficos | `public/rofoagro-logo-marca.svg` es HOY una copia byte a byte de `rofoagro-logo.svg` con ~20 fills casi-blancos (`#fcfdfc`, `#f2f5f0`…) del auto-trace. Generar la variante limpia real (quitar los paths claros, mismo procedimiento que el isotipo del 24/07) — arregla TODOS los charts de una, sin tocar componentes |

### C. Home (20–23) + cinta (24)

| # | Pedido | Anclaje |
|---|---|---|
| 20 | "El mercado hoy": números desbordan los mini-paneles (fix). **Agrandar el panel y partirlo en dos: Chicago \| Argentina.** Argentina con **Maíz JUL26, Soja NOV26 + MAY27, Trigo DIC26** (ver pregunta 1 por el "nov23"), tomados de los datos de arbitrajes: **últ. operado del WebSocket si operó; sino últ. ajuste** | `mercado-hoy.tsx` (hoy solo `data.agro` de `getMonitorMercados()`); la pata Argentina reusa `getArbitrajes()` + `getFuturosLive()` (misma lógica referencia que `arbitrajes-table.tsx`) |
| 21 | Placa del hero: **rotar la pizarra de cada grano con transición** (SOJ/MAI/TRI), formato grande actual para el USD + **valor en pesos un poco destacado abajo** (en lugar del listado de las otras pizarras) + **fecha de la pizarra** | `(site)/page.tsx:155-180` (`.hero-placa`, `CountUp`); `getPizarra()` ya trae `ars` y `fecha` por grano → client component nuevo con rotación (gated `prefers-reduced-motion`) |
| 22 | "Próximos informes": ventana de **una semana como máximo** (hoy 10 días); el **mes al lado de la fecha**, no abajo | `informes-panel.tsx:33` (`sumarCorridos(hoy,10)` → 7) + formato de `.cal-date-txt` (`fechaCorta` de `calendario.ts`) |
| 23 | **Sacar "Última estimación de producción" de la home** (queda en `/produccion`) | `(site)/page.tsx:185-189` (retirar `EstimacionesMini`; el componente sigue usándose… verificar: si queda sin importadores, borrarlo) |
| 24 | Cinta: **sacar las pizarras**, dejar todos los USD (el "oficial" = **spot mayorista**, ver pregunta 8) y **sumar petróleo, oro, plata, real, S&P y Merval** con cotización y variación (ya están en el monitor) | `src/lib/market/cinta.ts:47-76` (hoy 8 ítems, 3 son pizarras); `getMonitorMercados()` ya está `cache()`ado y trae `CL=F`, `GC=F`, `SI=F`, `BRL=X`, `SPY`, `^MERV` con `deltaPct` — mapear a `CintaItem` |

### D. Granos (25–30)

| # | Pedido | Anclaje |
|---|---|---|
| 25 | Arbitrajes: pizarra editable **en pesos Y USD con recálculo cruzado** (hoy solo USD; el ARS ya llega como `pizarraArs`); **flecha refresh** que vuelve al valor de pizarra (el botón ↺ ya existe, conservarlo); valor manual en **azul**, automático/reseteado en negro; **vol/cierre/OI del grupo alineado a la derecha**; precios pizarra/dispo **más legibles** (negrita o fuente mayor); arriba a la derecha (alineado con los nombres de grano) **dólar oficial online + dólar BNA online = oficial spot − 9** | `arbitrajes-editable.tsx` (state `pz` USD-only → dual), `arbitrajes-table.tsx` (`.gmeta.gvol`), `pizarra.ts` (ya parsea `tcBna` de CAC, HOY SIN USO — candidato a "BNA confirmado 15hs"). El −9: pregunta 2 |
| 26 | Pases: **mismo filtro de posiciones que arbitrajes** (así desaparece AGO de soja/maíz); si una posición se filtró en arbitrajes no debe estar en pases. Objetivo: solo pases relevantes | arbitrajes filtra OI<100 sin operar hoy en `arbitrajes-table.tsx:50-51`; pases NO filtra (`pases-cierres.ts:84-97`). Extraer el filtro a una util compartida y aplicarlo a las patas de pases |
| 27 | Caja: comparar **plazos similares** — por ahora **soja NOV, maíz DIC, trigo DIC** — usando SIEMPRE última pizarra conocida + último ajuste (sin la diaria del mercado); **destacar visualmente** (recuadro) el grano de menor tasa implícita; **sumar el spread dispo–futuro** | `mejor-caja-panel.tsx` (hoy: mínima TNA de TODO el grano; pasar a posición fija por grano) |
| 28 | Capacidad: **"Soja (industria)" inmediatamente debajo de Soja**; **emojis** para sorgo y girasol | `capacidad.ts:50` (`GRANOS_ORDEN`) + `capacidad-editable.tsx` (industria hoy renderiza al final; `glyphFor` devuelve null para SOR/GIR → sumar emoji 🌾-sorgo/🌻-girasol o glifos SVG propios) |
| 29 | Monitor: **emojis en todas las posiciones, sin repetir**, el que más represente cada una; revisar alineación ("Referencias" arranca pegado al margen izquierdo) | `monitor-mercados.tsx:41` (`.mon-sub-hd`) + tablas agro/macro (columna producto/instrumento) |
| 30 | View: el bloque **"Tu feedback" solo para admins** — si algún día se abre a clientes, que se lea hasta antes de la línea punteada (la punteada ES el `border-top:dashed` de `.vw-fb`, `globals.css:1827`); **view imprimible en PNG o PDF** para descargar y enviar | `granos/view/page.tsx` (la página ya es `requireAdmin`; el cambio es estructural: `ViewFeedback` renderizado solo si admin, dejando la card lista para un futuro gate por sección) + export (pregunta 7: PNG del navegador vs PDF con plantilla) |

### E. Dólar (31–36)

| # | Pedido | Anclaje |
|---|---|---|
| 31 | `/dolar/futuro`: **quitar la ChartTabla "Datos de la curva"**; la tabla de la derecha (posiciones con TNA/TEM/TEA) pasa a ser **primera y central**; el gráfico va **abajo, más grande** | `dolar-futuro-panel.tsx` (layout `.df-split`, `globals.css:509-511`) |
| 32 | **Patrón para TODO `/dolar`**: tablas de datos con **últimos 5, orden descendente** (el último primero) + **barra para editar el plazo en todos los gráficos** (el máximo actual está bien; poder achicar) | `chart-tabla.tsx` NO ordena ni recorta (contrato: el caller decide) → sumar props `maxFilas`/orden y usarlas SOLO en los 5 charts de /dolar (`dolar-oficial-chart`, `-semanal`, `-volatilidad`, `bcra-mulc-chart`, `implicitas-panel`) sin tocar los otros ~11 consumidores. Selector de rango: reusar patrón `fg-chip` (ya usado como toggle en volatilidad) |
| 33 | `/dolar/linked`: **borrar "data912"** visible. Detección de instrumentos DL nuevos: **ya es dinámica** (regex `/^D\d/` sobre el feed completo de `arg_notes`, sin lista fija) — ver §4. Opcional: aviso si aparece un ticker que `vencFromTicker` no puede parsear | `dolar/linked/page.tsx:18` (kicker) y `dolar/implicitas/page.tsx:18` ("MAE · data912") |
| 34 | Sintéticos: **solo la tasa del sintético** — sin TNA del futuro, sin comparación, sin "ventaja", sin bloque "mejor sintético". Fórmula del Excel: `((Spot × PagoFinal / Px) / DLR futuro − 1) × 100` = directa; **anualizar por los días restantes al vto del FUTURO** (hoy el código anualiza con otros días — el reclamo "la estás calculando mal" apunta ahí), base 365. **Solo letras con vto cercano a fin de mes** (una posición por mes, más comparable con el DLR), **BONCAPs incluidos** (ya lo están). "Poder hacer algún get con tickers" para completar meses faltantes | `src/lib/sinteticos.ts` (pura, testeada — cambiar ahí y en tests), `market/sinteticos.ts`, `sinteticos-panel.tsx`. **REGLA DURA: validar con ejemplo numérico del Excel ANTES de codear** (pregunta 3) |
| 35 | Implícitas: un solo gráfico con **tres líneas — dólar linked, sintéticos y granos** — cada punto con su plazo (hoy grafica futuro + linked). Si son muchos datos, **sin tabla** | `implicitas-panel.tsx` (sumar serie sintéticos de `getSinteticos()` y serie granos = TNA de `getArbitrajes()`; evaluar si la línea "dólar futuro" se reemplaza o se mantiene — el pedido dice "todas las tasas disponibles", interpretación: sumar, no sacar) |
| 36 | Cambiario: **eliminar "Contado" (renta fija) y "Tasas" (cauciones/repo)** de la tabla de volumen (whitelist `GRUPOS` → solo "Monedas"); tabla del gráfico con patrón 5-descendente; **sumar "Volumen dólar linked"** = sumatoria de lo operado en TODOS los D* listados (una sola línea); **eliminar el texto técnico** "BCRA API v4 (variable 78…)" del ¿Qué es esto? | `panel-cambiario.tsx:20` (`GRUPOS`), `:145-148` (QueEsEsto); el volumen por instrumento D* viene en el feed de data912 (`arg_notes`, campo de volumen) — verificar el nombre del campo en el build |

### F. Calculadoras (38–45, 47) — patrón transversal primero

**Patrón nuevo `precio-dual.tsx`** (NO existe hoy — cada calc copia su propio picker): selector de
grano → última pizarra sugerida; dos inputs (**$ y USD**) con recálculo cruzado usando el TC BNA
del día; los cálculos siempre corren sobre USD; botón ↺ vuelve a pizarra; **azul = valor manual,
negro = automático** (mismo lenguaje que arbitrajes p25). Se construye una vez (lote R4) y se
cablea en a-fijar, por-porcentaje, pago-diferido, carry y negocios-de-planta.

| # | Pedido | Anclaje |
|---|---|---|
| 38 | A fijar: disponible default = **última pizarra USD** + dual $/USD; **posiciones canónicas por grano** — Soja JUL/SEP/NOV/ENE/MAY · Trigo DIC/ENE/MAR/JUL/SEP (pregunta 4) · Maíz ABR/JUL/SEP/DIC/ENE/MAR — **nunca vencidas, siempre de hoy en adelante, máx 1 año**; el futuro se actualiza con los precios del día del WebSocket — **si no operó, precargar promedio bid/ask con alerta "estimado"**; todo sigue editable; **gráfico de la curva de TNA implícita** por posición (combinado delta+TNA si queda legible; sino separados) | `calc-fijar.tsx` (hoy: disponible hardcodeado "320", `CURVA_INI` fija, select propio que carga toda la curva; ya tiene `DeltaChart` — extender) + `a3-live.ts::getFuturosLive` para las puntas |
| 39 | Por porcentaje: **filtro de grano + última pizarra sugerida** en "precio posición vendida" (editable); resultado **"porcentaje para cliente" al lado del lleno**, en **rojo** (hoy verde), fuentes más grandes; **"Plazo estimado" y "Vence" más grandes, uno abajo del otro**; "Vence" → **"Vencimiento del período de fijación"**; eliminar del sub *"(ej. 114% maíz julio) · aforo a cliente"* | `calc-porcentaje.tsx` (sub línea 54, labels líneas 83-90) |
| 40 | Negocios con pagos: TC precargado = **spot oficial mayorista − 9 (BNA online)**; cuando esté el **TC BNA confirmado de las 15hs, usar ese** (candidato: `tcBna` que CAC ya publica y `pizarra.ts` ya parsea); "Precio en pesos" con el mismo tratamiento visual que el disponible USD (**rojo**); resto de los datos más grandes; **resaltar el día de pago**; "Días" → **"Días de anticipo"** | `calc-negocios-pago.tsx` (TC hoy 100% manual, línea 55) |
| 41 | Pago diferido: aplicar el patrón (grano + disponible $/USD sugerido); sección mejor ordenada, datos más visibles, **resaltar el día de pago** | `calc-diferido.tsx` (hoy 100% ARS sin datos del server — es la calc que más cambia de contrato) |
| 42 | Pases: "corta" → **"venta"**, "larga" → **"compra"**. **La lógica está al revés**: el pase se arma si la cercana vale MÁS que la larga → el resultado hoy `larga − corta` pasa a **`cercana − larga`** (el +10 del ejemplo debía ser −10). Si el resultado es **negativo**: cartel *"cuidado: el pase es negativo, la posición está en carry"*; si es positivo, nada. "A cliente" → **"A fijar: (resultado − quita)"** + **"plazo hasta (vto de la posición)"**, ambos destacados; días/TNA/directa se mantienen pero menos destacados | `calc-pases.tsx` (labels líneas 39-40, signo en `pase()`, "A cliente" línea 61) — ⚠️ es cambio de FÓRMULA visible: dejar test con el ejemplo ±10 |
| 43 | Carry: patrón (grano + precio sugerido $/USD); **carry medible en pesos Y en USD, seleccionable**; sugerencias de A3 y pizarra; datos informativos más destacados | `calc-arbitraje.tsx` (hoy todo USD) |
| 44 | Costos: **ocultar — solo admin** (no cerraron con la empresa todavía) | `biblioteca.ts:59-63` (los ítems de calcs nunca setean `soloMesa` → setearlo para `costos`) + gate en `calculadoras/[slug]/page.tsx` + ocultarla del índice `/calculadoras`. Pregunta 6 |
| 45 | Estrategias: **glosario previo** (qué es y para qué sirve cada estrategia, para leer antes de simular); **segmentar por alcistas/bajistas** + categorías tipo techo asegurado/piso asegurado/rango ("acá necesito de vos" → criterio propio, mapeando el campo `view` que los 31 presets YA tienen, `estrategias.ts:73-180`); el renglón de explicación **más grande y destacado**; eliminar el sub *"Preset + patas editables · payoff, tabla y gráfico"*; resumen (máx. ganancia/pérdida, prima, breakevens) **uno al lado del otro, mucho más grande**; al elegir estrategia, **explicar qué implica vender/lanzar y si es futuro u opción**; si el usuario toca patas → **"estrategia personalizada"**; **precio base sugerido de A3** (el futuro base de las opciones; si se elige un futuro, las opciones de abajo se arman sobre ese); **ejes X (precio) e Y (resultado) con valores visibles** (hoy `PayoffChart` no tiene NINGÚN tick ni label de eje) | `calc-estrategias.tsx` + `estrategias.ts` |
| 47 | Negocios de planta: eliminar el sub "Pizarra menos flete, secada…"; patrón dual $/USD con grano; **secada fijo/no fijo**: fijo = valor por punto único; no fijo = según cuántos puntos, desplegable con el valor del 1er, 2do, 3er punto…; **"otros conceptos" con botón +** para cargar varios por separado; layout **más visual, más grande**, no todo apilado al margen derecho; **precio final en la moneda elegida** ($ o USD), dolarizando siempre con el BNA del día | `calc-planta.tsx` + `src/lib/planta.ts` (hoy: secada modo fijo/libre con UN valor por punto; otros = un solo concepto) |

### G. Gráficos `/graficos` (48)

| Pedido | Anclaje |
|---|---|
| Etiquetas de presets **en mayúscula** donde falte (ej. chips "Maíz ABR / Soja MAY") | `graficos-client.tsx` (labels de presets) |
| Campañas: **default = solo la última tildada** (hoy `[]` ⇒ todas); click en "Todas" las prende, **re-click deja solo la última**; ídem "Últ. 3" | `graficos-client.tsx:254,304-307,730-731` |
| Tabla **siempre descendente** (el último primero) — patrón general | `spread-chart.tsx::mergeRows` (hoy asc por `x`) |
| En eje "días al vto": **ubicar la tabla en el "hoy"** (si hoy estoy a 110 días, esa fila primero) y **recuadrarla/colorearla** | `spread-chart.tsx` (la x de hoy se deriva del `refVto` de la campaña vigente) |
| KPI (última / mín / máx / percentil) **más grande y entre el gráfico y la tabla** | `graficos-client.tsx:773-785` (`.gx-kpis`, hoy después del chart y el volumen) |
| **Indicar qué campaña es en cada extremo** de las líneas | `spread-chart.tsx` (label al inicio/fin de cada línea, recharts `LabelList` o SVG custom) |
| Su pregunta "¿el cálculo de cada campaña es contra la pizarra de ese momento o la actual?" | **Respondida en §4 — sin cambio de código** |

### H. Producción (49–51)

| # | Pedido | Anclaje |
|---|---|---|
| 49 | Calendario: click en un chip de organismo = **queda filtrado ese** (hoy el click lo EXCLUYE); calendario acotado a **60 días** (hoy va hasta fin de 2026) | `calendario-cliente.tsx:33-52` (semántica del Set `off` → invertir: click = solo ese; re-click = todos) + `produccion/calendario/page.tsx:22-25` |
| 50 | Estimaciones: ídem chips de grano (filtrar, no excluir); **sumar filtros por organismo, país y campaña** con el mismo formato de chips que el grano | `estimaciones-cliente.tsx:51-62` (hoy solo chips de grano excluyentes; organismo/país/campaña existen solo como selects del gráfico de evolución) |
| 51 | Zonas: **falta verificarlo visualmente** → registrado en backlog (§6), sin acción acá | — |

### I. Comercio (52–55)

| # | Pedido | Anclaje |
|---|---|---|
| 52 | DJVE: **dividir por familias** — maíz y todo lo relacionado / soja / trigo / girasol / **cebada+malta** — orden **siempre por volumen** (mayor a menor); **fecha de última actualización arriba** (hoy el stamp muestra solo HH:MM); eliminar la línea "N productos sin declaraciones…" | `djve-panel.tsx` + `djve.ts` (mapeo producto→familia nuevo; hay precedente de familias en `lineup/config.ts` y `DISPLAY_TO_FAMILIA` de empresas) |
| 53 | Camiones: márgenes/alineación de toda la landing; **sacar el sello "Agroentregas"** del panel (la captura marca el stamp arriba a la derecha del gráfico); **todo filtrable por grano**; tabla "quién recibió" filtrable por **grano y empresa**; los gráficos de Williams (zona + producto) pasan a **UN solo gráfico**: grano seleccionable + todas las zonas o zonas elegidas, con **overlay por campaña** agregable/quitable estilo spreads (evita la línea larga y pesada); **histograma de quién recibe, un dato por empresa**; KPIs se mantienen en el gráfico (producto líder, camiones día anterior, vs día anterior, vs mismo día año pasado, vs semana pasada); tablas **de más reciente a más antiguo, colapsadas por default, máx una abierta a la vez** (hoy las ChartTabla son siempre-visibles: requiere variante colapsable); "¿Qué es esto?" **sin explicación técnica ni de fuentes ni paths del repo** (hoy `senal-camiones` cita `docs/negocio/09...`) — solo qué se busca lograr | `camiones/plantas-panel.tsx`, `camiones-panel.tsx`, `camiones-chart.tsx`, `senal-camiones.tsx`, `src/lib/camiones/*` (⚠️ el overlay por campaña necesita que la serie se re-agrupe por campaña — la tabla `camiones` tiene historia 2018→2026, alcanza) |
| 54 | Puertos: **no barco por barco — lo que varió por producto y por empresa**; combinar en **un tablero por producto: vs día anterior y vs semana anterior**, con agrupación o filtro por **empresa** (drill-down: click en el dato → ver empresas); ordenar **por volumen**; mantener el formato de números con colores y las etiquetas **salió/nuevo**; ídem para zonas con click de empresas; el **buscador queda como está**, pero al filtrar por empresa mostrar el **total por cada zona**; tabla de buques **ordenada por ETB, del más viejo al más nuevo** (hoy por toneladas desc); **cuidado con los márgenes a la izquierda**. Él pidió explícito: *"antes que hagas todo chequeá qué información se pisa con otra… si tenés dudas me preguntás"* → el lote R10 abre con maqueta/propuesta antes de codear (pregunta 10) | `lineup/foto-operativa.tsx`, `buques-tabla.tsx`, `src/lib/lineup/foto.ts` (los Δ por producto vs día y vs referencia semanal YA se calculan — falta el corte por empresa×producto con Δs, que hoy no existe) |
| 55 | Empresas: "Originado" → **"Embarcado"**; "Cobertura" → **"Cumplimiento"** y el número **en %** (hoy `ratioFmt` = ratio con punto decimal, ej. `0.87` → pasar a `87%` formato es-AR); **quitar empresas con 0 buques** | `lineup/empresas-tabla.tsx` (headers "Orig. 60d"/"Cob."), `empresas-panel.tsx` (tabla por producto usa los nombres largos), `cobertura.ts::ratioFmt`, `empresas.ts:282-296` (hoy entran empresas sin line-up por la unión de fuentes — ver pregunta 9 por el trade-off) |

### J. Sin relevar todavía (56) → backlog (§6)

Las capturas del punto 56 marcan lo que Lautaro aún no revisó a ojo: las páginas de mesa 🔒
(**Señal física→precio, Mesa de embarque, Calor de mercadería, Negociado por producto**), el grupo
**Informes** (diario / semanal / lecturas de la mesa) y **/admin** completo. Además: *"agregar el
mail de la empresa"* cuando exista la casilla.

## 3. Lotes de ejecución (R1–R10)

Un PR por lote, base `main`, protocolo de `ESTADO.md` (lint + tsc + build + tests antes de push,
verificación Playwright claro/oscuro/mobile con datos reales, bitácora + «Ahora» en el mismo PR).
Los lotes de UI cargan `ui-ux-pro-max`; los de copy usan `voz-lautaro`.

**Orden sugerido**: R1 → R3 → R4 → R6 → R2 → R5 → R7 → R8 → R9 → R10.
R1 primero (lo más visible para todos); R2 (landing) conviene después de que Lautaro conteste las
preguntas de copy; R9/R10 al final porque son rediseños que piden su OK sobre maqueta.
Dependencias reales: R4 construye `precio-dual.tsx` (R5 lo reusa); R3 define el patrón visual
azul/negro y el helper BNA (R4/R6 lo reusan). Todo lo demás es independiente.

### PROMPT R1 — Shell + home + cinta (puntos 13–24 + 15 + 37 + 46)

> Leé `docs/ESTADO.md`, la última bitácora y **`docs/PLAN_RELEVAMIENTO_WEB.md` §§1-2 (bloques B y
> C) y §5** (respuestas de Lautaro a las preguntas 1, 5 y 8 — si aún no están respondidas, frená y
> preguntá). Cargá la skill `ui-ux-pro-max`. Rama nueva desde `main`.
> Implementá, en este orden: (a) los strings/labels chicos: badge V0 del footer, brand-sub del
> header, minutos de rueda, "(vía BCR)" en los DOS lugares espejo + UPDATE de las filas ya
> guardadas en `noticias`, kicker/sub de noticias, labels del toggle de tema; (b) watermark según
> la respuesta a la pregunta 5; (c) sidebar acordeón excluyente (conservar persistencia y grupo
> activo) + fix del layout sidebar/cinta (punto 19 — SIN mover `getCintaData()` al layout, guarda
> de C25); (d) `rofoagro-logo-marca.svg` limpio (quitar los fills casi-blancos del auto-trace,
> verificar renderizado sobre claro Y oscuro antes de reemplazar); (e) cinta nueva (punto 24);
> (f) home: mercado-hoy partido Chicago|Argentina con las 4 posiciones desde arbitrajes
> (referencia = últ. operado en vivo, sino últ. ajuste — misma regla que `arbitrajes-table.tsx`),
> placa hero rotativa con $/USD/fecha, informes a 7 días con mes al lado, retirar
> `EstimacionesMini`. Verificá con Playwright (claro/oscuro/mobile, datos reales, cero errores de
> consola, cero scroll horizontal) y cerrá con bitácora + ESTADO + PR draft.

### PROMPT R2 — Landing (puntos 1–12)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloque A y las respuestas de §5.
> Cargá `ui-ux-pro-max` y `voz-lautaro`. Todo el copy donde Lautaro "dio letra" se REDACTA (no se
> copia textual) con su voz, registro institucional sobrio (como el copy actual de la landing).
> Implementá los puntos 1-12 sobre `src/app/bienvenida/page.tsx` (arrays `SERVICIOS`/
> `DIFERENCIALES`/`FAQ` + JSX): énfasis (3, 5), reformulación de servicios a "indicios" (4),
> teaser más real con line-ups sin datos sensibles (6), "¿Por qué…?" + foco rentabilidad/volumen
> (7), acopios profesionalizá-tu-mesa (8), FAQ acopio/cooperativa/exportador/corredor (9) y
> real-time interpretado (10), CTA "sumá nuestra experiencia" sin la palabra "tablero" (11),
> cierre "equipo de profesionales" (12). Verificá a qué casilla llega HOY el formulario de
> contacto (`ADMIN_EMAILS` en Vercel) y documentá el resultado en la bitácora — el pasaje al mail
> de la empresa queda en backlog. Verificación Playwright + protocolo de cierre.

### PROMPT R3 — Granos (puntos 25–30)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloque D + respuestas §5 (preguntas
> 2 y 7). Cargá `ui-ux-pro-max`. Implementá: (25) arbitrajes con edición dual $/USD (recálculo
> cruzado con el TC del día), ↺ conservado, azul-manual/negro-auto, vol/OI a la derecha, precios
> más legibles, y el par "oficial online + BNA online" arriba a la derecha — creá el helper de
> BNA (`src/lib/` — mayorista − 9 según respuesta 2, con `tcBna` de CAC como valor confirmado);
> (26) filtro de liquidez compartido arbitrajes↔pases (extraer la regla OI<100 a una util, testear
> que AGO de soja/maíz desaparece de ambos); (27) caja con posiciones fijas soja NOV / maíz DIC /
> trigo DIC sobre cierres, ganador recuadrado, spread dispo–futuro; (28) capacidad: industria
> debajo de soja + emojis sorgo/girasol; (29) monitor: emojis únicos por posición + márgenes;
> (30) view: `ViewFeedback` gateado a admin dentro de la card + export según respuesta 7.
> Fórmulas: NO se toca ninguna (solo referencia/presentación); si un cambio parece pedir tocar
> una fórmula, frená y preguntá. Verificación Playwright con rueda abierta si es posible (para el
> camino "últ. operado") + protocolo de cierre.

### PROMPT R4 — Calculadoras: patrón + 7 calcs (puntos 38–44)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloque F + respuestas §5 (preguntas
> 2, 4 y 6). Cargá `ui-ux-pro-max`. Construí primero **`src/components/precio-dual.tsx`**
> (contrato en §2-F: grano → pizarra sugerida, $/USD cruzados por TC BNA, ↺, azul-manual) con
> tests de la lógica pura de conversión, y cablealo en a-fijar, por-porcentaje, pago-diferido y
> carry. Después, calc por calc: (38) a-fijar con posiciones canónicas + vigencia + WS/puntas con
> badge "estimado" + gráfico TNA implícita (combinado con delta si queda legible); (39)
> por-porcentaje (labels, rojo, jerarquía); (40) negocios-con-pagos (TC BNA default + 15hs
> confirmado, rojo, "días de anticipo", día de pago resaltado); (41) pago-diferido al patrón;
> (42) pases venta/compra con el SIGNO corregido (cercana − larga; test con el ejemplo ±10 del
> relevamiento) + cartel de pase negativo + "A fijar: (resultado − quita)" + jerarquía; (43) carry
> $/USD seleccionable; (44) costos oculto solo-admin según respuesta 6. El cambio de signo de
> pases es cambio de fórmula visible: confirmalo con el ejemplo numérico antes de mergear.
> Verificación Playwright + protocolo de cierre.

### PROMPT R5 — Estrategias + planta (puntos 45 y 47)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloque F (filas 45 y 47). Cargá
> `ui-ux-pro-max`. (45) Estrategias: glosario previo generado desde `PRESETS` (nombre +
> explicación + para qué sirve), selector segmentado por categorías nuevas mapeadas desde `view`
> (Alcistas / Bajistas / Techo asegurado / Piso asegurado / Rango / Volatilidad — proponé el mapeo
> completo de los 31 y dejalo como tabla en el código), sub eliminado, explicación destacada,
> resumen en línea y grande, texto "qué implica vender/lanzar y si es futuro u opción" al
> seleccionar, "estrategia personalizada" al tocar patas, precio base sugerido de A3 (con las
> opciones armadas sobre ese futuro), y ejes X/Y del payoff con ticks y valores. (47) Planta:
> sub eliminado, patrón `precio-dual` (reusa R4), secada fijo/no-fijo con valor por punto N
> (desplegable dinámico), "otros" repetible con +, layout visual, resultado en la moneda elegida
> dolarizando con BNA. Verificación Playwright + protocolo de cierre.

### PROMPT R6 — Dólar (puntos 31–36)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloque E + respuesta §5 pregunta 3.
> **Antes de tocar sintéticos: validá la fórmula contra el ejemplo numérico del Excel que pasó
> Lautaro (pregunta 3). Si no está contestada, hacé el resto del lote y dejá sintéticos
> explícitamente pendiente en la bitácora.** Implementá: (31) layout de futuro (tabla principal
> primero, gráfico grande abajo, sin "Datos de la curva"); (32) `chart-tabla.tsx` con props
> nuevas `maxFilas`/orden descendente aplicadas SOLO a los charts de /dolar + selector de rango
> (patrón `fg-chip`) en los gráficos de /dolar; (33) sacar "data912" de los kickers; (34)
> sintéticos según §2-E (solo tasa del sintético, anualizada por días al vto del FUTURO, letras
> de fin de mes una por mes, boncaps incluidos, sin columnas de comparación) con tests
> actualizados; (35) implícitas con las series linked + sintéticos + granos, sin tabla si excede
> ~30 filas; (36) cambiario (solo "Monedas", fila de volumen DL agregado, QueEsEsto sin el texto
> BCRA técnico, tabla 5-desc). Verificación Playwright + protocolo de cierre.

### PROMPT R7 — Gráficos + producción (puntos 48–50)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloques G y H. Cargá `ui-ux-pro-max`.
> (48) `/graficos`: default de campañas = solo la última; toggles "Todas"/"Últ. 3" con re-click
> que vuelve a la última; labels de presets en mayúscula; tabla descendente con la fila de "hoy"
> primera y resaltada en eje días-al-vto; KPIs más grandes entre gráfico y tabla; etiqueta de
> campaña en el extremo de cada línea. OJO: la URL persistida (`?c=`) hoy interpreta vacío=todas —
> mantené compatibilidad de links viejos. (49) Calendario: chips con semántica de filtro (click =
> solo ese; re-click = todos) y horizonte 60 días. (50) Estimaciones: misma semántica de chips +
> chips nuevos de organismo, país y campaña sobre la tabla. Verificación Playwright + protocolo.

### PROMPT R8 — Comercio: DJVE + empresas (puntos 52 y 55)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloque I (filas 52 y 55) + respuesta
> §5 pregunta 9. (52) DJVE por familias (maíz/soja/trigo/girasol/cebada+malta — construí el mapeo
> producto→familia desde los productos reales de `djve_resumen` y dejalo versionado), orden por
> volumen, fecha completa de última actualización arriba, sin la línea de ocultos. (55) Empresas:
> renombrar "Originado"→"Embarcado" y "Cobertura"→"Cumplimiento" (tabla de empresas, tabla por
> producto, KPI y headers del CSV), `ratioFmt` a % formato es-AR, filtro de 0 buques según
> respuesta 9. Verificación Playwright con bypass temporal admin (revertido, git limpio, como
> siempre) + protocolo de cierre.

### PROMPT R9 — Comercio: camiones (punto 53)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloque I fila 53. Cargá
> `ui-ux-pro-max`. Rediseño de `/comercio/camiones`: sello "Agroentregas" fuera del panel,
> márgenes, filtro por grano transversal a toda la página, tabla de empresas filtrable
> grano+empresa, UN solo gráfico Williams (selector de grano + zonas todas/elegidas) con overlay
> por campaña agregable/quitable (misma UX de chips que /graficos; la serie 2018→2026 de la tabla
> `camiones` se re-agrupa por campaña), histograma por empresa receptora, KPIs mantenidos,
> tablas colapsadas por default con máx una abierta (variante colapsable de ChartTabla — NO
> cambiar el default de los demás consumidores), y ¿Qué es esto? reescrito sin tecnicismos ni
> fuentes ni paths del repo. Antes de codear el layout final, pegá en el PR una maqueta
> (screenshot del prototipo) para el OK de Lautaro. Verificación Playwright + protocolo.

### PROMPT R10 — Comercio: puertos (punto 54)

> Leé `docs/ESTADO.md` + `docs/PLAN_RELEVAMIENTO_WEB.md` §2 bloque I fila 54. Cargá
> `ui-ux-pro-max`. Rediseño de `/comercio/puertos` hacia "qué varió", no "barco por barco":
> tablero único por producto con Δ vs día anterior y Δ vs semana anterior (ambos ya calculados en
> `foto.ts`) + corte por empresa (drill-down: click en producto/zona → empresas; requiere agregar
> la dimensión empresa×producto a `getFotoOperativa`), orden por volumen, badges salió/nuevo y
> colores mantenidos, buscador igual pero con total por zona al filtrar empresa, tabla de buques
> por ETB ascendente, márgenes izquierdos. **Lautaro pidió explícito chequear redundancias y
> preguntar ante dudas**: antes de codear, armá la propuesta de layout (qué se fusiona, qué
> desaparece) y pasásela por el PR o AskUserQuestion. Verificación Playwright (bypass temporal
> admin revertido) + protocolo de cierre.

## 4. Respuestas directas (cosas del relevamiento que ya tienen respuesta, sin código)

1. **(48) "¿El cálculo de cada campaña es contra la pizarra de ese momento o la actual?"** —
   Contra la **pizarra de cada momento histórico**. La pata pizarra sale de la tabla
   `pizarra_historico` (serie diaria 2020→hoy) y el join con el futuro es **fecha por fecha**
   (`series.ts:124-130` + `derivadas.ts::joinFfill`, forward-fill acotado a 3 ruedas). La pizarra
   actual no participa del cálculo histórico.
2. **(33) Detección de instrumentos dólar linked nuevos** — Ya es **automática**: la tabla no usa
   lista fija, filtra el feed completo de data912 con la regex `/^D\d/` en cada regeneración
   (~60s). Un D-linked nuevo aparece solo, sin tocar código ni rutina. Único hueco: si el ticker
   nuevo no matchea el formato de vencimiento (`vencFromTicker`), la fila queda sin días/TNA —
   se puede sumar un aviso al healthcheck (queda anotado en §6 como opcional).
3. **(16b) "El desplegable de admin solo visible para admins"** — Ya funciona así: el grupo Admin
   de la sidebar solo se renderiza si `esAdmin` (`sidebar.tsx:180`). Lautaro lo ve porque es
   admin. Sin cambio.

## 5. Preguntas y decisiones para Lautaro (TODAS acá, como pediste)

> **Contestadas el 29/07/2026 (por AskUserQuestion, antes de arrancar R1):** 1, 2, 5 y 8 —
> la respuesta quedó anotada debajo de cada una. **Contestada el 30/07/2026 (antes de R3):** 7.
> Las demás (3, 4, 6, 9, 10) siguen abiertas.

1. **Home (p20)** — Escribiste "Soja nov23 y mayo27". Asumo **NOV26 y MAY27**. ¿Correcto?
   **✅ R: NOV26 y MAY27.**
2. **BNA online (p25/40/47)** — El "dólar BNA online = oficial spot − 9": ¿el −9 es una constante
   fija que te sirve dejar en el código (editable solo por nosotros), o preferís poder cambiarla
   desde /admin? Y para el "TC BNA confirmado de las 15hs": CAC publica el BNA comprador del día
   y ya lo parseamos (`tcBna`, hoy sin usar) — ¿ese es el valor que querés como "confirmado"?
   **✅ R: constante en código, y sí — el `tcBna` de CAC como valor confirmado.**
3. **Sintéticos (p34)** — Antes de codear necesito **un ejemplo numérico del Excel REAL_TIME**
   (letra, precio, pago final, DLR del mes, resultado esperado de directa y TNA) para validar la
   fórmula 1:1 — regla de siempre. Y confirmame el criterio "vto cercano a fin de mes": ¿la letra
   con vencimiento más cercano al fin de cada mes, una sola por mes?
4. **A fijar (p38)** — Posiciones de trigo escribiste "dic enero marzo julio y septiembre
   diciembre": ¿son **DIC / ENE / MAR / JUL / SEP** (y el último "diciembre" repetía el primero)?
5. **Marca de agua (p14)** — ¿La sacamos del todo, o reemplazamos tu email por un texto neutro
   ("ROFO AGRO") para conservar el efecto anti-captura cuando haya clientes? Ojo: la marca de agua
   con el email de CADA usuario logueado era la protección anti-préstamo de cuentas del plan de
   login — hoy te muestra el tuyo porque sos el único logueado.
   **✅ R: "ROFO AGRO · email" para los clientes; los admins la ven vacía (sin marca).**
6. **Costos (p44)** — "Oculto solo para admin": ¿alcanza con que no aparezca en la sidebar ni en
   el índice de calculadoras y que la URL directa dé "sin acceso" para no-admins? (recomendado)
7. **View exportable (p30)** — ¿Te alcanza un botón "descargar PNG" en cada card del view
   (rápido), o lo querés como PDF con formato de informe (placa tipo informe diario, más trabajo)?
   **✅ R: PNG simple.**
8. **Cinta (p24)** — "Dejar todos los USD": hoy están Oficial (minorista), Mayorista, MEP, CCL y
   el futuro. Con "en el dólar oficial quiero el spot mayorista", ¿saco el minorista y "Oficial"
   pasa a ser el mayorista (queda una sola entrada), o dejo los dos?
   **✅ R: una sola entrada — "Oficial" = spot mayorista MAE.**
9. **Empresas 0 buques (p55)** — Al sacarlas se van también las que **declararon DJVE pero
   todavía no embarcaron** (hoy aparecen arriba porque son las que más "falta cubrir" tienen —
   dato de demanda futura). ¿Las sacamos igual, o dejamos solo las que no tienen NI buques NI
   declarado?
10. **Camiones/puertos (p53/54)** — Son los dos rediseños grandes. Propongo hacerlos en lotes
    propios (R9/R10) con **maqueta en el PR para tu OK antes de mergear**. ¿Te sirve así o querés
    ver bocetos antes de que arranque el lote?

## 6. Backlog (registrado en `auditoria/E7-sintesis.md` §4 como parte de C28)

- **Mail de la empresa**: el formulario de contacto manda a `ADMIN_EMAILS`
  (lautaroronchi97@gmail.com). Cuando exista la casilla de la compañía: actualizar la env var en
  Vercel + sumar el mail visible en la landing/footer ("ADEMÁS DE AGREGAR EL MAIL DE LA EMPRESA",
  punto 56). Sin código hasta tener la casilla.
- **Relevamiento pendiente (p56)**: páginas de mesa 🔒 (Señal física→precio, Mesa de embarque,
  Calor de mercadería, Negociado por producto), grupo Informes (diario/semanal/lecturas) y /admin
  completo — Lautaro las va a relevar a ojo y saldrá una tanda 2 de este mismo plan.
- **/produccion/zonas (p51)**: verificación visual de Lautaro pendiente (el panel de C23 quedó
  con 0 filas hasta que cargue el archivo real — ver ESTADO).
- **Opcional**: aviso en healthcheck si aparece un instrumento D* nuevo cuyo ticker no parsea
  `vencFromTicker` (§4.2).
