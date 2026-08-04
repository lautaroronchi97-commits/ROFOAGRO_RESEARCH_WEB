-- ROFO AGRO · proyecto Supabase ROFO_AGRO_BASES_DE_DATOS (gbpfgfeksqmzmsxnxiwg)
-- E1 (docs/PLAN_INFORMES_V3.md §8.1, §9): interpretaciones v3 — impacto por grano
-- estructurado, auto-publicación (N4), nota de feedback y el snapshot del borrador
-- original que hace posible medir el feedback por diff (§9 del plan).
--
-- `borrador_original_md` es la pieza crítica: hoy `admin_actualizar_interpretacion`
-- pisa `borrador_md` con la edición de Lautaro y `admin_publicar_interpretacion` deja
-- `publicado_md == borrador_md` SIEMPRE — sin este snapshot el diff "qué cambió
-- Lautaro" daría vacío eternamente. Lo escribe la skill al INSERTAR (E2); las 3 RPC
-- de edición/publicación/descarte existentes NUNCA lo tocan (no hace falta cambiarlas).

alter table public.interpretaciones
  add column if not exists impacto jsonb not null default '{}'::jsonb,
  add column if not exists auto_publicado boolean not null default false,
  add column if not exists nota smallint check (nota between 1 and 5),
  add column if not exists borrador_original_md text;

-- Backfill: las filas que ya existen nunca tuvieron un snapshot del texto original —
-- se usa el borrador_md vigente como mejor aproximación disponible (no hay forma de
-- reconstruir el texto que la IA generó antes de cualquier edición previa).
update public.interpretaciones
   set borrador_original_md = borrador_md
 where borrador_original_md is null;

comment on column public.interpretaciones.impacto is
  'Impacto por grano tocado por el reporte: {"soja":"alcista"|"neutral"|"bajista","maiz":...,"trigo":...} — solo las claves de los granos que el informe toca (V3, del Word de Lautoro §1.1 "INTERPRETACIONES"). Vacío ({}) en filas de V2 o anteriores, y hasta que E2 empiece a escribirlo.';
comment on column public.interpretaciones.auto_publicado is
  'true si el cierre 18:20 ART (N4, V3 §8.1) la publicó sola porque Lautoro no la había tocado; false si la publicó/editó él a mano. Determina la firma: auto-publicadas firman "Mesa ROFO AGRO" (N19), las revisadas llevan su firma personal.';
comment on column public.interpretaciones.nota is
  'Nota 1-5 opcional de Lautoro sobre la interpretación — mismo patrón que views_mercado.nota_lautaro. Sin RPC de escritura todavía en E1 (queda para cuando una etapa posterior cablee el mini-form); la columna existe para no requerir otra migración cuando eso pase.';
comment on column public.interpretaciones.borrador_original_md is
  'Snapshot del texto generado por la IA al insertar la fila — admin_actualizar_interpretacion/admin_publicar_interpretacion NUNCA lo pisan. El diff contra publicado_md/borrador_md es el feedback implícito que la skill lee en su Paso 0 (§9 del plan V3). Backfilleado con borrador_md en las filas preexistentes.';
