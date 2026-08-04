-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- E1 (docs/PLAN_INFORMES_V3.md §7.1, decisión N2): view v3 pasa de 3 a 5 estados —
-- alcista / levemente_alcista / neutral / levemente_bajista / bajista.
--
-- El CHECK original (20260721150000) es inline SIN nombre explícito — Postgres lo
-- autogeneró como `views_mercado_direccion_check` (confirmado contra pg_constraint
-- antes de escribir esto). Igual se resuelve por catálogo en vez de asumirlo a mano
-- (instrucción explícita del prompt E1), por si alguna vez difiere.

do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'views_mercado'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%direccion%';

  if v_conname is not null then
    execute format('alter table public.views_mercado drop constraint %I', v_conname);
  end if;
end $$;

alter table public.views_mercado
  add constraint views_mercado_direccion_check
  check (direccion in ('alcista', 'levemente_alcista', 'neutral', 'levemente_bajista', 'bajista'));

comment on column public.views_mercado.direccion is
  '5 estados (V3, N2): alcista/levemente_alcista/neutral/levemente_bajista/bajista. "Levemente" = misma dirección, menor convicción — no es el default tibio (guía de uso en la skill view-mercado v3). Los views históricos con solo 3 estados (alcista/bajista/neutral) siguen siendo valores válidos, no se migran.';
