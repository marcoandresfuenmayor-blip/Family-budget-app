-- =====================================================================
-- Mejoras v3: permite saber quién editó un gasto por última vez.
-- Aditivo: solo agrega 2 columnas nuevas (nulas) a la tabla expenses.
-- No borra ni cambia nada de lo que ya tienes cargado.
-- =====================================================================

alter table expenses add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table expenses add column if not exists updated_at timestamptz;
