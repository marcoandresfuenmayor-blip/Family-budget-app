-- =====================================================================
-- Mejoras v5: el pago de la tarjeta (lo que corresponde al corte ya
-- cerrado) se puede registrar solo como un gasto, el día de pago.
-- Aditivo: solo agrega columnas nuevas. No borra ni toca nada de lo
-- que ya tienes cargado. Es "mixto" como los gastos fijos: activas la
-- opción por tarjeta, tú decides cuáles se auto-registran.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NUEVAS COLUMNAS
-- ---------------------------------------------------------------------
alter table cards add column if not exists auto_post_payment boolean not null default false;
alter table cards add column if not exists payment_category_id uuid references categories(id) on delete set null;

-- Marca los gastos que son "el pago de la tarjeta" (no una compra), para
-- no contarlos dos veces dentro del ciclo/corte de esa misma tarjeta.
alter table expenses add column if not exists is_card_payment boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. FUNCIONES DE FECHA (equivalentes a las del frontend, en SQL)
-- ---------------------------------------------------------------------
create or replace function days_in_month(base date)
returns int language sql immutable as $$
  select extract(day from (date_trunc('month', base) + interval '1 month - 1 day'))::int;
$$;

-- Ocurrencia anterior (o de hoy, si hoy es ese día) de un día del mes.
create or replace function prev_day_occurrence(day_of_month int, base date)
returns date language plpgsql immutable as $$
declare
  candidate date;
  prev_month_start date;
begin
  candidate := make_date(
    extract(year from base)::int,
    extract(month from base)::int,
    least(day_of_month, days_in_month(base))
  );
  if candidate > base then
    prev_month_start := date_trunc('month', base) - interval '1 month';
    candidate := make_date(
      extract(year from prev_month_start)::int,
      extract(month from prev_month_start)::int,
      least(day_of_month, days_in_month(prev_month_start::date))
    );
  end if;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. AUTO-REGISTRO DEL PAGO DE TARJETA (día de pago = hoy)
-- ---------------------------------------------------------------------
create or replace function auto_post_card_payments()
returns void
language plpgsql
security definer
as $$
declare
  c record;
  last_closing date;
  prior_closing date;
  due_amount numeric(12,2);
begin
  for c in
    select * from cards
    where auto_post_payment = true
      and payment_category_id is not null
      and payment_day = extract(day from current_date)::int
  loop
    last_closing := prev_day_occurrence(c.closing_day, current_date);
    prior_closing := prev_day_occurrence(c.closing_day, last_closing - interval '1 day');

    select coalesce(sum(amount), 0) into due_amount
    from expenses
    where card_id = c.id
      and is_card_payment = false
      and expense_date > prior_closing
      and expense_date <= last_closing;

    if due_amount > 0 and not exists (
      select 1 from expenses
      where card_id = c.id
        and is_card_payment = true
        and date_trunc('month', expense_date) = date_trunc('month', current_date)
    ) then
      insert into expenses (
        household_id, category_id, card_id, description, amount,
        expense_date, is_recurring, is_extra, is_card_payment
      )
      values (
        c.household_id, c.payment_category_id, c.id,
        'Pago tarjeta ' || c.name || ' (automático)', due_amount,
        current_date, false, false, true
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. PROGRAMAR LA TAREA DIARIA (reutiliza pg_cron, ya activado en v2)
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'auto-post-card-payments';

select cron.schedule(
  'auto-post-card-payments',
  '0 8 * * *',
  $$select auto_post_card_payments();$$
);
