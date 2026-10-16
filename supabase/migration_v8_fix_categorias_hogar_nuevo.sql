-- =====================================================================
-- v8 (ya aplicada vía conector): las categorías por defecto de cada hogar
-- NUEVO se creaban con texto dañado (ej. "Alimentaci√≥n"). Se reescribe la
-- función solo con ASCII + escapes Unicode para que no vuelva a dañarse.
-- =====================================================================
create or replace function public.create_household_with_defaults(household_name text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  new_household_id uuid;
begin
  insert into households (name) values (household_name) returning id into new_household_id;

  insert into household_members (household_id, user_id, display_name)
  values (new_household_id, auth.uid(), display_name);

  insert into categories (household_id, name, icon, is_discretionary) values
    (new_household_id, 'Vivienda', U&'\+01F3E0', false),
    (new_household_id, U&'Alimentaci\00F3n', U&'\+01F6D2', false),
    (new_household_id, 'Transporte', U&'\+01F697', false),
    (new_household_id, 'Servicios (luz, agua, internet)', U&'\+01F4A1', false),
    (new_household_id, 'Salud', U&'\+01FA7A', false),
    (new_household_id, U&'Educaci\00F3n', U&'\+01F4DA', false),
    (new_household_id, 'Entretenimiento', U&'\+01F3AC', true),
    (new_household_id, 'Tarjetas / Deudas', U&'\+01F4B3', false),
    (new_household_id, U&'Ahorro / Inversi\00F3n', U&'\+01F4C8', false),
    (new_household_id, 'Otros', U&'\+01F4E6', true);

  insert into category_budgets (household_id, category_id, monthly_limit)
    select new_household_id, id, 0 from categories where household_id = new_household_id;

  return new_household_id;
end;
$function$;
