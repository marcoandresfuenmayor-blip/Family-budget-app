-- =====================================================================
-- Mejoras v4: gastos fijos que se registran solos cada mes.
-- Aditivo: tabla nueva + una columna nueva en expenses. No borra ni
-- toca nada de lo que ya tienes cargado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLANTILLAS DE GASTO FIJO RECURRENTE
-- ---------------------------------------------------------------------
create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id),
  card_id uuid references cards(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table recurring_expenses enable row level security;

drop policy if exists "recurring_expenses access" on recurring_expenses;
create policy "recurring_expenses access" on recurring_expenses
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

-- Vincula cada gasto generado automáticamente con su plantilla, para
-- saber si ya se registró este mes y no duplicarlo.
alter table expenses add column if not exists recurring_expense_id uuid references recurring_expenses(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. AUTO-REGISTRO DE GASTOS FIJOS RECURRENTES
-- ---------------------------------------------------------------------
create or replace function auto_post_recurring_expenses()
returns void
language plpgsql
security definer
as $$
declare
  tpl record;
begin
  for tpl in
    select * from recurring_expenses
    where active = true
      and day_of_month = extract(day from current_date)::int
  loop
    if not exists (
      select 1 from expenses
      where recurring_expense_id = tpl.id
        and date_trunc('month', expense_date) = date_trunc('month', current_date)
    ) then
      insert into expenses (
        household_id, category_id, card_id, description, amount,
        expense_date, is_recurring, is_extra, recurring_expense_id
      )
      values (
        tpl.household_id, tpl.category_id, tpl.card_id,
        tpl.description || ' (automático)', tpl.amount,
        current_date, true, false, tpl.id
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. PROGRAMAR LA TAREA DIARIA (reutiliza pg_cron, ya activado en v2)
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'auto-post-recurring-expenses';

select cron.schedule(
  'auto-post-recurring-expenses',
  '0 8 * * *',
  $$select auto_post_recurring_expenses();$$
);
