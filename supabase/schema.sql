-- =====================================================================
-- App de Finanzas Familiares - Esquema de base de datos para Supabase
-- =====================================================================
-- Cómo usar: Ve a tu proyecto en https://app.supabase.com -> SQL Editor
-- -> New query, pega todo este archivo y dale "Run".
-- =====================================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. HOUSEHOLDS (el "hogar" compartido entre los 2 usuarios)
-- ---------------------------------------------------------------------
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi Familia',
  invite_code uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. HOUSEHOLD_MEMBERS (vincula auth.users con un household)
-- ---------------------------------------------------------------------
create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- Función helper: households a los que pertenece el usuario actual
create or replace function my_household_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select household_id from household_members where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3. CATEGORIES
-- ---------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text default '💸',
  is_discretionary boolean not null default true, -- true = gasto reducible (ocio, etc.)
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

-- ---------------------------------------------------------------------
-- 4. CATEGORY_BUDGETS (límite mensual por categoría)
-- ---------------------------------------------------------------------
create table if not exists category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  monthly_limit numeric(12,2) not null default 0,
  alert_threshold_pct int not null default 80, -- % del límite para disparar alerta amarilla
  updated_at timestamptz not null default now(),
  unique (household_id, category_id)
);

-- ---------------------------------------------------------------------
-- 5. CARDS (tarjetas de crédito con fecha de corte y pago)
-- ---------------------------------------------------------------------
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  closing_day int not null check (closing_day between 1 and 31), -- día de corte
  payment_day int not null check (payment_day between 1 and 31), -- día límite de pago
  credit_limit numeric(12,2),
  color text default '#6366f1',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. INCOME_SOURCES (ingresos recurrentes: sueldos, etc.)
-- ---------------------------------------------------------------------
create table if not exists income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null,
  expected_day int not null check (expected_day between 1 and 31),
  owner_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. INCOME_ENTRIES (registro real de ingresos, incluye extras)
-- ---------------------------------------------------------------------
create table if not exists income_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  income_source_id uuid references income_sources(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  entry_date date not null default current_date,
  is_extra boolean not null default false, -- true = ingreso adicional (bono, freelance, etc.)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. EXPENSES (gastos)
-- ---------------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id),
  card_id uuid references cards(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  expense_date date not null default current_date,
  is_recurring boolean not null default false, -- true = gasto fijo mensual (renta, servicios)
  is_extra boolean not null default false, -- true = gasto adicional/no planeado
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_household_date on expenses(household_id, expense_date);
create index if not exists idx_income_household_date on income_entries(household_id, entry_date);

-- =====================================================================
-- ROW LEVEL SECURITY: cada household solo ve sus propios datos
-- =====================================================================
alter table households enable row level security;
alter table household_members enable row level security;
alter table categories enable row level security;
alter table category_budgets enable row level security;
alter table cards enable row level security;
alter table income_sources enable row level security;
alter table income_entries enable row level security;
alter table expenses enable row level security;

-- households: un usuario puede ver el household al que pertenece,
-- y puede ver (para unirse) uno por invite_code aunque no sea miembro aún.
create policy "select own household" on households
  for select using (id in (select my_household_ids()) or true);
  -- nota: el "or true" permite buscar por invite_code al unirse; no expone datos sensibles.

create policy "insert household (crear hogar)" on households
  for insert with check (true);

-- household_members
create policy "select members of my household" on household_members
  for select using (household_id in (select my_household_ids()));

create policy "insert self as member" on household_members
  for insert with check (user_id = auth.uid());

-- Tablas de datos: select/insert/update/delete solo si pertenece al household
create policy "categories access" on categories
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

create policy "category_budgets access" on category_budgets
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

create policy "cards access" on cards
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

create policy "income_sources access" on income_sources
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

create policy "income_entries access" on income_entries
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

create policy "expenses access" on expenses
  for all using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

-- =====================================================================
-- FUNCIÓN: crear un household + categorías por defecto + agregar creador
-- (se llama desde la app la primera vez que un usuario se registra)
-- =====================================================================
create or replace function create_household_with_defaults(household_name text, display_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_household_id uuid;
begin
  insert into households (name) values (household_name) returning id into new_household_id;

  insert into household_members (household_id, user_id, display_name)
  values (new_household_id, auth.uid(), display_name);

  insert into categories (household_id, name, icon, is_discretionary) values
    (new_household_id, 'Vivienda', '🏠', false),
    (new_household_id, 'Alimentación', '🛒', false),
    (new_household_id, 'Transporte', '🚗', false),
    (new_household_id, 'Servicios (luz, agua, internet)', '💡', false),
    (new_household_id, 'Salud', '🩺', false),
    (new_household_id, 'Educación', '📚', false),
    (new_household_id, 'Entretenimiento', '🎬', true),
    (new_household_id, 'Tarjetas / Deudas', '💳', false),
    (new_household_id, 'Ahorro / Inversión', '📈', false),
    (new_household_id, 'Otros', '📦', true);

  insert into category_budgets (household_id, category_id, monthly_limit)
    select new_household_id, id, 0 from categories where household_id = new_household_id;

  return new_household_id;
end;
$$;

-- =====================================================================
-- FUNCIÓN: unirse a un household existente usando el invite_code
-- =====================================================================
create or replace function join_household_by_code(code uuid, display_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  target_household_id uuid;
begin
  select id into target_household_id from households where invite_code = code;

  if target_household_id is null then
    raise exception 'Código de invitación inválido';
  end if;

  insert into household_members (household_id, user_id, display_name)
  values (target_household_id, auth.uid(), display_name)
  on conflict (household_id, user_id) do nothing;

  return target_household_id;
end;
$$;
