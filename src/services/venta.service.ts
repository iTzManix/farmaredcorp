// ============================================================
// src/services/venta.service.ts
// Registro de ventas con descuento de stock y sincronización.
//
// Reglas críticas:
//   - Ventas y detalle_venta NUNCA se eliminan (ni lógica ni físicamente).
//   - Si el stock es insuficiente, la venta se rechaza (400) antes de insertar.
//   - El stock se descuenta ANTES de registrar la venta.
//   - Si falla la inserción de la venta, el stock ya descontado NO se revierte
//     en esta versión académica (se asume que el stock se controló correctamente).
// ============================================================

import sql from 'mssql'
import { Pool } from 'pg'
import { getDbBolivia, NodeConnection } from '../lib/db'
import { generateId } from '../lib/uuid'
import { insertSyncLog } from '../lib/syncLog'
import { descontarStock } from './stock.service'
import { VentaInput, Venta, DetalleVenta, VentaCompleta } from '../types'
import { PaginationParams, buildPaginatedResult, PaginatedResult } from '../lib/pagination'

async function syncVentaBolivia(venta: Venta, detalles: DetalleVenta[]) {
  const db = await getDbBolivia()

  // Sincronizar venta principal
  await db.request()
    .input('id_venta',        sql.VarChar(40),   venta.id_venta)
    .input('id_cliente',      sql.VarChar(40),   venta.id_cliente)
    .input('id_empleado',     sql.VarChar(40),   venta.id_empleado)
    .input('id_sucursal',     sql.VarChar(40),   venta.id_sucursal)
    .input('monto_total_usd', sql.Decimal(10,2), venta.monto_total_usd)
    .input('codigo_pais',     sql.Char(2),       venta.codigo_pais)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM venta WHERE id_venta = @id_venta)
        INSERT INTO venta (id_venta,id_cliente,id_empleado,id_sucursal,fecha,monto_total_usd,codigo_pais)
        VALUES (@id_venta,@id_cliente,@id_empleado,@id_sucursal,GETDATE(),@monto_total_usd,@codigo_pais)
    `)

  // Sincronizar cada detalle
  for (const d of detalles) {
    await db.request()
      .input('id_detalle',          sql.VarChar(40),   d.id_detalle)
      .input('id_venta',            sql.VarChar(40),   d.id_venta)
      .input('id_medicamento',      sql.VarChar(40),   d.id_medicamento)
      .input('cantidad',            sql.Int,            d.cantidad)
      .input('precio_unitario_usd', sql.Decimal(10,2), d.precio_unitario_usd)
      .input('subtotal_usd',        sql.Decimal(10,2), d.subtotal_usd)
      .input('codigo_pais',         sql.Char(2),       d.codigo_pais)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM detalle_venta WHERE id_detalle = @id_detalle)
          INSERT INTO detalle_venta (id_detalle,id_venta,id_medicamento,cantidad,precio_unitario_usd,subtotal_usd,codigo_pais)
          VALUES (@id_detalle,@id_venta,@id_medicamento,@cantidad,@precio_unitario_usd,@subtotal_usd,@codigo_pais)
      `)
  }
}

export async function registrarVenta(
  nodeConn: NodeConnection,
  input: VentaInput,
  codigo_pais: string
): Promise<VentaCompleta> {
  if (!input.detalles || input.detalles.length === 0) {
    throw new Error('La venta debe tener al menos un detalle')
  }

  // ─── Paso 1: Descontar stock para cada medicamento ───────────────────────
  for (const det of input.detalles) {
    // Lanza Error si no hay stock suficiente → venta rechazada con 400
    await descontarStock(
      nodeConn,
      det.id_medicamento,
      input.id_sucursal,
      det.cantidad,
      codigo_pais
    )
  }

  // ─── Paso 2: Construir entidades ─────────────────────────────────────────
  const id_venta = generateId(codigo_pais)
  const detalles: DetalleVenta[] = input.detalles.map((d) => {
    const subtotal = d.cantidad * d.precio_unitario_usd
    return {
      id_detalle:         generateId(codigo_pais),
      id_venta,
      id_medicamento:     d.id_medicamento,
      cantidad:           d.cantidad,
      precio_unitario_usd: d.precio_unitario_usd,
      subtotal_usd:       parseFloat(subtotal.toFixed(2)),
      codigo_pais,
    }
  })

  const monto_total = detalles.reduce((sum, d) => sum + d.subtotal_usd, 0)
  const venta: Venta = {
    id_venta,
    id_cliente:     input.id_cliente,
    id_empleado:    input.id_empleado,
    id_sucursal:    input.id_sucursal,
    fecha:          new Date(),
    monto_total_usd: parseFloat(monto_total.toFixed(2)),
    codigo_pais,
  }

  // ─── Paso 3: Insertar en nodo operativo ──────────────────────────────────
  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool

    await db.request()
      .input('id_venta',        sql.VarChar(40),   venta.id_venta)
      .input('id_cliente',      sql.VarChar(40),   venta.id_cliente)
      .input('id_empleado',     sql.VarChar(40),   venta.id_empleado)
      .input('id_sucursal',     sql.VarChar(40),   venta.id_sucursal)
      .input('monto_total_usd', sql.Decimal(10,2), venta.monto_total_usd)
      .input('cp',              sql.Char(2),        venta.codigo_pais)
      .query(`INSERT INTO venta (id_venta,id_cliente,id_empleado,id_sucursal,fecha,monto_total_usd,codigo_pais) VALUES(@id_venta,@id_cliente,@id_empleado,@id_sucursal,GETDATE(),@monto_total_usd,@cp)`)

    for (const d of detalles) {
      await db.request()
        .input('id_detalle', sql.VarChar(40), d.id_detalle)
        .input('id_venta', sql.VarChar(40), d.id_venta)
        .input('id_medicamento', sql.VarChar(40), d.id_medicamento)
        .input('cantidad', sql.Int, d.cantidad)
        .input('precio_unitario_usd', sql.Decimal(10,2), d.precio_unitario_usd)
        .input('subtotal_usd', sql.Decimal(10,2), d.subtotal_usd)
        .input('cp', sql.Char(2), d.codigo_pais)
        .query(`INSERT INTO detalle_venta (id_detalle,id_venta,id_medicamento,cantidad,precio_unitario_usd,subtotal_usd,codigo_pais) VALUES(@id_detalle,@id_venta,@id_medicamento,@cantidad,@precio_unitario_usd,@subtotal_usd,@cp)`)
    }
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(
      `INSERT INTO venta (id_venta,id_cliente,id_empleado,id_sucursal,fecha,monto_total_usd,codigo_pais) VALUES($1,$2,$3,$4,NOW(),$5,$6)`,
      [venta.id_venta, venta.id_cliente, venta.id_empleado, venta.id_sucursal, venta.monto_total_usd, venta.codigo_pais]
    )
    for (const d of detalles) {
      await db.query(
        `INSERT INTO detalle_venta (id_detalle,id_venta,id_medicamento,cantidad,precio_unitario_usd,subtotal_usd,codigo_pais) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [d.id_detalle, d.id_venta, d.id_medicamento, d.cantidad, d.precio_unitario_usd, d.subtotal_usd, d.codigo_pais]
      )
    }
  }

  // ─── Paso 4: Sincronizar al almacén central ───────────────────────────────
  try {
    await syncVentaBolivia(venta, detalles)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await insertSyncLog({ tabla: 'venta', operacion: 'INSERT', id_registro: id_venta, payload: venta as unknown as Record<string, unknown>, codigo_pais, error_detalle: msg })
    for (const d of detalles) {
      await insertSyncLog({ tabla: 'detalle_venta', operacion: 'INSERT', id_registro: d.id_detalle, payload: d as unknown as Record<string, unknown>, codigo_pais, error_detalle: msg })
    }
  }

  return { ...venta, detalles }
}

export async function listarVentas(
  nodeConn: NodeConnection,
  codigo_pais: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Venta>> {
  const limit  = pagination?.limit  ?? 1000
  const offset = pagination?.offset ?? 0
  const page   = pagination?.page   ?? 1

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const countRes = await db.request().input('cp', sql.Char(2), codigo_pais)
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM venta WHERE codigo_pais=@cp`)
    const total = countRes.recordset[0]?.total ?? 0
    const res = await db.request()
      .input('cp', sql.Char(2), codigo_pais).input('offset', sql.Int, offset).input('limit', sql.Int, limit)
      .query<Venta>(`
        SELECT v.id_venta, v.id_cliente, v.id_empleado, v.id_sucursal, v.fecha, v.monto_total_usd, v.codigo_pais,
               c.nombre AS cliente_nombre
        FROM venta v
        LEFT JOIN cliente c ON v.id_cliente = c.id_cliente
        WHERE v.codigo_pais=@cp
        ORDER BY v.fecha DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `)
    return buildPaginatedResult(res.recordset, total, { page, limit, offset })
  } else {
    const db = await nodeConn.getDb() as Pool
    const countRes = await db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM venta WHERE codigo_pais=$1`, [codigo_pais]
    )
    const total = parseInt(countRes.rows[0]?.total ?? '0')
    const res = await db.query<Venta>(
      `SELECT v.id_venta, v.id_cliente, v.id_empleado, v.id_sucursal, v.fecha, v.monto_total_usd, v.codigo_pais,
              c.nombre AS cliente_nombre
       FROM venta v
       LEFT JOIN cliente c ON v.id_cliente = c.id_cliente
       WHERE v.codigo_pais=$1 ORDER BY v.fecha DESC LIMIT $2 OFFSET $3`,
      [codigo_pais, limit, offset]
    )
    return buildPaginatedResult(res.rows, total, { page, limit, offset })
  }
}

export async function obtenerVenta(nodeConn: NodeConnection, id: string, codigo_pais: string): Promise<VentaCompleta | null> {
  let venta: Venta | null
  let detalles: DetalleVenta[]

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const resV = await db.request()
      .input('id', sql.VarChar(40), id).input('cp', sql.Char(2), codigo_pais)
      .query<Venta>(`SELECT id_venta,id_cliente,id_empleado,id_sucursal,fecha,monto_total_usd,codigo_pais FROM venta WHERE id_venta=@id AND codigo_pais=@cp`)
    venta = resV.recordset[0] ?? null
    if (!venta) return null
    const resD = await db.request().input('id_venta', sql.VarChar(40), id)
      .query<DetalleVenta>(`SELECT id_detalle,id_venta,id_medicamento,cantidad,precio_unitario_usd,subtotal_usd,codigo_pais FROM detalle_venta WHERE id_venta=@id_venta`)
    detalles = resD.recordset
  } else {
    const db = await nodeConn.getDb() as Pool
    const resV = await db.query<Venta>(`SELECT id_venta,id_cliente,id_empleado,id_sucursal,fecha,monto_total_usd,codigo_pais FROM venta WHERE id_venta=$1 AND codigo_pais=$2`, [id, codigo_pais])
    venta = resV.rows[0] ?? null
    if (!venta) return null
    const resD = await db.query<DetalleVenta>(`SELECT id_detalle,id_venta,id_medicamento,cantidad,precio_unitario_usd,subtotal_usd,codigo_pais FROM detalle_venta WHERE id_venta=$1`, [id])
    detalles = resD.rows
  }

  return { ...venta, detalles }
}
