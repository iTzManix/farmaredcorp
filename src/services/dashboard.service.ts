// ============================================================
// src/services/dashboard.service.ts
// Métricas globales para el superadmin via OPENQUERY.
//
// El superadmin consulta datos de PE y CL a través de los
// linked servers configurados en Bolivia.
// Los datos de Bolivia se consultan directamente.
// ============================================================

import sql from 'mssql'
import { getDbBolivia } from '../lib/db'
import { SyncLogRow } from '../types'

// ─── Resumen global ───────────────────────────────────────────────────────────

export interface ResumenGlobal {
  ventas_pe:    number
  ventas_cl:    number
  ventas_total: number
  clientes_pe:  number
  clientes_cl:  number
  stock_pe:     number  // unidades totales en PE
  stock_cl:     number  // unidades totales en CL
  sync_pendientes: number
  sync_errores:    number
}

export async function getResumenGlobal(): Promise<ResumenGlobal> {
  const db = await getDbBolivia()

  // Consultar desde almacén central (Bolivia ya tiene los datos sincrónicos)
  const res = await db.request().query<{
    ventas_pe: number; ventas_cl: number
    clientes_pe: number; clientes_cl: number
    stock_pe: number; stock_cl: number
    sync_pendientes: number; sync_errores: number
  }>(`
    SELECT
      (SELECT COUNT(*) FROM venta   WHERE codigo_pais = 'PE') AS ventas_pe,
      (SELECT COUNT(*) FROM venta   WHERE codigo_pais = 'CL') AS ventas_cl,
      (SELECT COUNT(*) FROM cliente WHERE codigo_pais = 'PE' AND activo = 1) AS clientes_pe,
      (SELECT COUNT(*) FROM cliente WHERE codigo_pais = 'CL' AND activo = 1) AS clientes_cl,
      (SELECT ISNULL(SUM(cantidad), 0) FROM stock WHERE codigo_pais = 'PE') AS stock_pe,
      (SELECT ISNULL(SUM(cantidad), 0) FROM stock WHERE codigo_pais = 'CL') AS stock_cl,
      (SELECT COUNT(*) FROM sync_log WHERE estado = 'PENDIENTE') AS sync_pendientes,
      (SELECT COUNT(*) FROM sync_log WHERE estado = 'ERROR')     AS sync_errores
  `)

  const row = res.recordset[0]
  return {
    ...row,
    ventas_total: row.ventas_pe + row.ventas_cl,
  }
}

// ─── Ventas por país ─────────────────────────────────────────────────────────

export interface VentaResumen {
  id_venta: string
  id_cliente: string
  id_sucursal: string
  fecha: Date
  monto_total_usd: number
  codigo_pais: string
}

export async function getVentasPorPais(codigo_pais?: string): Promise<VentaResumen[]> {
  const db = await getDbBolivia()
  const whereClause = codigo_pais && ['PE','CL'].includes(codigo_pais)
    ? `WHERE v.codigo_pais = '${codigo_pais}'`
    : `WHERE v.codigo_pais IN ('PE', 'CL')`

  const res = await db.request().query<VentaResumen>(`
    SELECT id_venta, id_cliente, id_sucursal, fecha, monto_total_usd, codigo_pais
    FROM venta ${whereClause}
    ORDER BY fecha DESC
  `)
  return res.recordset
}

// ─── Clientes por país ───────────────────────────────────────────────────────

export interface ClienteResumen {
  id_cliente: string
  nombre: string
  email: string | null
  codigo_pais: string
}

export async function getClientesPorPais(codigo_pais?: string): Promise<ClienteResumen[]> {
  const db = await getDbBolivia()
  const whereClause = codigo_pais && ['PE','CL'].includes(codigo_pais)
    ? `WHERE codigo_pais = '${codigo_pais}' AND activo = 1`
    : `WHERE codigo_pais IN ('PE', 'CL') AND activo = 1`

  const res = await db.request().query<ClienteResumen>(`
    SELECT id_cliente, nombre, email, codigo_pais
    FROM cliente ${whereClause}
    ORDER BY codigo_pais, nombre
  `)
  return res.recordset
}

// ─── Stock por país ──────────────────────────────────────────────────────────

export interface StockResumen {
  id_stock: string
  id_medicamento: string
  id_sucursal: string
  cantidad: number
  precio_usd: number
  codigo_pais: string
}

export async function getStockPorPais(codigo_pais?: string): Promise<StockResumen[]> {
  const db = await getDbBolivia()
  const whereClause = codigo_pais && ['PE','CL'].includes(codigo_pais)
    ? `WHERE codigo_pais = '${codigo_pais}'`
    : `WHERE codigo_pais IN ('PE', 'CL')`

  const res = await db.request().query<StockResumen>(`
    SELECT id_stock, id_medicamento, id_sucursal, cantidad, precio_usd, codigo_pais
    FROM stock ${whereClause}
    ORDER BY codigo_pais, id_sucursal
  `)
  return res.recordset
}

// ─── Sync Log ────────────────────────────────────────────────────────────────

export async function getSyncLog(estado?: string): Promise<SyncLogRow[]> {
  const db = await getDbBolivia()
  const whereClause = estado && ['PENDIENTE','OK','ERROR'].includes(estado)
    ? `WHERE estado = '${estado}'`
    : ''

  const res = await db.request().query<SyncLogRow>(`
    SELECT TOP 200
      id_log, tabla, operacion, id_registro, payload, codigo_pais,
      estado, intentos, fecha_creacion, fecha_ultimo_intento, error_detalle
    FROM sync_log ${whereClause}
    ORDER BY fecha_creacion DESC
  `)
  return res.recordset
}

// ─── OPENQUERY directo (lectura en tiempo real desde nodos) ──────────────────
// Útil para datos muy recientes que aún no llegaron al almacén central.

export async function getClientesLiveFromNode(codigo_pais: 'PE' | 'CL'): Promise<unknown[]> {
  const db = await getDbBolivia()
  const linkedServer = codigo_pais === 'PE' ? 'FARMACIA_NODO_PERU' : 'FARMACIA_NODO_CHILE'

  let query: string
  if (codigo_pais === 'PE') {
    // SQL Server linked server: usa nombre completo de tabla
    query = `SELECT * FROM OPENQUERY(${linkedServer}, 'SELECT id_cliente, nombre, email, telefono, codigo_pais FROM farmaredcorp.dbo.cliente WHERE activo = 1')`
  } else {
    // PostgreSQL via ODBC: sin esquema explícito en OPENQUERY
    query = `SELECT * FROM OPENQUERY(${linkedServer}, 'SELECT id_cliente, nombre, email, telefono, codigo_pais FROM cliente WHERE activo = TRUE')`
  }

  const res = await db.request().query(query)
  return res.recordset
}
