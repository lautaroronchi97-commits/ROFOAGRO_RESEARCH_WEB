-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- E1 (docs/PLAN_INFORMES_V3.md §9): feedback del informe diario/semanal — mismo
-- mecanismo que ya tiene `views_mercado` (nota 1-5 + texto), reusado sin costo
-- marginal de esquema para los otros 3 productos. `admin_feedback_informe` sigue
-- el patrón EXACTO de `admin_feedback_view` (20260721150000/20260728120000).

alter table public.informes_generados
  add column if not exists nota smallint check (nota between 1 and 5),
  add column if not exists feedback text;

comment on column public.informes_generados.nota is
  'Nota 1-5 de Lautoro sobre el informe (diario o semanal) — mismo patrón que views_mercado.nota_lautaro. Escribible desde /informes (mini-form, solo admin) y por los links 1-tap del mail (N15, vía el endpoint /api/informes/nota con HMAC — ese camino escribe directo con la service key, no por esta RPC, porque no hay sesión admin en un click de mail).';
comment on column public.informes_generados.feedback is
  'Feedback de texto libre de Lautoro sobre el informe. Las skills informe-diario/informe-semanal lo leen en su Paso 0 de calibración (patrón ya usado por view-mercado con feedback_lautaro).';

create or replace function public.admin_feedback_informe(p_id uuid, p_feedback text, p_nota smallint default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'solo admin';
  end if;

  if p_nota is not null and (p_nota < 1 or p_nota > 5) then
    raise exception 'nota fuera de rango (1-5)';
  end if;

  update public.informes_generados
     set feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         nota = p_nota
   where id = p_id;

  return found;
end;
$$;

revoke all on function public.admin_feedback_informe(uuid, text, smallint) from public, anon;
grant execute on function public.admin_feedback_informe(uuid, text, smallint) to authenticated;
