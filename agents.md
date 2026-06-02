# FarmaredCorp — Documentación Base (`agents.md`)

> **Actualización:** El frontend (Dashboard y Login) ya ha sido construido usando React Context, Tailwind CSS y Next.js App Router (ubicado en `src/app/(dashboard)` y `src/app/login`).
> Este archivo sirve como documentación de referencia sobre el modelo de datos, reglas de negocio y uso de los endpoints.

---

## 1. Contexto del Proyecto

**FarmaredCorp** es un sistema de gestión de farmacias con base de datos distribuida heterogénea en 3 países:

| País | Motor | Rol | IP (Radmin VPN) |
|------|-------|-----|-----------------|
| Bolivia | SQL Server | Almacén central + superadmin | 26.221.13.33 |
| Perú | SQL Server | Nodo operativo PE | 26.134.31.38 |
| Chile | PostgreSQL | Nodo operativo CL | 26.132.12.209 |

El backend está implementado en **Next.js 16 con TypeScript**, usando la carpeta `src/app/api/` (App Router). No hay ORM.

---

## 2. Autenticación

### Flujo
1. El usuario hace `POST /api/auth/login` con `{ email, password, codigo_pais }`.
2. El backend valida contra el nodo correcto (BO → Bolivia, PE → Perú, CL → Chile).
3. Se recibe un JWT válido por **8 horas**.
4. Todas las demás llamadas van con `Authorization: Bearer <token>`.

### Usuarios de prueba

| Usuario | Email | Password | Rol | codigo_pais |
|---------|-------|----------|-----|-------------|
| Super Admin | superadmin@farma.bo | 123456 | superadmin | BO |
| Admin Perú | admin@farma.pe | 123456 | admin_pe | PE |
| Admin Chile | admin@farma.cl | 123456 | admin_cl | CL |

### Payload del JWT

```json
{
  "id_usuario": "PE-00000000-0000-0000-0000-000000000001",
  "email": "admin@farma.pe",
  "rol": "admin_pe",
  "codigo_pais": "PE",
  "iat": 1700000000,
  "exp": 1700028800
}
```

### Roles y permisos

| Rol | Qué puede hacer |
|-----|----------------|
| `superadmin` | Leer todo (PE + CL). Crear en cualquier nodo (especificando `codigo_pais` en el body). Ver sync-log, dashboard y analytics. |
| `admin_pe` | CRUD completo solo en datos con `codigo_pais = 'PE'`. |
| `admin_cl` | CRUD completo solo en datos con `codigo_pais = 'CL'`. |

---

## 3. Paginación

**Todos los endpoints de lista** soportan paginación mediante query params:

| Param | Tipo | Default | Máximo | Descripción |
|-------|------|---------|--------|-------------|
| `page` | int | 1 | — | Página actual (base 1) |
| `limit` | int | 20 | 100 | Registros por página |

### Formato de respuesta paginada

```json
{
  "success": true,
  "data": [ ... ],
  "total": 150,
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Ejemplos

```
GET /api/clientes?page=1&limit=10
GET /api/ventas?page=2&limit=25
GET /api/dashboard/ventas?codigo_pais=PE&page=1&limit=50
GET /api/dashboard/sync-log?estado=ERROR&page=1&limit=50
```

> ℹ️ Si no se envían `page` y `limit`, el sistema retorna hasta **1000 registros** sin paginar (para compatibilidad con selects/dropdowns del formulario).

---

## 4. Endpoints de la API

### Base URL (desarrollo)
```
http://localhost:3000
```

### Formato de respuesta estándar

**Éxito (registro único):**
```json
{ "success": true, "data": { ... } }
```

**Éxito (lista paginada):**
```json
{ "success": true, "data": [...], "total": 150, "pagination": { ... } }
```

**Error:**
```json
{ "success": false, "error": "Mensaje de error descriptivo" }
```

---

### 4.1 Autenticación

#### `POST /api/auth/login`
```json
// Request body
{
  "email": "admin@farma.pe",
  "password": "123456",
  "codigo_pais": "PE"
}

// Response 200
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "usuario": {
    "id_usuario": "PE-...",
    "email": "admin@farma.pe",
    "rol": "admin_pe",
    "codigo_pais": "PE"
  }
}
```

---

### 4.2 Clientes

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| GET | `/api/clientes?page=1&limit=20` | Lista clientes activos (paginado) | admin_pe, admin_cl, superadmin |
| POST | `/api/clientes` | Crea cliente | admin_pe, admin_cl, superadmin |
| GET | `/api/clientes/:id` | Obtiene un cliente | todos |
| PUT | `/api/clientes/:id` | Actualiza cliente | admin_pe, admin_cl |
| DELETE | `/api/clientes/:id` | Baja lógica (activo=false) | admin_pe, admin_cl |

**POST `/api/clientes` (admin local):**
```json
{ "nombre": "Juan Pérez", "email": "juan@gmail.com", "telefono": "987654321" }
```

**POST `/api/clientes` (superadmin — requiere `codigo_pais`):**
```json
{ "nombre": "Juan Pérez", "email": "juan@gmail.com", "codigo_pais": "PE" }
```

---

### 4.3 Medicamentos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/medicamentos?page=1&limit=20` | Lista medicamentos activos (paginado) |
| POST | `/api/medicamentos` | Crea medicamento |
| GET | `/api/medicamentos/:id` | Obtiene uno |
| PUT | `/api/medicamentos/:id` | Actualiza |
| DELETE | `/api/medicamentos/:id` | Baja lógica |

```json
// POST body
{ "nombre": "Paracetamol 500mg", "descripcion": "Analgésico y antipirético" }
```

---

### 4.4 Sucursales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/sucursales?page=1&limit=20` | Lista sucursales activas (paginado) |
| POST | `/api/sucursales` | Crea sucursal |
| GET | `/api/sucursales/:id` | Obtiene una |
| PUT | `/api/sucursales/:id` | Actualiza |
| DELETE | `/api/sucursales/:id` | Baja lógica |

```json
// POST body
{ "nombre": "Sucursal Centro Lima", "direccion": "Av. Larco 123, Miraflores" }
```

---

### 4.5 Empleados

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/empleados?page=1&limit=20` | Lista empleados activos (paginado) |
| POST | `/api/empleados` | Crea empleado |
| GET | `/api/empleados/:id` | Obtiene uno |
| PUT | `/api/empleados/:id` | Actualiza |
| DELETE | `/api/empleados/:id` | Baja lógica |

```json
// POST body
{ "nombre": "María García", "cargo": "Farmacéutico", "id_sucursal": "PE-uuid-..." }
```

---

### 4.6 Stock

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/stock?page=1&limit=20` | Lista stock por nodo (paginado) |
| POST | `/api/stock` | Crea registro de stock |
| GET | `/api/stock/:id` | Obtiene un registro |
| PUT | `/api/stock/:id` | Actualiza cantidad y/o precio |

```json
// PUT body — actualizar cantidad y precio
{ "cantidad": 150, "precio_usd": 2.50 }
```

> ⚠️ No existe DELETE de stock — el stock se descuenta automáticamente al registrar una venta.

---

### 4.7 Ventas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/ventas?page=1&limit=20` | Historial de ventas (paginado) |
| POST | `/api/ventas` | Registra nueva venta |
| GET | `/api/ventas/:id` | Obtiene venta con detalles |

```json
// POST /api/ventas
{
  "id_cliente": "PE-uuid-...",
  "id_empleado": "PE-uuid-...",
  "id_sucursal": "PE-uuid-...",
  "detalles": [
    { "id_medicamento": "PE-uuid-...", "cantidad": 3, "precio_unitario_usd": 2.50 },
    { "id_medicamento": "PE-uuid-...", "cantidad": 1, "precio_unitario_usd": 15.00 }
  ]
}

// Response 201
{
  "success": true,
  "data": {
    "id_venta": "PE-uuid-...",
    "monto_total_usd": 22.50,
    "detalles": [ ... ]
  }
}
```

> ⚠️ Si el stock es insuficiente para algún medicamento, retorna **HTTP 400** antes de insertar nada.
> ⚠️ Las ventas **NUNCA** se pueden eliminar. No hay DELETE.

---

### 4.8 Dashboard — Resumen (solo superadmin)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/dashboard/resumen` | Totales globales: ventas, clientes, stock, alertas sync |
| `GET /api/dashboard/ventas?codigo_pais=PE\|CL\|ALL&page=1&limit=20` | Ventas por país (paginado) |
| `GET /api/dashboard/clientes?codigo_pais=PE\|CL\|ALL&page=1&limit=20` | Clientes por país (paginado) |
| `GET /api/dashboard/stock?codigo_pais=PE\|CL\|ALL&page=1&limit=20` | Stock por país (paginado) |
| `GET /api/dashboard/sync-log?estado=PENDIENTE\|OK\|ERROR&page=1&limit=50` | Estado de sincronización (paginado, default 50/pág) |

**GET `/api/dashboard/resumen`:**
```json
{
  "success": true,
  "data": {
    "ventas_pe": 45,
    "ventas_cl": 23,
    "ventas_total": 68,
    "clientes_pe": 120,
    "clientes_cl": 80,
    "stock_pe": 1500,
    "stock_cl": 900,
    "sync_pendientes": 2,
    "sync_errores": 0
  }
}
```

---

### 4.9 Dashboard — Analytics (solo superadmin)

Estos endpoints son **los más importantes para el dashboard visual**. Todos leen del almacén central Bolivia.

#### `GET /api/dashboard/analytics/ventas-por-dia`
Agrupa ventas por día para gráficos de línea/área de tendencia.

| Param | Default | Descripción |
|-------|---------|-------------|
| `codigo_pais` | ALL | PE, CL o ALL |
| `dias` | 30 | Últimos N días (máx 365) |

```json
// Response
{
  "success": true,
  "data": [
    { "fecha": "2025-06-01", "total_ventas": 5, "monto_total": 87.50, "codigo_pais": "PE" },
    { "fecha": "2025-06-01", "total_ventas": 3, "monto_total": 45.00, "codigo_pais": "CL" }
  ],
  "meta": { "dias": 30, "codigo_pais": "ALL" }
}
```

---

#### `GET /api/dashboard/analytics/top-medicamentos`
Ranking de medicamentos más vendidos por volumen de unidades.

| Param | Default | Descripción |
|-------|---------|-------------|
| `codigo_pais` | ALL | PE, CL o ALL |
| `limit` | 10 | Cuántos medicamentos retornar (máx 50) |

```json
// Response
{
  "success": true,
  "data": [
    {
      "id_medicamento": "PE-uuid-...",
      "nombre": "Paracetamol 500mg",
      "codigo_pais": "PE",
      "total_vendido": 250,
      "ingreso_total": 625.00,
      "veces_en_ventas": 45
    }
  ],
  "meta": { "limit": 10, "codigo_pais": "ALL" }
}
```

---

#### `GET /api/dashboard/analytics/ventas-por-sucursal`
Desempeño de cada sucursal con ticket promedio.

| Param | Default | Descripción |
|-------|---------|-------------|
| `codigo_pais` | ALL | PE, CL o ALL |

```json
// Response
{
  "success": true,
  "data": [
    {
      "id_sucursal": "PE-uuid-...",
      "sucursal_nombre": "Sucursal Centro Lima",
      "codigo_pais": "PE",
      "total_ventas": 45,
      "monto_total": 1350.00,
      "ticket_promedio": 30.00
    }
  ]
}
```

---

#### `GET /api/dashboard/analytics/stock-critico`
Alerta de medicamentos con stock por debajo del umbral.

| Param | Default | Descripción |
|-------|---------|-------------|
| `codigo_pais` | ALL | PE, CL o ALL |
| `umbral` | 10 | Unidades mínimas antes de alerta |

```json
// Response
{
  "success": true,
  "data": [
    {
      "id_stock": "PE-uuid-...",
      "medicamento_nombre": "Amoxicilina 500mg",
      "sucursal_nombre": "Sucursal Norte",
      "cantidad": 3,
      "precio_usd": 8.50,
      "codigo_pais": "PE"
    }
  ],
  "meta": { "umbral": 10, "codigo_pais": "ALL", "total_alertas": 5 }
}
```

---

#### `GET /api/dashboard/analytics/ingresos`
KPI de ingresos totales por país para el período indicado.

| Param | Default | Descripción |
|-------|---------|-------------|
| `dias` | 30 | Período en días (máx 365) |

```json
// Response
{
  "success": true,
  "data": [
    { "codigo_pais": "PE", "total_ventas": 45, "ingreso_total_usd": 1350.00, "ticket_promedio_usd": 30.00, "periodo_dias": 30 },
    { "codigo_pais": "CL", "total_ventas": 23, "ingreso_total_usd": 920.00, "ticket_promedio_usd": 40.00, "periodo_dias": 30 }
  ],
  "meta": { "dias": 30 }
}
```

---

## 5. Modelo de Datos

### IDs globales
Todos los IDs tienen el formato `{PAIS}-{uuid-v4}`:
- `PE-3f6a1c2d-4b5e-47a1-b9c2-1234567890ab`
- `CL-9d2b8e1f-0a3c-4d7e-8f1b-abcdef123456`

Esto permite identificar el país de origen sin consultar `codigo_pais`.

### Entidades principales

```typescript
Cliente      { id_cliente, nombre, email?, telefono?, activo, codigo_pais }
Medicamento  { id_medicamento, nombre, descripcion?, activo, codigo_pais }
Sucursal     { id_sucursal, nombre, direccion, activo, codigo_pais }
Empleado     { id_empleado, nombre, cargo, id_sucursal, activo, codigo_pais }
Stock        { id_stock, id_medicamento, id_sucursal, cantidad, precio_usd, fecha_actualizacion, codigo_pais }
Venta        { id_venta, id_cliente, id_empleado, id_sucursal, fecha, monto_total_usd, codigo_pais }
DetalleVenta { id_detalle, id_venta, id_medicamento, cantidad, precio_unitario_usd, subtotal_usd, codigo_pais }
```

---

## 6. Reglas de Negocio para el Frontend

1. **Mostrar `codigo_pais` visible en tablas** — ayuda al superadmin a distinguir registros PE vs CL.
2. **El superadmin siempre debe seleccionar país** antes de crear/editar — el frontend debe mostrar un selector.
3. **Ventas no tienen botón de eliminar** — es una restricción del negocio.
4. **Medicamentos desactivados** deben aparecer en historial de ventas (referencia intacta).
5. **El dashboard del superadmin** debe mostrar:
   - Indicador de `sync_pendientes` y `sync_errores` (datos de `/api/dashboard/resumen`)
   - Alerta de stock crítico (`/api/dashboard/analytics/stock-critico?umbral=10`)
6. **Cantidades de stock** deben actualizarse al registrar una venta (el backend lo hace automáticamente).
7. **Todos los montos son en USD** — mostrar símbolo `$` siempre.
8. **Paginación**: implementar controles de navegación (anterior/siguiente) usando el objeto `pagination` de la respuesta.

### Sugerencias para el dashboard visual

| Widget | Endpoint sugerido | Tipo de gráfico |
|--------|-------------------|-----------------|
| KPI Ingresos del mes | `/api/dashboard/analytics/ingresos?dias=30` | Cards con número grande |
| Tendencia de ventas | `/api/dashboard/analytics/ventas-por-dia?dias=30` | Gráfico de área/línea |
| Top 10 medicamentos | `/api/dashboard/analytics/top-medicamentos?limit=10` | Barras horizontales |
| Desempeño por sucursal | `/api/dashboard/analytics/ventas-por-sucursal` | Barras verticales o tabla |
| Alertas de stock | `/api/dashboard/analytics/stock-critico?umbral=10` | Tabla con badge rojo |
| Estado de sync | `/api/dashboard/resumen` | Badge con contador |

---

## 7. Estructura del Proyecto (Backend + Frontend)

```
src/
├── types/index.ts                ← Tipos TypeScript compartidos
├── lib/
│   ├── db.ts                    ← Pool de conexiones (3 nodos)
│   ├── uuid.ts                  ← Generador UUID prefijado
│   ├── syncLog.ts               ← Gestión de sync_log
│   ├── retrySync.ts             ← Lógica de reintento
│   └── pagination.ts            ← Utilidad de paginación (parsePagination, buildPaginatedResult)
├── middleware/
│   ├── auth.middleware.ts       ← JWT verification + withAuth HOF
│   └── country.middleware.ts    ← withCountry HOF
├── services/
│   ├── auth.service.ts
│   ├── cliente.service.ts       ← listarClientes(nodeConn, cp, pagination?)
│   ├── medicamento.service.ts   ← listarMedicamentos(nodeConn, cp, pagination?)
│   ├── empleado.service.ts      ← listarEmpleados(nodeConn, cp, pagination?)
│   ├── sucursal.service.ts      ← listarSucursales(nodeConn, cp, pagination?)
│   ├── stock.service.ts         ← listarStock(nodeConn, cp, pagination?)
│   ├── venta.service.ts         ← listarVentas(nodeConn, cp, pagination?)
│   ├── dashboard.service.ts     ← Métricas de resumen global
│   └── analytics.service.ts    ← Tendencias, rankings, alertas
├── app/
│   ├── api/                   ← Endpoints REST (Auth, CRUD, Dashboard)
│   ├── (dashboard)/           ← Frontend: Layout del Dashboard y vistas
│   │   ├── admin/             ← Dashboard Operativo (Admins locales)
│   │   ├── dashboard/         ← Dashboard Global (Superadmin)
│   │   ├── clientes/          ← CRUD de Pacientes
│   │   ├── configuracion/     ← CRUD de Sucursales y Empleados (Tabs)
│   │   ├── inventario/        ← Consulta de Stock y CRUD de Medicamentos
│   │   └── ventas/            ← Historial y Punto de Venta (Modal POS)
│   ├── login/                 ← Frontend: Vista de autenticación
│   ├── layout.tsx             ← Root Layout (con AuthProvider)
│   ├── page.tsx               ← Redirect automático a /login
│   └── globals.css            ← Tailwind CSS (Variables de Tema)
├── components/
│   └── ui/                    ← UI Base (Button, Card, Input, Modal, Table, Select)
├── contexts/
│   └── AuthContext.tsx        ← Estado global del JWT y Usuario
├── jobs/syncRetry.job.ts        ← Cron job de reintento
└── instrumentation.ts           ← Arranque del servidor
```

---

## 8. Variables de Entorno Disponibles

El frontend (si se integra en el mismo Next.js) puede usar:
```
NEXT_PUBLIC_APP_NAME=FarmaredCorp
```

Las demás variables (`JWT_SECRET`, conexiones a BD) son solo del servidor y **nunca deben exponerse al cliente**.

---

## 9. Notas Técnicas para el Frontend

- **No hay cookies** — el JWT se guarda en `localStorage` o estado de la aplicación.
- **El token expira en 8 horas** — implementar refresco o redirección al login.
- **CORS** — en desarrollo, Next.js permite llamadas same-origin. Para producción configurar `next.config.ts`.
- **Aislamiento Multi-Nodo**: Los administradores locales consumen directamente los endpoints de datos (ej. `/api/ventas`). El backend detecta el `codigo_pais` mediante el JWT, garantizando que un nodo (ej. Chile) siga operando de manera independiente aunque la central esté caída.
- **Componentes UI Base**: Toda la interfaz utiliza componentes funcionales reutilizables ubicados en `src/components/ui/` (`Modal.tsx`, `Table.tsx`, `Input.tsx`, etc.), usando TailwindCSS v4.
- **Paginación**: usar `pagination.hasNext` y `pagination.hasPrev` para habilitar/deshabilitar botones de navegación en el componente genérico de tablas.
- **Punto de Venta (POS)**: El registro de ventas no navega a otra página, sino que utiliza el `Modal.tsx` con un carrito de compras en memoria (React State), que calcula los subtotales automáticamente consultando el precio local (`precio_usd`) antes de enviar el array a la API.
- **WebSockets** — no implementados. Para tiempo real usar polling al endpoint de resumen (cada 30-60s).
