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

## 3.3 Activar mejoras v4 (gastos fijos que se registran solos)

Corre esta migración adicional (aditiva, no borra nada) para poder crear "plantillas" de gastos
fijos (arriendo, suscripciones, cuotas, etc.) que se registren solas cada mes, igual que ya pasa
con los ingresos recurrentes:

1. Ve a Supabase → **SQL Editor → New query**.
2. Abre [`supabase/migration_v4_gastos_recurrentes.sql`](./supabase/migration_v4_gastos_recurrentes.sql),
   copia su contenido y dale **Run**.
3. Listo. En la sección de **Gastos** ahora hay un bloque **"🔁 Gastos fijos recurrentes"** donde
   puedes crear una plantilla (descripción, monto, categoría, tarjeta opcional y día del mes).
4. Si activaste `pg_cron` (ver sección 3.1), esa plantilla se registra sola cada mes, el día que
   indicaste, sin duplicarse. Si no quieres esperar al cron, usa el botón
   **"⚡ Registrar ahora"** en la misma fila para cargar el gasto del mes actual al instante.

**Importante — es "mixto" a propósito:** el check "Gasto fijo mensual" que ya existía en el
formulario normal de Gastos (el de abajo) sigue siendo solo una etiqueta informativa para ESE
gasto puntual — no lo repite solo. Solo los gastos que crees como **plantilla** en este nuevo
bloque se auto-repiten mes a mes. Así decides tú, gasto por gasto, cuáles quieres automatizar.

## 3.4 Activar mejoras v5 (pago de tarjeta automático + balance acumulado)

Corre esta migración adicional (aditiva, no borra nada):

1. Ve a Supabase → **SQL Editor → New query**.
2. Abre [`supabase/migration_v5_pago_tarjeta_automatico.sql`](./supabase/migration_v5_pago_tarjeta_automatico.sql),
   copia su contenido y dale **Run**.
3. Ve a **Tarjetas → editar** en cada tarjeta que quieras automatizar, activa **"💳 Registrar el
   pago automáticamente"** y elige la categoría (sugerido: "💳 Tarjetas / Deudas").
4. Listo. El día de pago de esa tarjeta, la app registra sola un gasto por el monto del corte ya
   cerrado (lo que realmente toca pagar), para que quede reflejado en tu flujo de caja de ese mes.
   Es "mixto": cada tarjeta lo activa por separado, y solo se registra si hubo algo que pagar.

**Balance acumulado:** el Dashboard ahora tiene una tarjeta adicional, "💰 Balance acumulado", que
suma todos tus ingresos menos todos tus gastos desde que empezaste a usar la app hasta el fin del
mes que estás viendo. A diferencia de "Balance del mes" (que se reinicia cada mes), este sí se
arrastra — si en agosto te sobraron $200, ese sobrante sigue sumando en septiembre. No requiere
ninguna migración, es un cálculo automático.

## 3.5 Activar mejoras v6 (compras diferidas a cuotas)

✅ **Esta migración ya fue aplicada automáticamente en tu base de datos** (vía el conector de
Supabase) — no necesitas correr nada en el SQL Editor esta vez. El archivo
[`supabase/migration_v6_compras_diferidas.sql`](./supabase/migration_v6_compras_diferidas.sql)
queda en el repositorio solo como referencia de lo que se aplicó.

Cómo usarlo: en **Gastos**, hasta abajo, hay un bloque **"🗓️ Compras diferidas a cuotas"**.
Ingresas la descripción, el monto de **cada cuota** (no el total — tú decides cuánto es la cuota
mensual), la categoría, la tarjeta y a cuántos meses la difieres. La primera cuota se registra
sola en el **próximo corte de esa tarjeta** (no el mismo día que la creas), y una cuota más en
cada corte siguiente hasta completar el plazo. Si no quieres esperar al corte, usa
**"⚡ Registrar cuota"** para cargarla al instante. Cuando se completan todas las cuotas, la fila
queda marcada como "✅ completada".

## 3.6 Mejoras v7 (ya aplicadas en tu base de datos)

✅ La migración [`supabase/migration_v7_pareja_whatsapp.sql`](./supabase/migration_v7_pareja_whatsapp.sql)
ya se aplicó automáticamente vía el conector de Supabase. No tienes que correr nada. Incluye:

- **💞 Pareja** (menú): chequeo quincenal privado (lo del otro se ve solo cuando ambos responden),
  resumen de la quincena en palabras y "plata libre" por persona. Para que un gasto cuente como plata
  libre, marca "🎈 De mi plata libre" al registrarlo.
- **📈 Promedios** (menú): cuánto pagan en promedio por cada cosa específica (luz, agua, gasolina…),
  con alertas cuando un pago está en dos categorías distintas o escondido en "Otros".
- **Dashboard**: "Próximos pagos y cobros" (lista o calendario, 7/15/30 días, avisa si el saldo se
  pondría negativo), "Tendencia de gasto mes a mes" (total o por categoría, con línea de tendencia),
  Recomendaciones arriba, y el botón **↕️ Organizar secciones** para arrastrar las secciones al orden
  que cada uno prefiera (se guarda por usuario).
- Corrección: los gastos automáticos que decían "(autom√°tico)" ahora dicen "(automático)", y las
  funciones que los crean quedaron corregidas.
- Corrección: al registrar de noche, la fecha por defecto ya no salta al día siguiente.

## 3.6.1 Mejoras v9 (ya aplicadas en tu base de datos)

Archivo: `supabase/migration_v9_perfil_feedback_admin.sql`.

- **Sugerir límites** (Categorías y límites): propone un límite por categoría con el promedio de los últimos 3 meses completos (reducibles −5%, redondeado a $5). Nada se guarda hasta tocar "Aplicar".
- **Mi perfil** (`/perfil`): año de nacimiento, género y ciudad, opcionales y con consentimiento. Se pueden borrar en cualquier momento.
- **Botón "Opinión"** en todas las pantallas: nota de recomendación 0-10 (NPS), tipo (idea, problema, me gusta) y comentario.
- **Clientes** (`/admin`, solo administradores): usuarios, hogares activos, NPS, edad, género, ciudad y comentarios, siempre agrupados y sin nombres ni montos. Para agregar otro administrador:
  `insert into app_admins (user_id) values ('<uuid del usuario>');`

## 3.7 Conectar WhatsApp (una sola vez, ~20 minutos)

La app ya tiene todo listo para recibir mensajes; falta crear la conexión con WhatsApp en Meta
(gratis para uso personal). Estos pasos los tienes que hacer tú porque implican crear una cuenta y
manejar claves.

**A. Crear la app en Meta**

1. Entra a [developers.facebook.com](https://developers.facebook.com) con tu Facebook → **Mis apps →
   Crear app** → tipo **Empresa (Business)**.
2. En la app, agrega el producto **WhatsApp** → **Configuración de la API (API Setup)**. Meta te da
   un **número de prueba gratis**. Anota:
   - **Phone number ID** (identificador del número).
   - El número de prueba en sí (ej. +1 555…).
3. En esa misma pantalla, en **Para (To)**, agrega tu celular y el de tu pareja y verifícalos con el
   código que les llega. El número de prueba solo responde a números agregados aquí (hasta 5), que
   para ustedes dos es suficiente.
4. **Token permanente:** el token que aparece ahí vence en 24 horas. Para uno que no vence: Meta
   Business Suite → **Configuración del negocio → Usuarios del sistema → Agregar** (rol
   administrador) → **Asignar activos** (tu app, control total) → **Generar token** con los permisos
   `whatsapp_business_messaging` y `whatsapp_business_management`, caducidad **Nunca**. Cópialo.
5. **App Secret:** en tu app → **Configuración de la app → Básica → Clave secreta de la app → Mostrar**.

**B. Poner las claves en Vercel**

Vercel → tu proyecto → **Settings → Environment Variables**, agrega (entorno Production):

| Nombre | Valor |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **Legacy API keys** → `service_role` (empieza con `eyJ`). ⚠️ Es secreta: no la compartas ni la pongas con `NEXT_PUBLIC_`. |
| `WHATSAPP_VERIFY_TOKEN` | Una palabra que inventes, ej. `finanzas-marco-2026` |
| `WHATSAPP_APP_SECRET` | El App Secret del paso A5 |
| `WHATSAPP_ACCESS_TOKEN` | El token permanente del paso A4 |
| `WHATSAPP_PHONE_NUMBER_ID` | El Phone number ID del paso A2 |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | El número de prueba, solo dígitos con código de país (ej. `15551234567`) |

Luego **Deployments → los tres puntos del último → Redeploy** para que tome las claves.

**C. Conectar el webhook**

1. En Meta, WhatsApp → **Configuración (Configuration) → Webhook → Editar**:
   - URL de devolución de llamada: `https://family-budget-app-umber.vercel.app/api/whatsapp`
   - Token de verificación: la misma palabra que pusiste en `WHATSAPP_VERIFY_TOKEN`.
2. **Verificar y guardar**. Luego, en **Campos del webhook**, suscríbete a **messages**.

**D. Vincular sus celulares**

En la app → **💬 WhatsApp → Generar código** y manda `vincular XXXXXX` al número de la app. Cada uno
lo hace desde su propio celular. Desde ahí ya pueden escribir `gasolina 20`, `resumen`,
`cuánto llevo en alimentación`, `deshacer`, etc.

Si algo no responde: Vercel → **Logs** del proyecto muestra el error (casi siempre es una clave mal
copiada o faltó el Redeploy).

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
