# PLAN — Operaciones diarias de clientes (posición comprado/vendido por empresa) — C31

> **Qué es esto.** Plan cerrado con Lautaro el 05/08/2026 (sesión de craneo, cero código de
> producto): una pantalla nueva donde **cada empresa cliente carga sus compras y ventas del día**
> (soja/maíz/trigo/girasol/sorgo) y ve su **posición neta comprado/vendido por producto × período
> de entrega**, con historia consultable día por día. Nace de una planilla que armó Mauro
> ("Posición Agroleaginosa", transcripta en §2) + 29 respuestas de Lautaro (§1). **La regla número
> uno del proyecto: cada empresa ve SOLO sus operaciones** — es la primera tabla del sistema con
> RLS por `empresa_id` y la primera donde los clientes ESCRIBEN (§4). Prompts de ejecución
> autocontenidos en **§8** (Fase 1: base + carga + registro diario) y **§9** (Fase 2: posición +
> heatmap + futuros valorizados). Modelo sugerido: **Sonnet** (regla de PLAN_BACKLOG); el juicio
> de diseño está tomado acá. Quedan 7 preguntas de segunda ronda en §7, **cada una con un default
> recomendado que aplica salvo que Lautaro diga lo contrario** — ninguna bloquea la Fase 1 excepto
> la fórmula de futuros (§7.5), que gatea SOLO el panel de futuros de la Fase 2.

## 1. Decisiones cerradas (05/08/2026, las 29 respuestas de Lautaro)

**Qué es una operación**
1. **Contraparte opcional** (+ N° de contrato y observaciones opcionales). Es dato comercial
   sensible del cliente: refuerza la exigencia de RLS (§4) y de no mostrar jamás datos de una
   empresa a otra.
2. **A-fijar y fijación son DOS registros separados.** El contrato a fijar se carga con volumen y
   SIN precio (cuenta volumen en la posición). La fijación, cuando sucede, es un **registro nuevo
   que genera precio y NO vuelve a sumar volumen** (si sumara, se duplicaría el neto). "Una cosa
   es el negocio a fijar y otra la fijación" (textual).
3. **Futuros A3 separados del físico**: la posición muestra físico / futuros / total como lecturas
   distintas (calzar físico con futuro es cobertura, no lo mismo que calzar físico con físico).
4. **Tipos de negocio**: `Disponible (entrega inmediata)` · `Forward (entrega futura)` ·
   `Fijación` · `Futuro A3`.
5. **Plazo de entrega = calendario con fecha de inicio y fin del negocio** (rango, no un período
   elegido de una lista). El período de la matriz se deriva de esas fechas (regla en §5.2 y
   pregunta §7.2).
6. **Condición = lista cerrada**: Carta de garantía · A fijar · A precio · Forward.
7. **Precio**: en $ o USD (moneda por operación) · puede no tener precio (a fijar) · puede ser
   **"pizarra"** (precio aún no conocido al cargar) · **descuento opcional** (ej. "pizarra −10%").
8. **Pizarra se completa sola al otro día** (el scraping de `pizarra_historico` ya corre 4×/día);
   mientras tanto el registro figura como "Pizarra (pendiente)" y **suma al pricing del día** (ya
   se sabe que tiene precio). Diseño elegido: resolución en lectura, sin proceso manual (§5.4).
9. **Campaña obligatoria** por operación (25/26 · 26/27 · …).
10. **Volumen en TN con 2 decimales**, y el formulario acepta la carga **en kg o en tn** (se
    guarda siempre tn; kg ÷ 1000).

**El tiempo**
11. **Modelo "libro mayor" confirmado**: cada operación es una fila con su fecha de concertación;
    registro del día, neto del día, posición acumulada y "posición a tal fecha" son vistas
    calculadas. El día siguiente arranca automáticamente con el saldo del anterior (es la suma).
12. **Sin carga de posición inicial por ahora** (queda en backlog derivado §10 — "en algún momento
    lo vamos a hacer").
13. **La posición NUNCA se cierra**: acumula todo lo concertado; lo entregado no se descuenta.
14. **Carga retroactiva permitida** (fecha de operación editable): modifica la posición acumulada
    desde esa fecha en adelante, como corresponde a un libro mayor.
15. **Historial de cambios SÍ** (quién tocó qué y cuándo — audit trail por trigger, §4.3).
16. **Borrado = anulación** (soft delete): la operación queda visible **tachada**, sale de todos
    los netos, y se puede restaurar. Sin DELETE físico (ni siquiera hay grant).

**Quién ve y quién toca**
17. **La posición es de la EMPRESA**: todos los usuarios de la misma empresa ven y editan las
    mismas operaciones.
18. **Los admins (Lautaro/Mauro) ven y editan TODO**, incluso cargar/corregir en nombre de un
    cliente si se lo piden (selector de empresa visible solo para admins, §5.6).
19. **Sin conflicto de privacidad**: los clientes ya saben que la mesa ve su posición y los
    asesora en base a eso.
20. **Sección nueva con permiso por empresa** (checkbox en `/admin`, como las 8 existentes). Sin
    empresa demo.

**Pantalla**
21. **Dos vistas**: "Mi posición" (acumulada) y "Registro diario" (carga + lo concertado en una
    fecha), detalle en §5.
22. **Chips de producto** (Todos/Soja/Maíz/Trigo/Girasol/Sorgo), mismo componente de filtro que ya
    usa el sitio.
23. **Heatmap comprado/vendido**: calendario producto × día con el neto del día en color (verde
    comprado / rojo vendido) para leer el patrón de un vistazo.
24. **Carga estricta de a un negocio** (formulario, no grilla). Se usa desde la PC de la
    administración (desktop-first; responsive igual, como todo el sitio).
25. **Export a Excel** (v1: CSV con BOM que Excel abre nativo — ver §7.6).

**Análisis**
26. Valorización del físico (promedios ponderados, spread del calce): **NO por ahora** (§10).
27. **Futuros A3 van además a una tabla propia de "posición de futuros" valorizada** contra el
    precio de ejecución (mark-to-market vs el ajuste del día). Fórmula en §5.5 — **a confirmar
    con ejemplo numérico antes de construir** (regla dura del proyecto).
28. **Sin alertas** de descalce ("lo vamos a ver nosotros").
29. **Sin umbral de "calzado"**: se muestra el neto tal cual; la lectura la hace el usuario.

## 2. La planilla de Mauro, transcripta (guía, no spec)

Archivo `Posicion_Agroleaginosa.xlsx` (pasado por el chat el 05/08). **NO se versiona en el repo**:
trae el nombre de un cliente real en títulos y ejemplos — la estructura completa queda transcripta
acá y no hace falta más (no es fixture de ningún parser: nadie va a leer este xlsx en el build).

- **Una hoja por día** (`04-08-26`, `05-08-26`, clonadas de una hoja `Plantilla`), con **COMPRAS y
  VENTAS en listados separados** (15 filas c/u). Columnas: `N° Ctto · Cliente [= la contraparte] ·
  Producto · Fecha Entrega · Período (auto) · Condición [texto libre: "Carta de Garantía",
  "A Fijar"] · Volumen (TN) · Precio (USD/TN) · Observaciones`.
- **`Período (auto)`** se deriva de la Fecha de Entrega: entrega dentro de los próximos 30 días →
  `Disponible`; si no → su mes (`Sep-26`); más allá de 8 meses → `Más adelante`. Las columnas de
  mes **rotan solas** (siempre los próximos 8 meses desde hoy).
- Cada hoja diaria arma 3 matrices **producto × período**: TOTALES COMPRAS · TOTALES VENTAS ·
  **NETO DEL DÍA** (+ comprado / − vendido).
- La hoja **`Posición`** acumula todas las hojas diarias listadas en "Hojas Activas" en una única
  matriz producto × período, con `TOTAL` por producto y `Estado`
  (`COMPRADOS` / `VENDIDOS` / `NEUTRO`).

**Qué se conserva del diseño de Mauro** (es bueno): la matriz producto × período como corazón de
la posición (un neto global por producto miente — podés estar "neto 0" y totalmente descalzado en
el tiempo) · compras y ventas como listados con las mismas columnas · el neto del día · el estado
por producto · las columnas de mes rodantes (próximos 8 + "Más adelante"). **Qué cambia**: el
modelo pasa de "una hoja por día que se suma" a **libro mayor** (§1.11) · la contraparte y el
N° Ctto son opcionales · la condición es lista cerrada · el precio suma moneda/pizarra/descuento ·
se agregan tipo de negocio, campaña, futuros A3, anulación con rastro e historial de cambios · el
"Disponible por 30 días vista" se reemplaza por una regla sin migración silenciosa (§7.2).

## 3. Lo que ya existe y se reusa (relevado 05/08/2026, con anclas)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| `empresas` / `profiles` | `supabase/migrations/20260716120000_create_auth_base.sql:11,21` | `empresas.secciones text[]` (permisos por sección) · `profiles.empresa_id` · `profiles.secciones_override` |
| `is_admin()` | mismo archivo `:60` | SECURITY DEFINER estable; molde exacto para el helper `mi_empresa_id()` nuevo |
| `protect_profile_fields()` | mismo archivo `:114` | patrón de trigger que impide a un no-admin tocar columnas protegidas |
| DAL server | `src/lib/auth/dal.ts` | `getPerfil()` (:37, trae `empresa_id`) · `getAcceso()` (:64) · `requireSeccion()` (:110) · `requireAdmin()` (:145) |
| `SECCIONES_META` | `src/lib/auth/config.ts:26` | las 8 claves de sección; acá se suma la 9ª: `operaciones` |
| Biblioteca/sidebar | `src/lib/biblioteca.ts` (`ITEMS_POR_SECCION` :90, `BIBLIOTECA` :102) | registrar el grupo nuevo alimenta sidebar + hub + breadcrumbs solos |
| Molde de escritura de un NO-admin | `src/app/auth/actions.ts:127` (`completarPerfil`) | server action con `createSupabaseServerClient()` (sesión del usuario, SIN service key) donde la RLS hace el enforcement — el único precedente del repo y el patrón a seguir |
| Patrón RLS "cerrado de verdad" | `supabase/migrations/20260721150000_mp3_views_mercado.sql:40-47` | enable RLS + revoke a `public, anon` + policy por rol; initplan con `(select …)` per `20260722013100` |
| Pizarra histórica | tabla `pizarra_historico` (baseline `:85-94`: `grano, fecha, precio_ars, precio_usd, es_estimativo`, PK (grano,fecha)) · cron `ingest-pizarra.yml` 10:30/10:45/11:05/18:06 ART | resuelve el precio "pizarra" de las operaciones sin ningún proceso nuevo |
| Curva y ajustes A3 | `src/lib/futuros.ts:68` (`getCierresGranos`, vista `futuros_cierres_ultimo`) · `src/lib/curva.ts:27` (`getCurvaGranos`) · `src/components/curva-picker.tsx` | posiciones vivas + ajuste del día para el panel de futuros; picker ya hecho para elegir posición |
| Filtro por grano | `src/components/filtro-grano.tsx` | los chips de producto (§1.22) |
| Export CSV | `src/components/chart-tabla.tsx:67` (`descargarCsv`, BOM `﻿`) y `src/components/lineup/embarques-csv.tsx:39` | patrón client-side listo para clonar |
| Admin | `src/app/admin/admin-tabs.tsx:6` (TABS) · checkboxes de secciones en `src/app/admin/empresas/empresa-editor.tsx:35-41` | el permiso nuevo aparece solo en el editor de empresas (deriva de `SECCIONES`) |

**Dato clave del relevamiento**: hoy NO existe ninguna tabla con RLS por `empresa_id` — las únicas
escrituras de `authenticated` común son `profiles` (self) y `access_log` (self). Esta feature
estrena el patrón por-empresa; por eso el diseño de §4 es explícito hasta el detalle.

## 4. Modelo de datos y seguridad (el corazón del proyecto)

### 4.1 Helper `mi_empresa_id()`

Clon del patrón `is_admin()` (SECURITY DEFINER para no recursar RLS sobre `profiles`):

```sql
create or replace function public.mi_empresa_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select empresa_id from public.profiles
  where id = auth.uid() and estado = 'aprobado';
$$;
revoke all on function public.mi_empresa_id() from public, anon;
grant execute on function public.mi_empresa_id() to authenticated;
```

Devuelve `null` si el usuario no está aprobado o no tiene empresa → ninguna policy matchea →
0 filas. Un usuario `bloqueado` o `pendiente` no ve ni escribe nada aunque conserve sesión.

### 4.2 Tabla `operaciones`

```sql
create table public.operaciones (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id),
  fecha          date not null,                    -- fecha de concertación (editable, retroactiva ok)
  lado           text not null check (lado in ('compra','venta')),
  producto       text not null check (producto in ('soja','maiz','trigo','girasol','sorgo')),
  tipo           text not null check (tipo in ('disponible','forward','fijacion','futuro_a3')),
  condicion      text     check (condicion in ('carta_garantia','a_fijar','a_precio','forward')),
  campania       text not null check (campania ~ '^[0-9]{2}/[0-9]{2}$'),   -- '25/26'
  volumen_tn     numeric(14,2) not null check (volumen_tn > 0),
  precio_modo    text not null check (precio_modo in ('manual','pizarra','sin_precio')),
  precio         numeric(14,2) check (precio > 0),  -- solo modo manual (o pizarra ya "pisada" a mano)
  moneda         text check (moneda in ('usd','ars')),
  descuento_modo text check (descuento_modo in ('pct','monto')),
  descuento      numeric(14,4) check (descuento >= 0),
  entrega_desde  date,                             -- inicio de entrega (forwards)
  entrega_hasta  date,                             -- fin de entrega
  posicion_a3    text,                             -- 'NOV26' — solo tipo futuro_a3
  operacion_ref  uuid references public.operaciones(id),  -- fijación → su contrato a fijar (opcional)
  contraparte    text,
  nro_contrato   text,
  observaciones  text,
  anulada        boolean not null default false,
  creado_por     uuid references public.profiles(id),
  creado_en      timestamptz not null default now(),
  actualizado_por uuid references public.profiles(id),
  actualizado_en  timestamptz not null default now(),

  -- coherencia dura (la UI valida antes, la base no deja pasar igual):
  constraint op_manual_completo   check (precio_modo <> 'manual'   or (precio is not null and moneda is not null)),
  constraint op_sin_precio_limpio check (precio_modo <> 'sin_precio' or precio is null),
  constraint op_pizarra_moneda    check (precio_modo <> 'pizarra'  or moneda is not null),
  constraint op_descuento_par     check ((descuento_modo is null) = (descuento is null)),
  constraint op_futuro_posicion   check (tipo <> 'futuro_a3' or (posicion_a3 is not null and precio_modo = 'manual')),
  constraint op_fijacion_precio   check (tipo <> 'fijacion'  or precio_modo = 'manual'),
  constraint op_forward_entrega   check (tipo <> 'forward'   or entrega_desde is not null),
  constraint op_entrega_orden     check (entrega_hasta is null or entrega_desde is null or entrega_hasta >= entrega_desde)
);

create index idx_operaciones_empresa_fecha    on public.operaciones (empresa_id, fecha desc);
create index idx_operaciones_empresa_producto on public.operaciones (empresa_id, producto);
```

Notas de diseño:
- **`empresa_id` referencia `empresas` con delete RESTRICT implícito** (sin `on delete`): no se
  puede borrar una empresa con operaciones — correcto, es su libro.
- `precio` guarda el precio en la `moneda` elegida, **sin conversión**: no se inventa un TC. La
  conversión para mostrar equivalentes queda para la fase de valorización (§10), donde la fórmula
  la define Lautaro.
- El **descuento** (ej. "pizarra −10%") vive en `descuento_modo`/`descuento` y se aplica al
  precio base al momento de mostrar (§5.4). Se admite también sobre precio manual (inofensivo y
  a veces pasa: "320 menos 2 USD de comisión").
- `posicion_a3` guarda solo la posición (`NOV26`), no el símbolo completo — el producto ya está en
  `producto` y el símbolo se reconstruye (`SOJ.ROS/NOV26`) con el mapa que ya usa `series-types`.
- `operacion_ref` deja **vincular la fijación con su contrato a fijar** (default §7.1). Es
  self-FK opcional: si el contrato no está cargado o es viejo, la fijación vive suelta.

### 4.3 Historial de cambios: `operaciones_log` + trigger

El rastro se escribe **por trigger, no por la app** — así queda registrado cualquier camino de
escritura (cliente, admin en nombre del cliente, service_role) sin depender de que cada server
action se acuerde:

```sql
create table public.operaciones_log (
  id           bigint generated always as identity primary key,
  operacion_id uuid not null,
  empresa_id   uuid not null,
  usuario_id   uuid,                -- auth.uid(); null si escribió service_role
  accion       text not null check (accion in ('crear','editar','anular','restaurar')),
  antes        jsonb,               -- fila completa previa (null en 'crear')
  despues      jsonb not null,      -- fila completa nueva
  en           timestamptz not null default now()
);
create index idx_operaciones_log_op on public.operaciones_log (operacion_id, en desc);
```

Trigger `AFTER INSERT OR UPDATE` sobre `operaciones` (función SECURITY DEFINER, dueña de la
escritura al log): `accion` = `crear` en INSERT; en UPDATE, `anular` si `anulada` pasó
false→true, `restaurar` si true→false, `editar` en el resto. `antes`/`despues` = `to_jsonb(OLD/NEW)`.
Además la función pisa `NEW.actualizado_en = now()` y `NEW.actualizado_por = auth.uid()` (columnas
de auditoría que el cliente no controla — mismo espíritu que `protect_profile_fields`).

### 4.4 RLS — el contrato de seguridad completo

```sql
alter table public.operaciones     enable row level security;
alter table public.operaciones_log enable row level security;

revoke all on public.operaciones     from public, anon;
revoke all on public.operaciones_log from public, anon;
grant select, insert, update on public.operaciones to authenticated;  -- SIN delete a propósito
grant select on public.operaciones_log to authenticated;              -- el log solo lo escribe el trigger

create policy op_select on public.operaciones for select to authenticated
  using ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()));
create policy op_insert on public.operaciones for insert to authenticated
  with check ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()));
create policy op_update on public.operaciones for update to authenticated
  using      ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()))
  with check ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()));

create policy oplog_select on public.operaciones_log for select to authenticated
  using ((select public.is_admin()) or empresa_id = (select public.mi_empresa_id()));
```

Capas, de adentro hacia afuera:
1. **Postgres (la garantía real)**: aunque un cliente pegue directo a PostgREST con su JWT, solo
   ve/escribe filas de SU empresa. El `with check` de UPDATE impide "mudar" una operación a otra
   empresa. Sin grant de DELETE, borrar es imposible incluso queriendo (anular = UPDATE).
   Subselects `(select …)` por el fix de initplan ya aplicado al resto del esquema
   (`20260722013100`).
2. **Server actions**: patrón `completarPerfil` — `createSupabaseServerClient()` con la sesión
   del usuario, **nunca la service key**. Regla de oro: para un cliente, el `empresa_id` se toma
   SIEMPRE de `getPerfil()` en el server, **jamás del formulario**; el selector de empresa solo
   existe para admins (y aún si un cliente lo forjara, la RLS lo rebota).
3. **Página**: `requireSeccion("operaciones")` + filtro de sidebar por permisos (automático al
   registrar la sección). El permiso por sección es capa de producto (a quién se lo vendieron),
   no la capa de seguridad — la seguridad es la RLS.
4. **Verificación obligatoria en el build (§8)**: probar por SQL con DOS empresas sintéticas que
   A no ve ni edita lo de B, en los dos sentidos, y borrar los datos de prueba al terminar.

### 4.5 Sección nueva de permisos

- `SECCIONES_META` (`config.ts:26`) suma `{ key: "operaciones", label: "Mis operaciones",
  href: "/operaciones" }` → aparece sola en los checkboxes de `/admin/empresas`, en
  `seccionDeRuta()` y en el registro de visitas.
- `biblioteca.ts`: grupo nuevo con 2 ítems — Posición (`/operaciones`) y Registro diario
  (`/operaciones/registro`). Sin `soloMesa` (es una sección de clientes, gateada por permiso).
- Empresas existentes arrancan SIN el permiso (default `'{}'` no cambia): se habilita
  cliente por cliente desde `/admin`, como pidió §1.20.

## 5. Lógica de negocio y pantallas

### 5.1 Reglas del neto (lib pura `src/lib/operaciones/posicion.ts`, con tests)

- Se excluyen las **anuladas**.
- Signo: compra `+`, venta `−`.
- **Las fijaciones NO suman volumen** (§1.2) — aparecen en el registro del día y en el pricing,
  nunca en la matriz de posición.
- **Físico** = `disponible` + `forward`. **Futuros** = `futuro_a3`, aparte. **Total** = ambos.
- La matriz por producto tiene TOTAL por fila y `Estado` (COMPRADOS / VENDIDOS / NEUTRO), como la
  hoja Posición de Mauro.
- "Posición a fecha X" = mismo cálculo filtrando `fecha <= X`. "Neto del día X" = filtrando
  `fecha = X`.

### 5.2 Buckets de período (columnas de la matriz)

Columnas rodantes como en la planilla: `Disponible · [mes actual+1 … mes actual+8] · Más
adelante`, siempre relativas a hoy.

- `tipo = disponible` → **Disponible**.
- `tipo = forward` → columna del **mes de `entrega_desde`**; si `entrega_desde <= hoy` (la
  entrega ya arrancó) → **Disponible**; si cae más allá de 8 meses → **Más adelante**.
- `tipo = futuro_a3` → columna del mes de la **posición** (`NOV26` → Nov-26), en la sección
  Futuros.
- **Sin la regla "30 días vista" de la planilla** (default §7.2): un forward de octubre se queda
  en Oct hasta que octubre llega — la posición no cambia sola de columna de un día para otro sin
  que nadie haya cargado nada (solo "cae" a Disponible cuando la entrega efectivamente arranca,
  que es información, no ruido).

### 5.3 Rango de entrega vs matriz

La matriz bucketea por `entrega_desde` (§7.2). El rango completo (`desde–hasta`, ej. entrega
"contractual" larga) se muestra en la fila de la operación y en el tooltip de la celda; no parte
el volumen entre meses (partir 500 tn "Sep–Dic" en 4 columnas inventaría una distribución que el
contrato no dice).

### 5.4 Precio pizarra: resolución en lectura (cero proceso manual)

Una operación `precio_modo = 'pizarra'` **no guarda precio**: al mostrar, se resuelve contra
`pizarra_historico(grano = producto, fecha = fecha de la operación)` en la `moneda` elegida
(`precio_ars` / `precio_usd`), aplicando el descuento (`pct`: `base × (1 − d/100)` · `monto`:
`base − d`). Mientras la pizarra de ese día no exista todavía, la fila muestra **"Pizarra
(pendiente)"** — y cuenta como "con precio" en el pricing del día (§1.8). Apenas el cron la
ingesta (corre 10:30/10:45/11:05/18:06 ART), el precio aparece solo, sin que nadie complete nada
— cumple la regla del proyecto "Lautaro no corre procesos a mano", y vale también para los
clientes. Si la pizarra real difiere de lo pactado, cualquier usuario de la empresa (o un admin)
**la pisa editando la operación a modo manual** (queda en el historial §4.3). Girasol y sorgo
también tienen pizarra CAC (`CLASES` de `pizarra.ts:22` ya trae GIR y SOR).

> Pregunta §7.3: confirmar que la referencia es la pizarra Rosario (CAC) **del día de la
> operación**.

### 5.5 Panel "Posición de futuros" valorizada (Fase 2 — fórmula a confirmar)

Tabla con las operaciones `futuro_a3` vivas (no anuladas): posición · lado · tn · precio de
ejecución · **ajuste de hoy** (vista `futuros_cierres_ultimo`, mismo origen que Arbitrajes) ·
resultado. Fórmula propuesta, **que Lautaro debe confirmar con este ejemplo antes de que se
escriba una línea** (regla dura de fórmulas):

```
resultado_usd = (ajuste_hoy − precio_ejecucion) × volumen_tn × signo   (signo: compra +1, venta −1)
```

Ejemplo: compra de 300 tn `SOJ NOV26` a 320,00 USD/tn; ajuste de hoy 328,50 →
`(328,50 − 320,00) × 300 × (+1) = +2.550,00 USD`. La misma operación vendida daría −2.550,00.
Con posición vencida (ya no está en `futuros_cierres_ultimo` vivo) la fila degrada honesta a "sin
ajuste vigente", sin inventar precio. Total por producto y total general al pie. Los contratos A3
son de 100 tn (`CONTRATO_GRANO_TN`, `futuros.ts:56`): la carga es en tn y la UI avisa (sin
bloquear) si el volumen no es múltiplo de 100.

### 5.6 Las dos páginas

**`/operaciones` — "Mi posición"** (índice de la sección)
1. Chips de producto (Todos + 5).
2. **Matriz Físico** producto × período (+ TOTAL + Estado), estilo hoja "Posición".
3. **Matriz Futuros** (misma forma) y fila **Total** físico+futuros — §1.3.
4. **Panel de futuros valorizados** (§5.5, Fase 2).
5. **Heatmap comprado/vendido**: filas = productos, columnas = últimos 30 días (ventana
   elegible), celda verde/roja/gris según el neto del día; click en una celda → lleva al registro
   de ese día. (Fase 2.)
6. Selector "**Posición al**: [fecha]" para reconstruir la posición a un cierre pasado (Fase 2).
7. Export CSV de la matriz.
8. **Solo admins**: selector de empresa arriba de todo ("Viendo: Agroleaginosa ▾") — la misma
   página sirve de vista de mesa, sin duplicar nada en `/admin` (§1.18). Para clientes ese
   selector NO se renderiza y el server ignora cualquier intento de pasarlo por URL.

**`/operaciones/registro` — "Registro diario"**
1. Date picker (default hoy) + chips de producto.
2. **Formulario de carga** (de a UNA operación, §1.24): lado (compra/venta) · producto · tipo ·
   condición · campaña · volumen (toggle tn/kg) · precio (modo: manual $/USD · pizarra ·
   sin precio) · descuento opcional (% o monto) · entrega desde/hasta (calendario) · posición A3
   (con `CurvaPicker` y precio de ajuste sugerido cuando tipo = futuro) · para fijaciones:
   selector opcional del contrato a fijar abierto (§7.1) · contraparte / N° ctto / observaciones.
   La fecha de concertación es editable (retroactiva ok, §1.14).
3. **Compras y Ventas del día en listados separados** (como Mauro), con las anuladas tachadas y
   togglables ("mostrar anuladas").
4. **Neto del día** producto × período al pie (la 3ª matriz de la hoja diaria de Mauro).
5. Editar (abre el mismo formulario) · Anular / Restaurar (con confirmación) · historial de
   cambios por operación (desplegable, lee `operaciones_log`).
6. Export CSV del día.

## 6. Qué NO entra en v1 (para que el build no lo invente)

Sin posición inicial (§1.12) · sin valorización del físico ni promedios ponderados (§1.26) · sin
alertas (§1.28) · sin umbral de calzado (§1.29) · sin conversión de moneda con TC · sin carga
multi-fila ni import de Excel · sin mezcla físico+futuros en un solo neto · sin vista para el
scoring de clientes (aunque estos datos son su insumo futuro — `negocio/03`).

## 7. Preguntas de segunda ronda (con default que aplica si no decís lo contrario)

1. **Vínculo fijación ↔ contrato a fijar.** Default: **opcional** — al cargar una fijación se
   puede elegir de una lista de contratos a-fijar abiertos de la misma empresa y producto (para
   después leer "fijaste 100 de las 300"), o dejarla suelta. No se valida que la suma de
   fijaciones no supere el contrato (v1 informativo, no contable).
2. **Regla del bucket "Disponible".** Default: tipo disponible siempre; forward → cae a
   Disponible recién cuando `entrega_desde <= hoy` (§5.2). Se abandona el "próximos 30 días
   vista" del Excel de Mauro para que la posición no migre sola de columna sin carga de por
   medio. ¿Ok?
3. **Pizarra de referencia.** Default: pizarra **Rosario (CAC)** — la única que ingesta la web —
   del **día de la fecha de la operación**, en la moneda elegida. ¿Confirmás día y cámara?
4. **Descuento.** Default: dos modos — `%` (pizarra −10%) o `monto` en la moneda de la operación
   (pizarra −10 USD) — y disponible también sobre precio manual.
5. **⚠️ Fórmula de valorización de futuros (§5.5).** ÚNICA pregunta que gatea un build (el panel
   de futuros de la Fase 2; el resto de la Fase 2 no depende). Confirmá el ejemplo numérico de
   §5.5 o pasá el tuyo.
6. **Export "Excel".** Default v1: **CSV con BOM** (doble click y Excel lo abre con acentos bien,
   patrón ya existente en el sitio). Un `.xlsx` real de verdad (con formato, varias hojas) es
   construible pero es un módulo nuevo de escritura — lo dejo en backlog derivado (§10) salvo que
   lo quieras ya.
7. **Campañas del selector.** Default: se ofrecen las 3 vigentes alrededor de hoy (24/25 · 25/26 ·
   26/27, calculadas, rotan solas) + campo libre validado `AA/AA` por si hace falta otra.

## 8. PROMPT DE EJECUCIÓN — FASE 1 (base + carga + registro diario)

> Copiar entero en una sesión nueva (Sonnet). Asume `main` al día. Un PR, base `main`, draft
> hasta verificar.

---

Sos una sesión de build del repo ROFOAGRO_RESEARCH_WEB. Leé `docs/ESTADO.md`, la última entrada
de `docs/sesiones/` y **`docs/PLAN_OPERACIONES_CLIENTES.md` COMPLETO** (este plan): ejecutás su
**Fase 1**. Reglas duras: rama `claude/*` desde `main` · commits chicos · `npm run lint` + `npx
tsc --noEmit` + `npx vitest run` + `npm run build` antes de pushear · migraciones versionadas en
`supabase/migrations/` **SIN aplicar** (las aplica el orquestador por MCP con OK de Lautaro; tu
código debe degradar honesto si la tabla no existe) · cero cambios de fórmulas existentes · cargá
la skill `ui-ux-pro-max` antes de tocar UI.

**Alcance Fase 1**
1. **Migración** `supabase/migrations/<ts>_c31_operaciones_clientes.sql` con TODO §4 del plan:
   `mi_empresa_id()` + tabla `operaciones` (DDL exacto de §4.2, con TODOS los constraints) +
   `operaciones_log` + trigger de auditoría (§4.3, SECURITY DEFINER, pisa
   `actualizado_en/actualizado_por`) + RLS/grants/policies EXACTOS de §4.4 (subselect en
   `is_admin()`/`mi_empresa_id()` por initplan; SIN grant de delete; log solo-lectura).
2. **Sección nueva** `operaciones` en `SECCIONES_META` (`src/lib/auth/config.ts:26`) + grupo "Mis
   operaciones" en `src/lib/biblioteca.ts` (`ITEMS_POR_SECCION` :90) con Posición (`/operaciones`)
   y Registro diario (`/operaciones/registro`). Verificá que los checkboxes de
   `/admin/empresas` la levantan solos (derivan de `SECCIONES`).
3. **Libs**: `src/lib/operaciones/tipos.ts` (tipos + labels de tipo/condición/moneda/modos) ·
   `src/lib/operaciones/registro.ts` (lib PURA testeada: normalización kg→tn a 2 decimales,
   validación de una operación — los mismos checks de §4.2 en TS para errores amigables antes de
   pegar a la base, campañas del selector §7.7, resolución de precio §5.4 dado un precio de
   pizarra — la parte de datos va aparte) · `src/lib/operaciones/datos.ts` (`server-only`:
   lecturas con `createSupabaseServerClient()` — NUNCA `sbSelect`/service key, acá la RLS ES el
   producto — trayendo operaciones por empresa+rango de fechas, y pizarras de
   `pizarra_historico` para las fechas visibles).
4. **Server actions** `src/app/(site)/operaciones/actions.ts` (patrón `completarPerfil`,
   `src/app/auth/actions.ts:127`): `crearOperacion` · `editarOperacion` · `anularOperacion` ·
   `restaurarOperacion`. Para clientes, `empresa_id` sale de `getPerfil()` en el server (JAMÁS
   del form); para admins (`getAcceso().esAdmin`) se acepta `empresaId` explícito. Gate:
   `requireSeccion("operaciones")` en páginas + chequeo de acceso en cada action.
   `revalidatePath` de las 2 páginas.
5. **Página `/operaciones/registro`** completa según §5.6 (formulario de a una operación con
   todos los campos, incl. `CurvaPicker` + ajuste sugerido para futuros y selector opcional de
   contrato a fijar para fijaciones; listados Compras/Ventas del día; anuladas tachadas; neto del
   día producto × período usando §5.1-5.2; date picker de día; historial por operación; export
   CSV patrón `chart-tabla.tsx:67`; chips con `filtro-grano.tsx` extendido a girasol/sorgo SOLO
   acá — no toques sus otros consumidores; selector de empresa solo-admin §5.6.8).
6. **Página `/operaciones`** en Fase 1 = versión mínima: matrices Físico/Futuros/Total de §5.1-5.2
   + export CSV (heatmap, posición-a-fecha y panel valorizado son Fase 2). Así el PR ya deja la
   sección usable de punta a punta.
7. `docs/sesiones/<fecha>-c31-fase1-operaciones.md` + actualizar `ESTADO.md` («Ahora») + tachar
   lo que corresponda en `E7-sintesis.md` §4 (C31).

**Verificación obligatoria** (además de lint/tsc/vitest/build): tests de la lib pura con casos de
§5.1-5.2 (fijación no suma volumen · anulada excluida · kg→tn · buckets con entrega pasada/8+
meses · retroactiva) · **RLS probada por SQL en los dos sentidos** en cuanto la migración esté
aplicada — 2 empresas sintéticas + 1 usuario de cada una: A no SELECTea ni UPDATEa filas de B, el
INSERT con `empresa_id` ajeno rebota, DELETE rebota por falta de grant, el log registra
crear/editar/anular — y **borrá TODOS los datos de prueba al terminar** (patrón fecha `2099-*`,
confirmación por `count=0`) · Playwright real claro/oscuro/mobile con bypass temporal si hace
falta (revertido, `git diff` limpio) · si la migración no se aplicó aún en tu sesión, las páginas
deben responder 200 degradando honesto (sin 500) — probalo.

---

## 9. PROMPT DE EJECUCIÓN — FASE 2 (posición completa + heatmap + futuros valorizados)

> Requiere Fase 1 mergeada Y las respuestas de §7 (en particular §7.5 — si la fórmula de futuros
> sigue sin confirmar, construí todo salvo el panel valorizado y dejalo anotado).

---

Sos una sesión de build del repo ROFOAGRO_RESEARCH_WEB. Leé `docs/ESTADO.md`, la última entrada
de `docs/sesiones/` y **`docs/PLAN_OPERACIONES_CLIENTES.md` COMPLETO**: ejecutás su **Fase 2**
sobre la sección `/operaciones` ya construida por Fase 1. Mismas reglas duras que el prompt §8.

**Alcance Fase 2**
1. **`/operaciones` completa** (§5.6): posición al [fecha] (selector que reconstruye la matriz a
   un cierre pasado, `fecha <= X` — §5.1) · **heatmap producto × día** (últimos 30 días, ventana
   elegible; verde = neto comprado, rojo = vendido, gris = sin movimientos; click → registro de
   ese día; reusá tokens `--pos`/`--neg` y el motor ECharts `RfChart` si aplica, o celdas HTML si
   queda más legible — decisión tuya, documentala) · Estado por producto (COMPRADOS/VENDIDOS/
   NEUTRO).
2. **Panel "Posición de futuros" valorizado** (§5.5, SOLO si Lautaro confirmó la fórmula en §7.5;
   registrá la confirmación en la bitácora): ajuste de hoy vía `getCierresGranos()`
   (`futuros.ts:68`), degradación honesta si la posición ya no está viva, totales por producto,
   aviso suave si tn no es múltiplo de 100.
3. **Resolución de pizarra en todas las vistas** (§5.4): las filas modo pizarra muestran el precio
   resuelto (con descuento aplicado y sello "Pizarra CAC dd/mm") o "Pizarra (pendiente)". Nada se
   escribe en la base para esto.
4. Export CSV de la posición y del heatmap.
5. Bitácora + `ESTADO.md` + C31 en `E7-sintesis.md` §4.

**Verificación obligatoria**: mismas de §8 (tests de posición-a-fecha y heatmap con fixtures que
crucen meses; RLS re-verificada con las páginas nuevas; Playwright claro/oscuro/mobile; datos de
prueba borrados con `count=0`). Cotejá a mano la matriz contra una suma SQL independiente de las
mismas filas, y el panel de futuros contra el ejemplo numérico confirmado de §5.5.

---

## 10. Backlog derivado (NO es v1 — se registra, no se construye)

- **Posición inicial / carga de stock de arranque** por producto-período (§1.12, "en algún
  momento").
- **Valorización del físico**: promedio ponderado de compras vs ventas, spread del calce,
  equivalentes de moneda con TC (fórmulas de Lautaro mediante).
- **Export `.xlsx` real** (con formato y varias hojas) si el CSV queda corto (§7.6).
- **Alertas de descalce** (§1.28) — hoy explícitamente no.
- **Umbral/banda de "calzado"** configurable (§1.29).
- **Carga multi-fila / import de la planilla** para clientes que vienen de Excel.
- **Scoring de clientes** (`negocio/03`, P12): estos datos son exactamente su insumo — cuando se
  retome, ya hay libro por empresa con historial.
- **Mobile-first de la carga** si algún cliente empieza a cargar desde el celular (§1.24 dice PC
  por ahora).
