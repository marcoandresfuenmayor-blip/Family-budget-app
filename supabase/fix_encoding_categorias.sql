-- =====================================================================
-- Arreglo puntual: corrige nombres/íconos de categorías que quedaron
-- con símbolos raros por un problema de codificación al copiar/pegar
-- el script original. No borra nada, solo corrige el texto de esas
-- 10 categorías por defecto en todos los hogares.
-- =====================================================================

update categories set icon = '🏠', name = 'Vivienda' where name ilike '%Vivienda%';
update categories set icon = '🛒', name = 'Alimentación' where name ilike '%Alimentaci%';
update categories set icon = '🚗', name = 'Transporte' where name ilike '%Transporte%';
update categories set icon = '💡', name = 'Servicios (luz, agua, internet)' where name ilike '%Servicios%';
update categories set icon = '🩺', name = 'Salud' where name ilike '%Salud%';
update categories set icon = '📚', name = 'Educación' where name ilike '%Educaci%';
update categories set icon = '🎬', name = 'Entretenimiento' where name ilike '%Entretenimiento%';
update categories set icon = '💳', name = 'Tarjetas / Deudas' where name ilike '%Tarjetas%';
update categories set icon = '📈', name = 'Ahorro / Inversión' where name ilike '%Ahorro%';
update categories set icon = '📦', name = 'Otros' where name ilike '%Otros%';

-- Revisa el resultado:
select icon, name from categories order by name;
