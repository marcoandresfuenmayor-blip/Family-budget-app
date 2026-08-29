-- =====================================================================
-- Mejoras v2: Metas de ahorro + ingresos recurrentes automáticos
-- =====================================================================
-- Este script es ADITIVO: no borra ni modifica ninguna tabla existente,
-- así que es seguro correrlo sobre tu base de datos actual sin perder
-- nada de lo que ya cargaste (gastos, ingresos, tarjetas, categorías).
--
-- Cómo usar: Supabase -> SQL Editor -> New query -> pega todo esto -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. METAS DE AHORRO (proyectos familiares)
-- ---------------------------------------------------------------------
create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null,
  target_date date,
  created_at timestamptz not null default now()
);

alter table savings_goals enable row level security;

drop policy if exists "savings_goals access" on savings_goals;
create policy "savings_goals access" on savings_goals
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

-- ---------------------------------------------------------------------
-- 2. AUTO-REGISTRO DE INGRESOS RECURRENTES
-- ---------------------------------------------------------------------
-- Revisa todos los "ingresos recurrentes" activos de todos los hogares.
-- Si hoy es su día del mes y todavía no se registró un ingreso real para
-- este mes, lo crea automáticamente. Es idempotente: si ya existe uno
-- para ese mes, no crea otro (no duplica dinero).
create or replace function auto_post_recurring_income()
returns void
language plpgsql
security definer
as $$
declare
  src record;
begin
  for src in
    select * from income_sources
    where active = true
      and expected_day = extract(day from current_date)::int
  loop
    if not exists (
      select 1 from income_entries
      where income_source_id = src.id
        and date_trunc('month', entry_date) = date_trunc('month', current_date)
    ) then
      insert into income_entries (household_id, income_source_id, description, amount, entry_date, is_extra)
      values (src.household_id, src.id, src.name || ' (automático)', src.amount, current_date, false);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. PROGRAMAR LA TAREA DIARIA (pg_cron)
-- ---------------------------------------------------------------------
-- Habilita la extensión (en Supabase normalmente basta con esta línea;
-- si te da error de permisos, ve a Database -> Extensions -> busca
-- "pg_cron" y actívala ahí con el switch, luego vuelve a correr solo
-- las líneas de abajo desde "select cron.unschedule...").
create extension if not exists pg_cron with schema extensions;

-- Si ya existía una tarea con este nombre (por ejemplo, si corres este
-- script dos veces), la quita primero para no duplicar la programación.
select cron.unschedule(jobid) from cron.job where jobname = 'auto-post-recurring-income';

-- Corre todos los días a las 8:00 AM UTC.
select cron.schedule(
  'auto-post-recurring-income',
  '0 8 * * *',
  $$select auto_post_recurring_income();$$
);
