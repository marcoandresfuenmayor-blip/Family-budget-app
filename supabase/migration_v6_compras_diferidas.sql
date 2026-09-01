-- =====================================================================
-- Mejoras v6: compras diferidas a cuotas. Ingresas la cuota mensual y a
-- cuántos meses la difieres; la primera cuota se registra sola en el
-- próximo corte de la tarjeta, y una cuota más cada corte hasta terminar.
-- Aditivo: solo agrega tablas/columnas nuevas. No borra ni toca nada de
-- lo que ya tienes cargado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COMPRAS DIFERIDAS
-- ---------------------------------------------------------------------
create table if not exists installment_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id),
  card_id uuid not null references cards(id) on delete cascade,
  description text not null,
  installment_amount numeric(12,2) not null,
  total_installments int not null check (total_installments >= 1),
  installments_posted int not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table installment_purchases enable row level security;

drop policy if exists "installment_purchases access" on installment_purchases;
create policy "installment_purchases access" on installment_purchases
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

-- Vincula cada cuota generada con su plantilla, para saber si ya se
-- registró este mes y no duplicarla, y para llevar el progreso.
alter table expenses add column if not exists installment_purchase_id uuid references installment_purchases(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. AUTO-REGISTRO DE CUOTAS (día de corte de la tarjeta asociada)
-- ---------------------------------------------------------------------
create or replace function auto_post_installments()
returns void
language plpgsql
security definer
as $$
declare
  p record;
begin
  for p in
    select ip.*, c.closing_day
    from installment_purchases ip
    join cards c on c.id = ip.card_id
    where ip.active = true
      and ip.installments_posted < ip.total_installments
      and c.closing_day = extract(day from current_date)::int
  loop
    if not exists (
      select 1 from expenses
      where installment_purchase_id = p.id
        and date_trunc('month', expense_date) = date_trunc('month', current_date)
    ) then
      insert into expenses (
        household_id, category_id, card_id, description, amount,
        expense_date, is_recurring, is_extra, installment_purchase_id
      )
      values (
        p.household_id, p.category_id, p.card_id,
        p.description || ' (cuota ' || (p.installments_posted + 1) || '/' || p.total_installments || ')',
        p.installment_amount, current_date, false, false, p.id
      );

      update installment_purchases
      set installments_posted = installments_posted + 1,
          active = (installments_posted + 1 < total_installments)
      where id = p.id;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. PROGRAMAR LA TAREA DIARIA (reutiliza pg_cron, ya activado en v2)
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'auto-post-installments';

select cron.schedule(
  'auto-post-installments',
  '0 8 * * *',
  $$select auto_post_installments();$$
);
