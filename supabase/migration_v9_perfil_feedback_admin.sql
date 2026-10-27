-- v9: perfil del usuario (edad, género, ciudad con consentimiento),
-- opiniones sobre la app (NPS + comentarios) y panel de administración
-- con datos AGREGADOS para entender a los usuarios.
--
-- Privacidad (LOPDP Ecuador): los datos de perfil son opcionales, se guardan
-- solo si la persona acepta el consentimiento, y el panel de administración
-- muestra rangos de edad y totales, nunca nombres, correos ni montos.

create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_year int check (birth_year between 1920 and 2015),
  gender text check (gender in ('mujer', 'hombre', 'otro', 'prefiero_no_decir')),
  city text check (char_length(city) <= 80),
  consent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table user_profiles enable row level security;
drop policy if exists "perfil propio" on user_profiles;
create policy "perfil propio" on user_profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  household_id uuid references households(id) on delete set null,
  kind text not null default 'otro' check (kind in ('idea', 'problema', 'me_gusta', 'otro')),
  score int check (score between 0 and 10),
  message text check (char_length(message) <= 2000),
  page text check (char_length(page) <= 120),
  created_at timestamptz not null default now()
);
alter table app_feedback enable row level security;
drop policy if exists "enviar opinion" on app_feedback;
create policy "enviar opinion" on app_feedback for insert
  with check (
    user_id = auth.uid()
    and (household_id is null or household_id in (select my_household_ids()))
  );
drop policy if exists "ver mis opiniones" on app_feedback;
create policy "ver mis opiniones" on app_feedback for select using (user_id = auth.uid());

-- Administradores del producto (sin políticas: solo se lee con funciones).
create table if not exists app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table app_admins enable row level security;

create or replace function is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;

create or replace function admin_insights() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cur int := extract(year from now())::int;
  r jsonb;
begin
  if not exists (select 1 from app_admins where user_id = auth.uid()) then
    raise exception 'No autorizado';
  end if;

  with prof as (
    select p.user_id, p.gender, nullif(trim(p.city), '') as city,
      case
        when p.birth_year is null then 'Sin dato'
        when cur - p.birth_year < 25 then '18-24'
        when cur - p.birth_year < 35 then '25-34'
        when cur - p.birth_year < 45 then '35-44'
        when cur - p.birth_year < 55 then '45-54'
        else '55+'
      end as age_range
    from user_profiles p
    where p.consent_at is not null
  ),
  last_score as (
    select distinct on (user_id) user_id, score
    from app_feedback
    where score is not null
    order by user_id, created_at desc
  )
  select jsonb_build_object(
    'usuarios', (select count(*) from auth.users),
    'hogares', (select count(*) from households),
    'hogares_activos_30d', (select count(distinct household_id) from expenses where created_at > now() - interval '30 days'),
    'perfiles_completos', (select count(*) from prof),
    'por_edad', coalesce((select jsonb_object_agg(age_range, n) from (select age_range, count(*) n from prof group by 1) x), '{}'::jsonb),
    'por_genero', coalesce((select jsonb_object_agg(coalesce(gender, 'sin_dato'), n) from (select gender, count(*) n from prof group by 1) x), '{}'::jsonb),
    'por_ciudad', coalesce((select jsonb_object_agg(coalesce(initcap(city), 'Sin dato'), n) from (select city, count(*) n from prof group by 1) x), '{}'::jsonb),
    'nps', (select jsonb_build_object(
        'respuestas', count(*),
        'promotores', count(*) filter (where score >= 9),
        'pasivos', count(*) filter (where score between 7 and 8),
        'detractores', count(*) filter (where score <= 6))
      from last_score),
    'feedback', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at desc)
      from (
        select a.created_at, a.kind, a.score, a.message, a.page, pr.age_range, pr.gender
        from app_feedback a
        left join prof pr on pr.user_id = a.user_id
        order by a.created_at desc
        limit 200
      ) f), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

revoke all on function admin_insights() from public, anon;
revoke all on function is_app_admin() from public, anon;
grant execute on function admin_insights() to authenticated;
grant execute on function is_app_admin() to authenticated;

-- Marco Andres es el administrador del producto.
insert into app_admins (user_id) values ('8cba425e-1af7-4cb3-9859-85860d119338')
  on conflict do nothing;
