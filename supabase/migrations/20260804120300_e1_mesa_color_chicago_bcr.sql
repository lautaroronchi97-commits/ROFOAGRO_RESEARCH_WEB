-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- E1 (docs/PLAN_INFORMES_V3.md §5.2): segundo texto libre opcional para el contexto
-- de la rueda de Chicago que Lautoro pega del comentario de BCR ("proveniente de la
-- Bolsa de Comercio de Rosario", Word §1.1 bloque INFORME DIARIO) — separado del
-- color propio de la mesa para poder citarlo "según BCR" sin mezclar las dos voces.
-- Mismo candado 🔒 que ya cubre `texto` (post-informe queda fijo, guard en la
-- server action, no en RLS).

alter table public.mesa_color
  add column if not exists chicago_bcr text;

comment on column public.mesa_color.chicago_bcr is
  'Contexto de la rueda de Chicago que Lautoro pega del comentario de BCR (N8, bloque E del informe diario v3) — texto libre opcional, separado de `texto` (el color propio de la mesa) para poder citarlo "según BCR" sin mezclarlo.';

-- admin_upsert_mesa_color — EXTENDIDA con p_chicago_bcr (mismo criterio que
-- admin_feedback_view en 20260728120000: drop de la firma vieja + create con el
-- parámetro nuevo opcional default null, así las llamadas de 2 argumentos que
-- sigan existiendo momentáneamente resuelven igual sin romper).
drop function if exists public.admin_upsert_mesa_color(date, text);

create or replace function public.admin_upsert_mesa_color(p_fecha date, p_texto text, p_chicago_bcr text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;

  insert into public.mesa_color (fecha, texto, chicago_bcr, actualizado)
  values (p_fecha, btrim(coalesce(p_texto, '')), nullif(btrim(coalesce(p_chicago_bcr, '')), ''), now())
  on conflict (fecha) do update
    set texto = excluded.texto,
        chicago_bcr = excluded.chicago_bcr,
        actualizado = now();

  return true;
end;
$$;

revoke all on function public.admin_upsert_mesa_color(date, text, text) from public, anon;
grant execute on function public.admin_upsert_mesa_color(date, text, text) to authenticated;
