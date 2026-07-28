-- C24 del backlog maestro (docs/auditoria/E7-sintesis.md §4) — camiones en puerto de
-- **Agroentregas**, apertura por PLANTA y por EMPRESA. Research y verificación de la fuente:
-- docs/negocio/10_fuente_camiones_agroentregas.md.
--
-- El ítem del backlog nació como "carga manual diaria desde la cuenta de X de Agroentregas, mismo
-- patrón que Compras BCRA". El research (28/07/2026) lo mejoró: la página pública
-- agroentregas.com.ar/total-de-camiones.html se alimenta de un endpoint JSON abierto
-- (RestServiceImpl.svc/camiones, sin auth ni key) que trae exactamente la placa que Agroentregas
-- postea, y con MÁS detalle: planta, empresa y grano. Así que C24 no es carga manual: es una
-- ingesta automática más (scripts/ingest-camiones-agroentregas.mjs, cron diario).
--
-- ⚠️ POR QUÉ ES UNA TABLA APARTE Y NO FILAS DE `camiones`
-- `camiones` (C5) es Williams Entregas: 4 zonas que cubren TODO el país (incluidas Bahía Blanca y
-- Necochea) con historia 2018→hoy, y es la serie que alimenta el percentil estacional de la señal
-- barcos-vs-camiones. Este feed es OTRO universo: 28 plantas de Up River + Paraná bonaerense, SIN
-- Bahía Blanca ni Necochea, y solo las plantas que Agroentregas atiende — su total NO es comparable
-- con el nacional de Williams. Mezclarlos contaminaría la señal. Conviven: Williams = respaldo
-- nacional e histórico (carga manual, sin apuro); Agroentregas = pulso diario de Up River, solo.
--
-- Granularidad de las filas (la arma src/lib/camiones/agroentregas.ts):
--   * una fila por (fecha, planta, grano) SOLO si ese grano tuvo camiones — clave ausente = 0;
--   * una fila producto='TOTAL' por planta SIEMPRE, incluso en 0 — así "la planta reportó sin
--     camiones" (la fuente lo marca 'SIN CAMIONES') queda distinguible de "no reportó ese día".
-- Son ~85 filas por día. `cantidad` = CANTIDAD DE CAMIONES, no toneladas (la placa muestra un
-- "TON APROX." que es simplemente total × 32 tn — derivable, no se persiste).

create table if not exists public.camiones_plantas (
  fecha      date not null,
  planta_id  text not null,
  planta     text not null,
  empresa    text not null,
  producto   text not null check (producto in ('SFSEED', 'SBS', 'WHEAT', 'MAIZE', 'SORGHUM', 'BARLEY', 'OTROS', 'TOTAL')),
  cantidad   numeric not null,
  creado_en  timestamptz not null default now(),
  primary key (fecha, planta_id, producto)
);

comment on table public.camiones_plantas is
  'Entrada diaria de camiones por PLANTA y EMPRESA — Agroentregas (endpoint JSON público, cron diario). '
  'Universo: Up River + Paraná bonaerense (SIN Bahía Blanca ni Necochea) — NO es el total nacional, no mezclar '
  'con public.camiones (Williams, 4 zonas = todo el país, serie histórica de la señal barcos-vs-camiones). '
  'producto=TOTAL es el día de esa planta sin abrir por grano (se emite aunque sea 0). '
  'cantidad = CANTIDAD DE CAMIONES, no toneladas.';

-- Lectura pública, mismo criterio que `camiones`/`djve`: el dato ya es público en la web de origen
-- (sin login), no hay nada que proteger. La apertura por empresa/planta se muestra solo a la mesa,
-- pero es una decisión de PRODUCTO en la página, no un secreto — por eso no se gatea acá.
-- Escritura: solo la service key del cron (bypassa RLS por rol), sin policy de insert/update.
alter table public.camiones_plantas enable row level security;

drop policy if exists anon_select_camiones_plantas on public.camiones_plantas;
create policy anon_select_camiones_plantas on public.camiones_plantas for select to anon using (true);
grant select on public.camiones_plantas to anon, authenticated;

-- La PK ya sirve los filtros por fecha (columna líder). Este índice es para la serie por grano,
-- que barre todas las fechas de un producto (el gráfico público).
create index if not exists camiones_plantas_producto_idx on public.camiones_plantas (producto, fecha);
