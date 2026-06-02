# FarmaredCorp — README

Sistema completo (Full-stack) de gestión de farmacias con base de datos distribuida heterogénea (Bolivia + Perú + Chile) y Dashboard analítico integrado.

---

## Requisitos Previos

| Herramienta | Versión mínima |
|-------------|----------------|
| Node.js | 18.x o superior |
| npm | 9.x o superior |
| SQL Server | 2019+ (Bolivia y Perú) |
| PostgreSQL | 14+ (Chile) |
| Radmin VPN | Activo con los 3 servidores conectados |

---

## Pasos para Ejecutar el Proyecto Sin Errores

### Paso 1 — Clonar e instalar dependencias

```bash
# Si ya tienes el repo, solo instala dependencias
npm install
```

### Paso 2 — Ejecutar los scripts SQL en orden

> ⚠️ **CRÍTICO**: Los scripts SQL deben ejecutarse en el servidor correcto.
> Ejecutar fuera de orden causará errores de FK o CHECK constraint.

```
① Conectar a Bolivia (26.221.13.33) → Ejecutar: sql/01-create-almacen-bolivia.sql
② Conectar a Perú (26.134.31.38)    → Ejecutar: sql/02-create-nodo-peru.sql
③ Conectar a Chile (26.132.12.209)  → Ejecutar: sql/03-create-nodo-chile.sql
④ Conectar a Bolivia (26.221.13.33) → Ejecutar: sql/04-linked-servers.sql
⑤ Cada servidor según comentarios   → Ejecutar: sql/05-security.sql
```

**Para Chile (PostgreSQL):**
```sql
-- Primero crear la base de datos (como usuario postgres):
CREATE DATABASE farmaredcorp;
\c farmaredcorp
-- Luego ejecutar el script 03
```

### Paso 3 — Verificar los archivos `.env`

Confirmar que existen los cuatro archivos en la raíz del proyecto:

```
.env              ← JWT_SECRET, PORT, SYNC_RETRY_INTERVAL_MS
.env.bolivia      ← Conexión SQL Server Bolivia (26.221.13.33:1433)
.env.peru         ← Conexión SQL Server Perú (26.134.31.38:1433)
.env.chile        ← Conexión PostgreSQL Chile (26.132.12.209:5432)
```

> ⚠️ Estos archivos están en `.gitignore` y contienen credenciales.
> Verificar que las IPs de Radmin VPN sean accesibles antes de arrancar.

### Paso 4 — Verificar conectividad de red

```bash
# Desde PowerShell, verificar que los 3 servidores respondan:
Test-NetConnection 26.221.13.33 -Port 1433   # Bolivia SQL Server
Test-NetConnection 26.134.31.38 -Port 1433   # Perú SQL Server
Test-NetConnection 26.132.12.209 -Port 5432  # Chile PostgreSQL
```

Si alguno falla: verificar que Radmin VPN esté activo y el servidor encendido.

### Paso 5 — Instalar el driver ODBC para Chile (linked server)

Para que Bolivia pueda consultar Chile via OPENQUERY:

1. Descargar **psqlODBC (PostgreSQL Unicode)** desde: https://www.postgresql.org/ftp/odbc/versions/msi/
2. Instalar en el servidor Windows de Bolivia.
3. Ejecutar `sql/04-linked-servers.sql` en Bolivia.

> ⚠️ Sin este driver, `OPENQUERY` hacia Chile fallará. Las demás operaciones funcionarán normalmente.

### Paso 6 — Arrancar el servidor de desarrollo

```bash
npm run dev
```

El servidor levanta en `http://localhost:3000`.

En la consola deberías ver:
```
[Instrumentation] Variables de entorno cargadas desde .env.*
[DB] Conectado a Bolivia (almacén central)
[SyncRetryJob] Iniciado. Intervalo: 60000ms (60s)
```

### Paso 7 — Usar el Dashboard (Frontend)

El sistema ya incluye un **Dashboard visual** construido con TailwindCSS, Recharts y React Context.

1. Abre tu navegador y ve a `http://localhost:3000/login`.
2. Utiliza los botones de **"Prueba Rápida"** en la pantalla para autocompletar credenciales y probar los distintos roles.
3. El rol **Super Admin** es redirigido a `/dashboard` (vista global consolidada).
4. Los roles **Admin Local (Perú/Chile)** son redirigidos a `/admin` (vista operativa independiente de su propio nodo).
5. Explora el menú lateral para acceder a **Ventas (Punto de Venta POS)**, **Inventario**, **Pacientes** y **Configuración**. Todo funciona mediante modales limpios y tablas paginadas.

Si prefieres probar la API directamente (Backend):

```bash
# Test con curl (PowerShell)
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"superadmin@farma.bo","password":"123456","codigo_pais":"BO"}'
```

---

## Estructura de Archivos

```
farmaredcorp/
├── .env                    ← JWT_SECRET y configuración general
├── .env.bolivia            ← Conexión Bolivia (NO commitear)
├── .env.peru               ← Conexión Perú (NO commitear)
├── .env.chile              ← Conexión Chile (NO commitear)
│
├── sql/
│   ├── 01-create-almacen-bolivia.sql
│   ├── 02-create-nodo-peru.sql
│   ├── 03-create-nodo-chile.sql
│   ├── 04-linked-servers.sql
│   └── 05-security.sql
│
├── src/
│   ├── types/index.ts           ← Tipos compartidos
│   ├── lib/
│   │   ├── db.ts               ← Pool de conexiones (3 nodos)
│   │   ├── uuid.ts             ← UUID prefijado por país
│   │   ├── syncLog.ts          ← Gestión de sync_log
│   │   └── retrySync.ts        ← Reintento de sincronización
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── country.middleware.ts
│   ├── services/               ← Lógica de negocio
│   ├── app/api/               ← Endpoints REST
│   ├── jobs/syncRetry.job.ts  ← Cron job de sync
│   └── instrumentation.ts     ← Arranque del servidor
│
├── agents.md               ← Documentación para la IA de frontend
└── README.md               ← Este archivo
```

---

## Credenciales de Acceso

> ⚠️ **Decisión académica**: contraseñas en texto plano. En producción usar bcrypt.

| Usuario | Email | Password | Nodo |
|---------|-------|----------|------|
| Super Admin | superadmin@farma.bo | 123456 | Bolivia |
| Admin Perú | admin@farma.pe | 123456 | Perú |
| Admin Chile | admin@farma.cl | 123456 | Chile |

---

## Endpoints Disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login y generación de JWT |
| GET/POST | `/api/clientes` | Lista / crea clientes |
| GET/PUT/DELETE | `/api/clientes/:id` | Opera sobre un cliente |
| GET/POST | `/api/medicamentos` | Lista / crea medicamentos |
| GET/PUT/DELETE | `/api/medicamentos/:id` | Opera sobre un medicamento |
| GET/POST | `/api/empleados` | Lista / crea empleados |
| GET/PUT/DELETE | `/api/empleados/:id` | Opera sobre un empleado |
| GET/POST | `/api/sucursales` | Lista / crea sucursales |
| GET/PUT/DELETE | `/api/sucursales/:id` | Opera sobre una sucursal |
| GET/POST | `/api/stock` | Lista / crea stock |
| GET/PUT | `/api/stock/:id` | Obtiene / actualiza stock |
| GET/POST | `/api/ventas` | Historial / registra venta |
| GET | `/api/ventas/:id` | Obtiene venta con detalle |
| GET | `/api/dashboard/resumen` | Totales globales (superadmin) |
| GET | `/api/dashboard/ventas` | Ventas por país (superadmin) |
| GET | `/api/dashboard/clientes` | Clientes por país (superadmin) |
| GET | `/api/dashboard/stock` | Stock por país (superadmin) |
| GET | `/api/dashboard/sync-log` | Estado de sincronización (superadmin) |

---

## Problemas Comunes y Soluciones

### Error: "Cannot connect to server"
- Verificar que Radmin VPN esté activo.
- Verificar que los 3 servidores de BD estén encendidos.
- Revisar las IPs en los archivos `.env.*`.

### Error: "JWT_SECRET no configurado"
- El archivo `.env` no existe o no se cargó.
- Verificar que `.env` esté en la raíz del proyecto.

### Error: "CHECK constraint failed"
- Se intentó insertar un registro con `codigo_pais` incorrecto en un nodo.
- Ejemplo: insertar `PE` en el nodo Chile. Es el comportamiento esperado.

### Error: "Stock insuficiente"
- La venta fue rechazada con HTTP 400 porque no hay stock suficiente.
- Primero agregar stock via `PUT /api/stock/:id`.

### La sincronización falla pero la operación fue exitosa
- El registro queda en `sync_log` con estado `PENDIENTE`.
- El job de reintento lo procesará automáticamente en el siguiente ciclo (60s).
- Si falla 5 veces, queda en estado `ERROR` visible en `/api/dashboard/sync-log`.

### Los linked servers no responden (OPENQUERY)
- Verificar que el driver ODBC de PostgreSQL esté instalado en Bolivia.
- Las operaciones normales de CRUD no dependen de OPENQUERY.
- Solo el superadmin usa OPENQUERY para lecturas en tiempo real.

---

## Comandos npm

```bash
npm run dev      # Servidor de desarrollo (con hot-reload)
npm run build    # Compilación para producción
npm run start    # Servidor de producción (requiere build previo)
npm run lint     # Verificación de código
```
