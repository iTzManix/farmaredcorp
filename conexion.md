# FarmaredCorp — Resumen Técnico de Base de Datos Distribuida

## 1. Arquitectura Multi-Nodo

| País | Motor | Host (Radmin VPN) | Rol |
|------|-------|--------------------|-----|
| **Bolivia (BO)** | SQL Server | `26.221.13.33:1433` | Almacén central + superadmin |
| **Perú (PE)** | SQL Server | `26.134.31.38:1433` | Nodo operativo PE |
| **Chile (CL)** | PostgreSQL | `26.132.12.209:5432` | Nodo operativo CL |

## 2. Conexiones (singletons lazy en `src/lib/db.ts`)

Bolivia y Perú usan el paquete `mssql` (pool explícito con `.connect()`):

```ts
const boliviaConfig: sql.config = {
  server: process.env.DB_BOLIVIA_HOST!, port: 1433,
  database: process.env.DB_BOLIVIA_NAME!,
  user: 'sa', password: process.env.DB_BOLIVIA_PASS!,
  options: { trustServerCertificate: true, encrypt: false },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
}
```

Chile usa `pg` (Pool nativo, sin `.connect()` explícito):

```ts
global._dbChile = new Pool({
  host: process.env.DB_CHILE_HOST!, port: 5432,
  database: process.env.DB_CHILE_NAME!,
  user: 'postgres', password: process.env.DB_CHILE_PASS!,
  max: 10, idleTimeoutMillis: 30_000,
})
```

Todas las conexiones se guardan en `globalThis` para sobrevivir el hot-reload de Next.js.

## 3. Selector de Nodo (`getNodeDb`)

```ts
type DbType = 'mssql' | 'pg'
interface NodeConnection {
  type: DbType
  getDb: () => Promise<sql.ConnectionPool | Pool>
}

// Uso:
const nodeConn = getNodeDb('PE')   // → { type: 'mssql', getDb: getDbPeru }
const nodeConn = getNodeDb('CL')   // → { type: 'pg', getDb: getDbChile }
```

Cada servicio recibe `NodeConnection` y **bifurca según `type`** para usar la sintaxis correcta.

## 4. Diferencias Clave Entre Motores

| Aspecto | SQL Server (PE/BO) | PostgreSQL (CL) |
|---------|--------------------|-----------------|
| Placeholders | `@param` con `.input('x', sql.Type, val)` | `$1, $2, $3` posicionales en array |
| Resultado | `res.recordset` | `res.rows` |
| COUNT | `{ total: number }` | `{ total: string }` (hay que parsear) |
| Booleano | `1` / `0` (`sql.Bit`) | `TRUE` / `FALSE` nativo |
| Fecha | `GETDATE()` | `NOW()` |
| Paginación | `OFFSET @o ROWS FETCH NEXT @l ROWS ONLY` | `LIMIT $2 OFFSET $3` |
| Top N | `SELECT TOP (@n)` | `LIMIT $1` |
| RETURN | `OUTPUT INSERTED.col` | `RETURNING col` |
| Sin ORM | SQL explícito en todo el código | SQL explícito en todo el código |

## 5. Los Queries Más Importantes

### 5.1 Listado paginado (ej. cliente)
```ts
// MSSQL
SELECT COUNT(*) AS total FROM cliente WHERE codigo_pais = @cp AND activo = 1
SELECT ... FROM cliente WHERE codigo_pais = @cp AND activo = 1
ORDER BY nombre OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY

// PG
SELECT COUNT(*) AS total FROM cliente WHERE codigo_pais = $1 AND activo = TRUE
SELECT ... FROM cliente WHERE codigo_pais = $1 AND activo = TRUE
ORDER BY nombre LIMIT $2 OFFSET $3
```

### 5.2 Descuento de stock atómico (en ventas)
```ts
// MSSQL
UPDATE stock SET cantidad = cantidad - @cantidad
OUTPUT INSERTED.id_stock, INSERTED.cantidad
WHERE id_medicamento = @id_m AND id_sucursal = @id_s AND codigo_pais = @cp AND cantidad >= @cantidad

// PG
UPDATE stock SET cantidad = cantidad - $1
RETURNING id_stock, cantidad
WHERE id_medicamento = $2 AND id_sucursal = $3 AND codigo_pais = $4 AND cantidad >= $1
```
Si `rowCount === 0` → error 400 "Stock insuficiente".

### 5.3 Resumen global del dashboard
```sql
SELECT
  (SELECT COUNT(*) FROM venta   WHERE codigo_pais = 'PE') AS ventas_pe,
  (SELECT COUNT(*) FROM venta   WHERE codigo_pais = 'CL') AS ventas_cl,
  (SELECT COUNT(*) FROM cliente WHERE codigo_pais = 'PE' AND activo = 1) AS clientes_pe,
  (SELECT COUNT(*) FROM cliente WHERE codigo_pais = 'CL' AND activo = 1) AS clientes_cl,
  (SELECT ISNULL(SUM(cantidad), 0) FROM stock WHERE codigo_pais = 'PE') AS stock_pe,
  (SELECT ISNULL(SUM(cantidad), 0) FROM stock WHERE codigo_pais = 'CL') AS stock_cl,
  (SELECT COUNT(*) FROM sync_log WHERE estado = 'PENDIENTE') AS sync_pendientes,
  (SELECT COUNT(*) FROM sync_log WHERE estado = 'ERROR')     AS sync_errores
```
Se ejecuta siempre contra Bolivia (almacén central consolidado).

### 5.4 Ventas por día (analytics)
```sql
SELECT CONVERT(VARCHAR(10), fecha, 120) AS fecha,
       COUNT(*) AS total_ventas,
       ISNULL(SUM(monto_total_usd), 0) AS monto_total,
       codigo_pais
FROM venta
WHERE fecha >= DATEADD(day, -@dias, GETDATE())
  AND codigo_pais IN ('PE', 'CL')
GROUP BY CONVERT(VARCHAR(10), fecha, 120), codigo_pais
ORDER BY fecha
```

### 5.5 Top medicamentos más vendidos
```sql
SELECT TOP (@topN)
  d.id_medicamento, m.nombre, d.codigo_pais,
  SUM(d.cantidad) AS total_vendido,
  SUM(d.subtotal_usd) AS ingreso_total,
  COUNT(DISTINCT d.id_venta) AS veces_en_ventas
FROM detalle_venta d
JOIN medicamento m ON d.id_medicamento = m.id_medicamento
WHERE d.codigo_pais IN ('PE', 'CL')
GROUP BY d.id_medicamento, m.nombre, d.codigo_pais
ORDER BY total_vendido DESC
```

### 5.6 Stock crítico
```sql
SELECT st.id_stock, m.nombre AS medicamento_nombre,
       s.nombre AS sucursal_nombre, st.cantidad, st.precio_usd, st.codigo_pais
FROM stock st
JOIN medicamento m ON st.id_medicamento = m.id_medicamento
JOIN sucursal s ON st.id_sucursal = s.id_sucursal
WHERE st.cantidad <= @umbral AND m.activo = 1
  AND st.codigo_pais IN ('PE', 'CL')
ORDER BY st.cantidad
```

### 5.7 Ingresos por período
```sql
SELECT codigo_pais, COUNT(*) AS total_ventas,
       ISNULL(SUM(monto_total_usd), 0) AS ingreso_total_usd,
       ISNULL(AVG(monto_total_usd), 0) AS ticket_promedio_usd,
       @dias AS periodo_dias
FROM venta
WHERE fecha >= DATEADD(day, -@dias, GETDATE())
  AND codigo_pais IN ('PE', 'CL')
GROUP BY codigo_pais
```

## 6. Sincronización Nodo → Bolivia

### Flujo de escritura
```
[Request] → write en nodo operativo (PE/CL) → sync a Bolivia
                                               ↓
                                         ¿Falla?
                                        ↙       ↘
                                       OK     sync_log (PENDIENTE)
                                                ↓
                                          retrySync job (cada 60s)
                                                ↓
                                         máx 5 intentos → ERROR
```

### Patrón idempotente en sync
```sql
IF NOT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = @id)
  INSERT INTO cliente (...) VALUES (...)
ELSE
  UPDATE cliente SET ... WHERE id_cliente = @id
```

### Job de reintento (`retryPendingSyncs`)
```sql
SELECT TOP 50 * FROM sync_log
WHERE estado = 'PENDIENTE' AND intentos < 5
ORDER BY fecha_creacion ASC
```
Procesa cada entrada: parsea el `payload` JSON, ejecuta `INSERT` o `UPDATE`, y marca `OK` o incrementa `intentos`.

## 7. IDs Globales con Prefijo de País

```ts
generateId('PE') // → "PE-3f6a1c2d-4b5e-47a1-b9c2-1234567890ab"
generateId('CL') // → "CL-9d2b8e1f-0a3c-4d7e-8f1b-abcdef123456"
```
El prefijo permite identificar el país de origen sin consultar `codigo_pais`.

## 8. Paginación (end-to-end)

```ts
// URL → parsePagination(url) → { page: 2, limit: 10, offset: 10 }
// Service → COUNT + SELECT con LIMIT/OFFSET
// buildPaginatedResult(data, total, params)
// → {
//     data: [...],
//     total: 150,
//     pagination: { page:2, limit:10, total:150, totalPages:15, hasNext:true, hasPrev:true }
//   }
```

Si no se envían `page/limit` → default interno de **1000 registros** (para selects/dropdowns).

## 9. Lectura en Tiempo Real (OPENQUERY)

El superadmin puede leer datos vivos desde Bolivia via linked servers:
```sql
-- Perú (SQL Server)
SELECT * FROM OPENQUERY(FARMACIA_NODO_PERU,
  'SELECT ... FROM farmaredcorp.dbo.cliente WHERE activo = 1')

-- Chile (PostgreSQL via ODBC)
SELECT * FROM OPENQUERY(FARMACIA_NODO_CHILE,
  'SELECT ... FROM cliente WHERE activo = TRUE')
```

---

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `src/lib/db.ts` | 3 pools singleton, `NodeConnection` type, `getNodeDb()` |
| `src/lib/pagination.ts` | `parsePagination()`, `buildPaginatedResult()` |
| `src/lib/uuid.ts` | `generateId('PE')` → IDs prefijados |
| `src/lib/syncLog.ts` | `insertSyncLog()`, `markSyncOk()`, `markSyncError()` |
| `src/lib/retrySync.ts` | `retryPendingSyncs()` — job de reintento |
| `src/services/*.service.ts` | CRUD con bifurcación mssql/pg + sync a Bolivia |
| `src/services/venta.service.ts` | Descuenta stock + inserta venta + sync dual |
| `src/services/dashboard.service.ts` | Métricas globales desde Bolivia + OPENQUERY |
| `src/services/analytics.service.ts` | Tendencias, rankings, alertas de stock |
| `src/jobs/syncRetry.job.ts` | Cron job cada 60s desde `instrumentation.ts` |
