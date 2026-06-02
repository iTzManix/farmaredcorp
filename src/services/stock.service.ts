// ============================================================
// src/services/stock.service.ts
// Gestión de stock por sucursal/medicamento.
//
// Reglas:
//   - El stock se descuenta automáticamente al registrar una venta.
//   - Si no hay stock suficiente, la venta se rechaza (400).
//   - La actualización de stock siempre sincroniza al almacén.
// ============================================================

import sql from 'mssql'
import { Pool } from 'pg'
import { getDbBolivia, NodeConnection } from '../lib/db'
import { generateId } from '../lib/uuid'
import { insertSyncLog } from '../lib/syncLog'
import { Stock, StockInput, StockUpdateInput } from '../types'
import { PaginationParams, buildPaginatedResult, PaginatedResult } from '../lib/pagination'

async function syncStockBolivia(d: Stock) {
  const db = await getDbBolivia()
  await db.request()
    .input('id_stock',       sql.VarChar(40),   d.id_stock)
    .input('id_medicamento', sql.VarChar(40),   d.id_medicamento)
    .input('id_sucursal',    sql.VarChar(40),   d.id_sucursal)
    .input('cantidad',       sql.Int,            d.cantidad)
    .input('precio_usd',     sql.Decimal(10,2),  d.precio_usd)
    .input('codigo_pais',    sql.Char(2),        d.codigo_pais)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM stock WHERE id_stock = @id_stock)
        INSERT INTO stock (id_stock,id_medicamento,id_sucursal,cantidad,precio_usd,fecha_actualizacion,codigo_pais)
        VALUES (@id_stock,@id_medicamento,@id_sucursal,@cantidad,@precio_usd,GETDATE(),@codigo_pais)
      ELSE
        UPDATE stock SET cantidad=@cantidad, precio_usd=@precio_usd, fecha_actualizacion=GETDATE()
        WHERE id_stock=@id_stock
    `)
}

export async function listarStock(
  nodeConn: NodeConnection,
  codigo_pais: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Stock>> {
  const limit  = pagination?.limit  ?? 1000
  const offset = pagination?.offset ?? 0
  const page   = pagination?.page   ?? 1

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const countRes = await db.request().input('cp', sql.Char(2), codigo_pais)
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM stock WHERE codigo_pais=@cp`)
    const total = countRes.recordset[0]?.total ?? 0
    const res = await db.request()
      .input('cp', sql.Char(2), codigo_pais).input('offset', sql.Int, offset).input('limit', sql.Int, limit)
      .query<Stock>(`
        SELECT s.id_stock, s.id_medicamento, s.id_sucursal, s.cantidad, s.precio_usd, s.fecha_actualizacion, s.codigo_pais,
               m.nombre AS medicamento_nombre, suc.nombre AS sucursal_nombre
        FROM stock s
        LEFT JOIN medicamento m ON s.id_medicamento = m.id_medicamento
        LEFT JOIN sucursal suc ON s.id_sucursal = suc.id_sucursal
        WHERE s.codigo_pais=@cp
        ORDER BY s.id_sucursal, s.id_medicamento
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `)
    return buildPaginatedResult(res.recordset, total, { page, limit, offset })
  } else {
    const db = await nodeConn.getDb() as Pool
    const countRes = await db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM stock WHERE codigo_pais=$1`, [codigo_pais]
    )
    const total = parseInt(countRes.rows[0]?.total ?? '0')
    const res = await db.query<Stock>(
      `SELECT s.id_stock, s.id_medicamento, s.id_sucursal, s.cantidad, s.precio_usd, s.fecha_actualizacion, s.codigo_pais,
              m.nombre AS medicamento_nombre, suc.nombre AS sucursal_nombre
       FROM stock s
       LEFT JOIN medicamento m ON s.id_medicamento = m.id_medicamento
       LEFT JOIN sucursal suc ON s.id_sucursal = suc.id_sucursal
       WHERE s.codigo_pais=$1 
       ORDER BY s.id_sucursal, s.id_medicamento LIMIT $2 OFFSET $3`,
      [codigo_pais, limit, offset]
    )
    return buildPaginatedResult(res.rows, total, { page, limit, offset })
  }
}

export async function obtenerStock(nodeConn: NodeConnection, id: string, codigo_pais: string): Promise<Stock | null> {
  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const res = await db.request()
      .input('id', sql.VarChar(40), id).input('cp', sql.Char(2), codigo_pais)
      .query<Stock>(`SELECT id_stock,id_medicamento,id_sucursal,cantidad,precio_usd,fecha_actualizacion,codigo_pais FROM stock WHERE id_stock=@id AND codigo_pais=@cp`)
    return res.recordset[0] ?? null
  } else {
    const db = await nodeConn.getDb() as Pool
    const res = await db.query<Stock>(
      `SELECT id_stock,id_medicamento,id_sucursal,cantidad,precio_usd,fecha_actualizacion,codigo_pais FROM stock WHERE id_stock=$1 AND codigo_pais=$2`,
      [id, codigo_pais]
    )
    return res.rows[0] ?? null
  }
}

export async function crearStock(nodeConn: NodeConnection, input: StockInput, codigo_pais: string): Promise<Stock> {
  const data: Stock = {
    ...input,
    id_stock: generateId(codigo_pais),
    fecha_actualizacion: new Date(),
    codigo_pais,
  }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request()
      .input('id_stock', sql.VarChar(40), data.id_stock)
      .input('id_medicamento', sql.VarChar(40), data.id_medicamento)
      .input('id_sucursal', sql.VarChar(40), data.id_sucursal)
      .input('cantidad', sql.Int, data.cantidad)
      .input('precio_usd', sql.Decimal(10, 2), data.precio_usd)
      .input('cp', sql.Char(2), data.codigo_pais)
      .query(`INSERT INTO stock (id_stock,id_medicamento,id_sucursal,cantidad,precio_usd,fecha_actualizacion,codigo_pais) VALUES(@id_stock,@id_medicamento,@id_sucursal,@cantidad,@precio_usd,GETDATE(),@cp)`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(
      `INSERT INTO stock (id_stock,id_medicamento,id_sucursal,cantidad,precio_usd,fecha_actualizacion,codigo_pais) VALUES($1,$2,$3,$4,$5,NOW(),$6)`,
      [data.id_stock, data.id_medicamento, data.id_sucursal, data.cantidad, data.precio_usd, data.codigo_pais]
    )
  }

  try { await syncStockBolivia(data) }
  catch (err) { await insertSyncLog({ tabla: 'stock', operacion: 'INSERT', id_registro: data.id_stock, payload: data as unknown as Record<string, unknown>, codigo_pais, error_detalle: err instanceof Error ? err.message : String(err) }) }
  return data
}

export async function actualizarStock(
  nodeConn: NodeConnection,
  id: string,
  input: StockUpdateInput,
  codigo_pais: string
): Promise<Stock | null> {
  const existing = await obtenerStock(nodeConn, id, codigo_pais)
  if (!existing) return null

  const data: Stock = {
    ...existing,
    cantidad:   input.cantidad  ?? existing.cantidad,
    precio_usd: input.precio_usd ?? existing.precio_usd,
    fecha_actualizacion: new Date(),
  }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request()
      .input('id', sql.VarChar(40), id)
      .input('cantidad', sql.Int, data.cantidad)
      .input('precio_usd', sql.Decimal(10, 2), data.precio_usd)
      .query(`UPDATE stock SET cantidad=@cantidad, precio_usd=@precio_usd, fecha_actualizacion=GETDATE() WHERE id_stock=@id`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(
      `UPDATE stock SET cantidad=$1, precio_usd=$2, fecha_actualizacion=NOW() WHERE id_stock=$3`,
      [data.cantidad, data.precio_usd, id]
    )
  }

  try { await syncStockBolivia(data) }
  catch (err) { await insertSyncLog({ tabla: 'stock', operacion: 'UPDATE', id_registro: id, payload: data as unknown as Record<string, unknown>, codigo_pais, error_detalle: err instanceof Error ? err.message : String(err) }) }
  return data
}

/**
 * Descuenta cantidad del stock. Lanza error si no hay suficiente stock.
 * Llamado internamente por venta.service.ts.
 */
export async function descontarStock(
  nodeConn: NodeConnection,
  id_medicamento: string,
  id_sucursal: string,
  cantidad: number,
  codigo_pais: string
): Promise<void> {
  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool

    // Verificar stock suficiente y descontar en una sola operación
    const res = await db.request()
      .input('id_medicamento', sql.VarChar(40), id_medicamento)
      .input('id_sucursal',    sql.VarChar(40), id_sucursal)
      .input('cantidad',       sql.Int,          cantidad)
      .input('cp',             sql.Char(2),      codigo_pais)
      .query(`
        UPDATE stock
        SET cantidad = cantidad - @cantidad, fecha_actualizacion = GETDATE()
        OUTPUT INSERTED.id_stock, INSERTED.cantidad
        WHERE id_medicamento = @id_medicamento
          AND id_sucursal    = @id_sucursal
          AND codigo_pais    = @cp
          AND cantidad       >= @cantidad
      `)

    if (res.recordset.length === 0) {
      throw new Error(`Stock insuficiente para medicamento ${id_medicamento} en sucursal ${id_sucursal}`)
    }

    // Sincronizar stock actualizado a Bolivia
    const updated = res.recordset[0]
    try {
      const boliDb = await getDbBolivia()
      await boliDb.request()
        .input('id_stock', sql.VarChar(40), updated.id_stock)
        .input('cantidad', sql.Int, updated.cantidad)
        .query(`UPDATE stock SET cantidad=@cantidad, fecha_actualizacion=GETDATE() WHERE id_stock=@id_stock`)
    } catch {
      // Fallo de sync no detiene la venta; el syncRetry job lo reintentará
    }
  } else {
    const db = await nodeConn.getDb() as Pool
    const res = await db.query(
      `UPDATE stock
       SET cantidad = cantidad - $1, fecha_actualizacion = NOW()
       WHERE id_medicamento = $2 AND id_sucursal = $3 AND codigo_pais = $4 AND cantidad >= $1
       RETURNING id_stock, cantidad`,
      [cantidad, id_medicamento, id_sucursal, codigo_pais]
    )
    if (res.rowCount === 0) {
      throw new Error(`Stock insuficiente para medicamento ${id_medicamento} en sucursal ${id_sucursal}`)
    }

    const updated = res.rows[0]
    try {
      const boliDb = await getDbBolivia()
      await boliDb.request()
        .input('id_stock', sql.VarChar(40), updated.id_stock)
        .input('cantidad', sql.Int, updated.cantidad)
        .query(`UPDATE stock SET cantidad=@cantidad, fecha_actualizacion=GETDATE() WHERE id_stock=@id_stock`)
    } catch {
      // ignorar fallo de sync — job lo reintentará
    }
  }
}
