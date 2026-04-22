-- Añade ranking_id a asignaciones para que cada "envío" sea una entidad
-- propia, independiente del nombre del usuario (que puede repetirse o ser
-- "Anónimo"). Backfill agrupa rows existentes por (tier_id, usuario) — los
-- envíos previos que compartan nombre quedan fusionados (unavoidable).

alter table public.asignaciones
  add column if not exists ranking_id uuid;

with grupos as (
  select tier_id, usuario, gen_random_uuid() as ranking_id
  from public.asignaciones
  where ranking_id is null
  group by tier_id, usuario
)
update public.asignaciones a
set ranking_id = g.ranking_id
from grupos g
where a.tier_id = g.tier_id
  and a.usuario = g.usuario
  and a.ranking_id is null;

alter table public.asignaciones
  alter column ranking_id set not null,
  alter column ranking_id set default gen_random_uuid();

-- Elimina la antigua unique (tier_id, usuario, valor_id) si existe
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.asignaciones'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%(tier_id, usuario, valor_id)%'
  loop
    execute format('alter table public.asignaciones drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.asignaciones
  drop constraint if exists asignaciones_ranking_valor_key;

alter table public.asignaciones
  add constraint asignaciones_ranking_valor_key unique (ranking_id, valor_id);

create index if not exists idx_asignaciones_ranking_id
  on public.asignaciones (ranking_id);

create index if not exists idx_asignaciones_tier_ranking
  on public.asignaciones (tier_id, ranking_id);
