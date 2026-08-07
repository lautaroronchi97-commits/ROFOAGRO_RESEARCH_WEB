-- djve_resumen pasa de VISTA a MATVIEW (auditoría 07/08/2026, mismo remedio ya aplicado a
-- djve_cobertura en 20260721122520_e2_djve_cobertura_matview).
--
-- La vista agregaba las ~335k filas de `djve` en CADA request (medido: ~2s de EXPLAIN
-- ANALYZE, Parallel Seq Scan completo) → src/lib/djve.ts (`/comercio/djve`) y el JSON del
-- informe diario/semanal (`djveResumen`) quedan cerca del timeout de 8s de `sbSelect`.
--
-- El refresh se suma a `refresh_lineup_visitas()`, que `scripts/ingest-lineup.mjs` ya llama
-- 2 veces por día (10:00 y 22:00 ART) tras cada ingesta — no hace falta tocar ningún script
-- ni sumar un cron nuevo. `djve_resumen` no depende de `lineup`, pero 2 refrescos diarios son
-- de sobra frente al umbral de frescura de `djve` en el healthcheck (5 días).

drop view if exists public.djve_resumen;

create materialized view public.djve_resumen as
select
  producto,
  max(anio)                                                                   as ult_anio,
  round(sum(toneladas) filter (where anio = date_part('year', current_date))) as ton_anio,
  round(sum(toneladas) filter (where fecha_registro >= current_date - 30))    as ton_30d,
  round(sum(toneladas) filter (where fecha_registro >= current_date - 7))     as ton_7d,
  count(*) filter (where fecha_registro >= current_date - 7)                  as n_7d,
  max(fecha_registro)                                                         as ult_registro,
  max(actualizado_en)                                                         as actualizado_en
from public.djve
where producto is not null
group by producto;

comment on materialized view public.djve_resumen is
  'Resumen DJVE por producto para la web ROFO AGRO: acumulado del anio en curso + ventanas 7/30 dias. Era vista; materializada 07/08/2026 por latencia (335k filas base, ~2s por request). Refrescada por refresh_lineup_visitas().';

grant select on public.djve_resumen to anon;
create unique index djve_resumen_producto_idx on public.djve_resumen (producto);

create or replace function public.refresh_lineup_visitas()
returns void
language sql
security definer
set search_path to 'public'
as $function$
  refresh materialized view public.lineup_visitas;
  refresh materialized view public.lineup_densidad_hist;
  refresh materialized view public.lineup_gap_hist;
  refresh materialized view public.djve_cobertura;
  refresh materialized view concurrently public.djve_resumen;
$function$;
