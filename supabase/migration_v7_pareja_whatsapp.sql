-- =====================================================================
-- Mejoras v7: chequeo quincenal de pareja, "plata libre" por persona,
-- orden personalizado del Dashboard y registro de gastos por WhatsApp.
-- Aditivo: solo agrega tablas, columnas y funciones nuevas. No borra ni
-- modifica nada de lo que ya tienes cargado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PREFERENCIAS POR PERSONA
-- ---------------------------------------------------------------------
alter table household_members add column if not exists free_money_allowance numeric(12,2) not null default 0;
alter table household_members add column if not exists dashboard_order text[];

-- Cualquiera de los dos puede fijar la "plata libre" de cualquiera del
-- hogar (se acuerda entre ambos), pero solo dentro de su propio hogar.
create or replace function set_free_money_allowance(p_member uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update household_members
  set free_money_allowance = greatest(coalesce(p_amount, 0), 0)
  where id = p_member
    and household_id in (select hm.household_id from household_members hm where hm.user_id = auth.uid());
end;
$$;

-- Cada persona guarda su propio orden de secciones del Dashboard.
create or replace function save_dashboard_order(p_order text[])
returns void
language sql
security definer
set search_path = public
as $$
  update household_members set dashboard_order = p_order where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 2. GASTOS: marca de "plata libre" y origen del registro
-- ---------------------------------------------------------------------
alter table expenses add column if not exists is_free_money boolean not null default false;
alter table expenses add column if not exists source text not null default 'app';

-- ---------------------------------------------------------------------
-- 3. CHEQUEO QUINCENAL DE PAREJA
-- ---------------------------------------------------------------------
create table if not exists couple_checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  alignment int not null check (alignment between 1 and 4),
  tension int not null check (tension between 1 and 4),
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, user_id, period_start)
);

alter table couple_checkins enable row level security;

-- Directamente solo ves y editas TU respuesta. La del otro solo se ve a
-- través de get_couple_checkins, y solo cuando ambos ya respondieron.
drop policy if exists "own checkins select" on couple_checkins;
create policy "own checkins select" on couple_checkins
  for select using (user_id = auth.uid());

drop policy if exists "own checkins insert" on couple_checkins;
create policy "own checkins insert" on couple_checkins
  for insert with check (user_id = auth.uid() and household_id in (select my_household_ids()));

drop policy if exists "own checkins update" on couple_checkins;
create policy "own checkins update" on couple_checkins
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id in (select my_household_ids()));

create or replace function get_couple_checkins(p_household uuid, p_period date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
  members int;
  result_rows jsonb;
  is_revealed boolean;
begin
  if not exists (
    select 1 from household_members m
    where m.household_id = p_household and m.user_id = auth.uid()
  ) then
    raise exception 'no autorizado';
  end if;

  select count(*) into total from couple_checkins c
  where c.household_id = p_household and c.period_start = p_period;

  select count(*) into members from household_members m
  where m.household_id = p_household;

  is_revealed := total >= greatest(members, 2);

  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', c.user_id,
      'alignment', c.alignment,
      'tension', c.tension,
      'note', c.note
    )), '[]'::jsonb)
  into result_rows
  from couple_checkins c
  where c.household_id = p_household
    and c.period_start = p_period
    and (is_revealed or c.user_id = auth.uid());

  return jsonb_build_object(
    'revealed', is_revealed,
    'answered', total,
    'members', members,
    'rows', result_rows
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. WHATSAPP: números vinculados y códigos de vinculación
-- ---------------------------------------------------------------------
create table if not exists whatsapp_links (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table whatsapp_links enable row level security;

drop policy if exists "whatsapp links read" on whatsapp_links;
create policy "whatsapp links read" on whatsapp_links
  for select using (household_id in (select my_household_ids()));

drop policy if exists "whatsapp links delete own" on whatsapp_links;
create policy "whatsapp links delete own" on whatsapp_links
  for delete using (user_id = auth.uid());

-- El número se vincula cuando la persona manda "vincular CODIGO" por
-- WhatsApp: así se comprueba que el número realmente es suyo.
create table if not exists whatsapp_link_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

alter table whatsapp_link_codes enable row level security;

drop policy if exists "own link codes" on whatsapp_link_codes;
create policy "own link codes" on whatsapp_link_codes
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id in (select my_household_ids()));

-- Registro de mensajes recibidos: evita procesar dos veces el mismo
-- mensaje si WhatsApp lo reenvía, y sirve de historial. Sin políticas:
-- solo el servidor (service role) puede leerla o escribirla.
create table if not exists whatsapp_messages (
  wa_message_id text primary key,
  phone text not null,
  body text,
  expense_id uuid references expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table whatsapp_messages enable row level security;

-- ---------------------------------------------------------------------
-- 5. PERMISOS DE LAS FUNCIONES NUEVAS: solo usuarios con sesión
-- ---------------------------------------------------------------------
revoke execute on function set_free_money_allowance(uuid, numeric) from public, anon;
revoke execute on function save_dashboard_order(text[]) from public, anon;
revoke execute on function get_couple_checkins(uuid, date) from public, anon;
grant execute on function set_free_money_allowance(uuid, numeric) to authenticated;
grant execute on function save_dashboard_order(text[]) to authenticated;
grant execute on function get_couple_checkins(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 6. CORRECCIÓN: "(autom√°tico)" -> "(automático)"
-- El texto se dañó al pegar migraciones anteriores (portapapeles). Se
-- reescriben las funciones de auto-registro y se corrigen los gastos.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  def text;
  broken text := 'autom' || chr(8730) || chr(176) || 'tico';
  fixed text := 'autom' || chr(225) || 'tico';
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('auto_post_recurring_expenses', 'auto_post_card_payments', 'auto_post_recurring_income')
  loop
    def := pg_get_functiondef(r.oid);
    if position(broken in def) > 0 then
      execute replace(def, broken, fixed);
    end if;
  end loop;

  update expenses set description = replace(description, broken, fixed)
  where position(broken in description) > 0;

  update income_entries set description = replace(description, broken, fixed)
  where position(broken in description) > 0;
end $$;

-- ---------------------------------------------------------------------
-- 7. SEGURIDAD: las funciones de auto-registro solo las corre pg_cron
-- ---------------------------------------------------------------------
revoke execute on function auto_post_recurring_income() from public, anon, authenticated;
revoke execute on function auto_post_recurring_expenses() from public, anon, authenticated;
revoke execute on function auto_post_card_payments() from public, anon, authenticated;
revoke execute on function auto_post_installments() from public, anon, authenticated;
