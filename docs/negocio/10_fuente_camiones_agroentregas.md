# Fuente — Camiones en puerto de Agroentregas (por planta y empresa)

> **Research + build de C24** del backlog maestro ([`auditoria/E7-sintesis.md`](../auditoria/E7-sintesis.md) §4),
> ejecutado el **28/07/2026** con requests reales. Complementa —no reemplaza— a
> [`08_fuente_camiones_puerto.md`](08_fuente_camiones_puerto.md) (SAGyP, descartada) y a la fuente
> vigente Williams Entregas, y es independiente de la señal de
> [`09_camiones_vs_lineup_senal.md`](09_camiones_vs_lineup_senal.md).

## TL;DR

**C24 no es una carga manual: es una ingesta automática.** El ítem del backlog nació como "cargar a
mano el total diario que Agroentregas postea en su cuenta de X, mismo patrón que Compras BCRA". El
research lo mejoró: la página pública `agroentregas.com.ar/total-de-camiones.html` se alimenta de un
**endpoint JSON abierto, sin auth ni key**, que devuelve exactamente la placa que postean **y con más
detalle: por planta, por empresa y por grano**. Cero carga manual.

**Pero no es el total nacional.** Su universo son las ~28 plantas de Up River y del Paraná bonaerense
que Agroentregas atiende: **no hay Bahía Blanca ni Necochea**. Por eso vive en su propia tabla
(`camiones_plantas`) y nunca se mezcla con `camiones` (Williams, 4 zonas = todo el país).

## El endpoint

```
GET https://agroentregas.com.ar/RestServiceImpl.svc/camiones
```

Sin auth, sin key, sin cookie. Es el mismo que la página llama desde el navegador (se lo encuentra en
el `<script>` de `total-de-camiones.html`, junto al botón "Descargar" que arma un .xlsx client-side
con `xlsx.full.min.js`). Devuelve el JSON **envuelto en un sobre XML de WCF**:

```xml
<CamionesResponse xmlns="http://tempuri.org/"><CamionesResult>{"Camiones":[...],...}</CamionesResult></CamionesResponse>
```

### Las 9 colecciones (3 bloques de 3)

| Colección | Contenido |
|---|---|
| `Camiones` | **HOY**, detalle por planta **con empresa** (`nombreDe`) ← la que se usa |
| `Camiones1` | ídem sin empresa (duplicado, se ignora) |
| `Camiones2` | fila de **totales por grano** de hoy ← control de consistencia |
| `Camiones3` / `Camiones4` / `Camiones5` | ídem, **hace 1 año** |
| `Camiones6` / `Camiones7` / `Camiones8` | ídem, **hace 2 años** |

Campos del detalle: `fecha`, `idDp` (id de planta, estable entre años — verificado), `nombreDp`
(planta), `idDe`/`nombreDe` (**empresa**), `GIRASOL`, `SOJA`, `TRIGO`, `MAIZ`, `SORGO`, `CEBADA`,
`OTROS`, `OBSERVACION` (`'SIN CAMIONES'` cuando la planta reportó en cero).

### Verificación 1:1 contra la placa (28/07/2026)

Lautaro pasó la captura que publica Agroentregas ese día; el endpoint la reproduce exacto, **las
tres filas del encabezado incluidas**:

| Fecha | Girasol | Soja | Trigo | Maíz | Sorgo | Cebada | Otros | **Total** | Ton aprox. |
|---|---|---|---|---|---|---|---|---|---|
| 28/07/2026 | 96 | 1.460 | 457 | 2.413 | 87 | 47 | 0 | **4.560** | 145.920 |
| 29/07/2025 | 105 | 1.429 | 235 | 841 | 212 | 24 | 0 | **2.846** | 91.072 |
| 30/07/2024 | 23 | 1.557 | 105 | 1.515 | 51 | 42 | 32 | **3.325** | 106.400 |

La columna "TON APROX." de la placa es **total × 32 tn** (verificado en las 3 filas) — derivable, no
se persiste.

### Dos propiedades que definieron el diseño

1. **No admite backfill.** Probado: `?fecha=2026-07-27` devuelve igual el día en curso — el endpoint
   ignora cualquier parámetro. Es una foto de hoy. Tampoco sirve Wayback: la página se arma por JS,
   así que el HTML archivado no tendría los números.
2. **Los comparativos SON la historia.** Los bloques de hace 1 y 2 años no son la misma fecha
   calendario sino **el mismo día de la semana** (28/07/2026, 29/07/2025 y 30/07/2024 son los tres
   martes) — lo correcto para un flujo logístico, donde pesa más si es martes o domingo que el número
   del día. La ingesta guarda **los tres bloques**: corriendo el cron a diario, al cabo de un año hay
   tres años de estacionalidad de Up River sin haber backfilleado nada. *(Ojo al leerlos: la distancia
   es de 364 días —52 semanas— en el caso verificado, pero según cómo caiga el calendario puede ser
   371; `plantas.ts` busca el comparativo en una ventana de ±1 semana en vez de clavar un número.)*

## Alcance geográfico (el caveat importante)

Los 28 destinos del 28/07/2026, todos **Up River** (ACA San Lorenzo/Timbúes, ADM Arroyo Seco/PGSM,
AGD Timbúes, Bunge PGSM/San Jerónimo, Cargill Alvear/Quebracho-PGSM, COFCO PGSM/Timbúes, Dreyfus
Gral. Lagos/Timbúes, Vicentin, Molinos San Lorenzo, Renova, Terminal 6, U6, Molino Chabás, Aceitera
Chabás, Semino, Villa Constitución) o **Paraná bonaerense** (Arcor y Terminal Puerto San Pedro,
Baradero/Ingredion, Bunge Ramallo, COFCO Lima).

**No aparecen Bahía Blanca ni Necochea**, y solo están las plantas que Agroentregas atiende. Por eso:

| | **Williams Entregas** (C5, tabla `camiones`) | **Agroentregas** (C24, tabla `camiones_plantas`) |
|---|---|---|
| Cobertura | 4 zonas = **todo el país** (incluye Bahía Blanca y Necochea) | Up River + Paraná bonaerense |
| Detalle | zona × producto | **planta × empresa × grano** |
| Historia | **2018→hoy** (42.624 filas cargadas) | desde que arrancó el cron |
| Frecuencia | carga manual, irregular | **automática, 2×/día** |
| Rol | serie nacional e histórica; alimenta el **percentil estacional** de la señal barcos-vs-camiones | pulso diario y "quién está levantando" |

**No se mezclan.** La señal de `09` necesita años de historia y sus dos patas son Gran Rosario **y
Bahía Blanca**; migrarla a esta fuente la rompería. Williams queda como respaldo nacional (sin apuro
de carga, porque el día a día ya lo cubre esto).

## Lo que aporta y nadie más da: la apertura por empresa

`nombreDe` permite armar el ranking "**qué exportador recibió camiones hoy**" — se cruza con el
roster `shipper_norm` del line-up. Ejemplo real del 28/07/2026 (los 17 exportadores suman exacto los
4.560): Cargill 676 (14,8%) · Bunge 662 · ACA 477 · Renova 446 · LDC 391 · ADM 387 · Molinos 350 ·
COFCO Int. 334 · COFCO Arg. 313 · Vicentin 145 · Arcor 103 · ADM Arg. 96 · Ingredion 60 · AGD 51 ·
Molino Chabás 35 · Varios 33 · Semino 1.

Decisión de producto: la serie por grano es **pública**; la apertura por empresa/planta se muestra
**solo a la mesa** (mismo criterio que la señal barcos-vs-camiones en esa página). No es un secreto
—el dato está abierto en la web de origen— sino dónde tiene valor de research.

## Implementación

| Pieza | Archivo |
|---|---|
| Parser puro (+ control de consistencia) | `src/lib/camiones/agroentregas.ts` (11 tests con fixture real) |
| Ingesta | `scripts/ingest-camiones-agroentregas.mjs` (importa el parser, no lo reimplementa) |
| Cron | `.github/workflows/ingest-camiones-agroentregas.yml` — **2×/día, todos los días** |
| Tabla | `camiones_plantas` (migración `20260728150000`) |
| Capa de datos | `src/lib/camiones/plantas.ts` |
| Panel | `src/components/camiones/plantas-panel.tsx` en `/comercio/camiones` |
| Healthcheck | `camiones_plantas (Agroentregas)`, umbral **3 días** |

**Por qué dos corridas diarias (18:00 y 22:00 ART) y todos los días.** El endpoint es la foto del día
*en curso* y el total crece mientras entran camiones: una vez que la fuente pasa de fecha, el día de
ayer ya no se puede corregir nunca. La corrida tardía toma el día casi cerrado; la temprana es la red
de seguridad. Como el upsert va por `(fecha, planta, producto)` **con la fecha que dicta la propia
respuesta**, repetir corridas es idempotente y la última gana. Corre también fines de semana: los
puertos reciben los sábados, y un domingo flojo es dato real.

**Guards (espíritu de D7/L7).** El parser exige que la suma del detalle por planta dé **exacto** la
fila de totales que publica la propia fuente; si no cierra, la corrida falla en vez de guardar un día
a medias (que después es indistinguible de un día flojo de verdad). Además: 0 camiones en el día en
curso = error (no existe ni un domingo), y falta de cualquiera de las 9 colecciones = error.

**Granularidad de las filas.** Una por `(fecha, planta, grano)` **solo si ese grano tuvo camiones**
(clave ausente = 0) + una `producto='TOTAL'` por planta **siempre, aunque sea 0** — así "la planta
reportó sin camiones" queda distinguible de "no reportó ese día". ~85 filas/día.
`cantidad` = **cantidad de camiones**, no toneladas.
