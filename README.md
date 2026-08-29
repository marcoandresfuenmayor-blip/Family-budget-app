# Finanzas Familiares

App web para controlar gastos e ingresos mensuales de la familia: fechas de ingresos, fechas de
corte y pago de tarjetas, límites de gasto por categoría con alertas, dashboard con gráficos, y
recomendaciones automáticas de ahorro. Pensada para 2 usuarios (ej. tú y tu pareja) compartiendo
la misma información.

Stack: **Next.js 14 + TypeScript + Tailwind + Supabase (Postgres, Auth, Row Level Security)**.

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta / inicia sesión (plan gratuito es suficiente).
2. Crea un **New project**. Guarda la contraseña de la base de datos en un lugar seguro.
3. Cuando el proyecto esté listo, ve a **SQL Editor → New query**.
4. Abre el archivo [`supabase/schema.sql`](./supabase/schema.sql) de este proyecto, copia todo su
   contenido, pégalo en el editor y presiona **Run**. Esto crea todas las tablas, seguridad a
   nivel de fila (RLS) y las funciones necesarias.
5. Ve a **Project Settings → API**. Copia:
   - `Project URL` → será `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. (Opcional pero recomendado) En **Authentication → Providers → Email**, puedes desactivar
   "Confirm email" mientras pruebas, para no depender del correo de confirmación. Puedes
   reactivarlo después.

## 2. Configurar el proyecto localmente

Requisitos: [Node.js 18+](https://nodejs.org).

```bash
cd family-budget-app
npm install
cp .env.example .env.local
```

Edita `.env.local` y pega tus valores de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU-ANON-KEY
```

Corre en local para probar:

```bash
npm run dev
```

Abre http://localhost:3000

## 3. Primer uso

1. Regístrate con tu correo (botón "¿No tienes cuenta? Regístrate").
2. Inicia sesión. La app te pedirá crear un hogar ("Crear hogar") — esto genera automáticamente
   las 10 categorías por defecto (Vivienda, Alimentación, Transporte, etc.) con límite en 0
   (sin límite) para que los definas tú.
3. Ve a **Categorías y límites** para:
   - Ver el **código de invitación** de tu hogar (cópialo).
   - Definir el límite mensual de cada categoría y el % al que quieres recibir la alerta amarilla.
4. Comparte el código de invitación con tu pareja: ella/él se registra normalmente y, en la
   pantalla de configuración de hogar, elige **"Unirme con código"** y lo pega. A partir de ahí
   ambos ven y editan la misma información en tiempo real.
5. Ve a **Tarjetas** y agrega tus tarjetas de crédito con día de corte y día límite de pago.
6. Ve a **Ingresos** para registrar tus ingresos recurrentes (sueldos) y cualquier ingreso extra.
7. Ve a **Gastos** para cargar cada gasto del mes (categoría, tarjeta usada si aplica, si es fijo
   o extra).
8. El **Dashboard** se actualiza automáticamente con:
   - Resumen de ingresos, gastos y balance del mes.
   - Alertas (🔴 límite superado, 🟡 cerca del límite o corte/pago de tarjeta próximo, 🔵 ingreso
     próximo).
   - Gráficos de gasto por categoría vs. límite, y distribución del gasto.
   - Barra de progreso por categoría.
   - Recomendaciones automáticas para reducir gastos discrecionales e impulsar el ahorro hacia
     nuevos proyectos familiares.

## 3.1 Activar mejoras v2 (ingresos automáticos, tarjetas y metas)

Si ya tenías la app corriendo y quieres agregar: auto-registro de ingresos recurrentes, el
resumen de saldo/utilización de tarjetas, y las metas de ahorro familiares, corre esta migración
adicional (no borra nada de lo que ya tienes):

1. Ve a Supabase → **SQL Editor → New query**.
2. Abre [`supabase/migration_v2_mejoras.sql`](./supabase/migration_v2_mejoras.sql), copia todo su
   contenido, pégalo y dale **Run**.
3. Si la línea `create extension if not exists pg_cron ...` da error de permisos, ve a
   **Database → Extensions**, busca "pg_cron" y actívala con el switch. Luego vuelve al SQL
   Editor y corre solo el resto del script (desde `select cron.unschedule...` en adelante).
4. Listo. Desde ese momento, todos los días a las 8:00 AM (hora UTC) la base de datos revisa tus
   ingresos recurrentes activos y, si hoy es su día de pago, registra el ingreso solo — ya no
   necesitas darle a "Marcar recibido" a mano (aunque el botón sigue ahí por si quieres
   adelantarlo o corregirlo).
5. Ve al Dashboard: ahí aparece la nueva sección de **Tarjetas** con el saldo del corte y % de uso
   del límite, y la de **Metas de ahorro**, donde puedes crear un proyecto familiar y ver tu
   progreso calculado automáticamente según tu ahorro real del mes.

## 3.2 Activar mejoras v3 (editar gastos + saber quién registró)

Corre esta migración adicional (también aditiva, no borra nada) para poder editar gastos ya
cargados y ver qué persona del hogar registró o modificó cada uno:

1. Ve a Supabase → **SQL Editor → New query**.
2. Abre [`supabase/migration_v3_editar_gastos.sql`](./supabase/migration_v3_editar_gastos.sql),
   copia su contenido y dale **Run**.
3. Listo. En la sección de Gastos ahora hay un botón **"editar"** junto a "eliminar" en cada
   fila, y una columna que muestra quién lo registró (o editó) y cuándo.

## 4. Desplegar en la nube (para que ambos la usen desde el celular)

La forma más simple y gratuita es con [Vercel](https://vercel.com):

1. Sube esta carpeta a un repositorio de GitHub (puede ser privado).
2. En Vercel: **Add New → Project**, importa el repositorio.
3. En **Environment Variables**, agrega `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los mismos valores de tu `.env.local`.
4. Deploy. Vercel te dará una URL pública (ej. `https://tu-app.vercel.app`) que pueden agregar a
   la pantalla de inicio del celular como si fuera una app.

## Estructura del proyecto

```
family-budget-app/
├── supabase/schema.sql       # Esquema completo de base de datos + seguridad (RLS)
├── app/
│   ├── page.tsx              # Dashboard
│   ├── gastos/page.tsx       # Carga y listado de gastos
│   ├── ingresos/page.tsx     # Ingresos recurrentes y extra
│   ├── tarjetas/page.tsx     # Tarjetas de crédito (corte/pago)
│   ├── categorias/page.tsx   # Categorías, límites y código de invitación
│   └── login/page.tsx        # Login / registro
├── components/                # Nav, alertas, gráficos, recomendaciones
└── lib/                       # Cliente Supabase, tipos, lógica de alertas y recomendaciones
```

## Notas sobre las alertas y recomendaciones

- Las alertas de categoría se calculan comparando el gasto acumulado del mes contra el
  `monthly_limit` que definiste; el umbral amarillo es configurable por categoría (por defecto
  80%).
- Las alertas de tarjeta avisan cuando el corte o el pago están a 3 días o menos (a 1 día o menos
  se muestran en rojo).
- Las alertas de ingreso avisan cuando falta 2 días o menos para la fecha esperada.
- Las recomendaciones son reglas simples (no IA externa): detectan categorías discrecionales que
  superan su límite o pesan mucho en el presupuesto, calculan tu tasa de ahorro del mes, y avisan
  si los gastos "extra" no planeados son una porción alta del total. Puedes ajustar esta lógica en
  `lib/utils.ts` (función `buildRecommendations`).

## Seguridad

Cada fila de datos está protegida con Row Level Security en Supabase: un usuario solo puede leer
o modificar datos del hogar (`household`) al que pertenece. La clave `anon` es segura de exponer
en el frontend porque todo el acceso está controlado por estas políticas.
