// ============================================================
// src/services/sucursal.service.ts
// CRUD de sucursales con sincronización al almacén Bolivia.
// ============================================================

import sql from 'mssql'
import { Pool } from 'pg'
import { getDbBolivia, NodeConnection } from '../lib/db'
import { generateId } from '../lib/uuid'
import { insertSyncLog } from '../lib/syncLog'
import { Sucursal, SucursalInput } from '../types'
import { PaginationParams, buildPaginatedResult, PaginatedResult } from '../lib/pagination'

async function syncSucursalBolivia(d: Sucursal) {
  const db = await getDbBolivia()
  await db.request()
    .input('id_sucursal', sql.VarChar(40),  d.id_sucursal)
    .input('nombre',      sql.VarChar(100), d.nombre)
    .input('direccion',   sql.VarChar(200), d.direccion)
    .input('activo',      sql.Bit,          d.activo ? 1 : 0)
    .input('codigo_pais', sql.Char(2),      d.codigo_pais)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM sucursal WHERE id_sucursal = @id_sucursal)
        INSERT INTO sucursal (id_sucursal, nombre, direccion, activo, codigo_pais)
        VALUES (@id_sucursal, @nombre, @direccion, @activo, @codigo_pais)
      ELSE
        UPDATE sucursal SET nombre=@nombre, direccion=@direccion, activo=@activo
        WHERE id_sucursal=@id_sucursal
    `)
}

export async function listarSucursales(
  nodeConn: NodeConnection,
  codigo_pais: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Sucursal>> {
  const limit  = pagination?.limit  ?? 1000
  const offset = pagination?.offset ?? 0
  const page   = pagination?.page   ?? 1

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const countRes = await db.request().input('cp', sql.Char(2), codigo_pais)
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM sucursal WHERE codigo_pais=@cp AND activo=1`)
    const total = countRes.recordset[0]?.total ?? 0
    const res = await db.request()
      .input('cp', sql.Char(2), codigo_pais).input('offset', sql.Int, offset).input('limit', sql.Int, limit)
      .query<Sucursal>(`
        SELECT id_sucursal, nombre, direccion, activo, codigo_pais
        FROM sucursal WHERE codigo_pais=@cp AND activo=1
        ORDER BY nombre OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `)
    return buildPaginatedResult(res.recordset, total, { page, limit, offset })
  } else {
    const db = await nodeConn.getDb() as Pool
    const countRes = await db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM sucursal WHERE codigo_pais=$1 AND activo=TRUE`, [codigo_pais]
    )
    const total = parseInt(countRes.rows[0]?.total ?? '0')
    const res = await db.query<Sucursal>(
      `SELECT id_sucursal, nombre, direccion, activo, codigo_pais
       FROM sucursal WHERE codigo_pais=$1 AND activo=TRUE ORDER BY nombre LIMIT $2 OFFSET $3`,
      [codigo_pais, limit, offset]
    )
    return buildPaginatedResult(res.rows, total, { page, limit, offset })
  }
}

export async function obtenerSucursal(nodeConn: NodeConnection, id: string, codigo_pais: string): Promise<Sucursal | null> {
  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const res = await db.request()
      .input('id', sql.VarChar(40), id).input('cp', sql.Char(2), codigo_pais)
      .query<Sucursal>(`SELECT id_sucursal, nombre, direccion, activo, codigo_pais FROM sucursal WHERE id_sucursal=@id AND codigo_pais=@cp`)
    return res.recordset[0] ?? null
  } else {
    const db = await nodeConn.getDb() as Pool
    const res = await db.query<Sucursal>(
      `SELECT id_sucursal, nombre, direccion, activo, codigo_pais FROM sucursal WHERE id_sucursal=$1 AND codigo_pais=$2`,
      [id, codigo_pais]
    )
    return res.rows[0] ?? null
  }
}

export async function crearSucursal(nodeConn: NodeConnection, input: SucursalInput, codigo_pais: string): Promise<Sucursal> {
  const data: Sucursal = { ...input, id_sucursal: generateId(codigo_pais), activo: true, codigo_pais }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request()
      .input('id_sucursal', sql.VarChar(40), data.id_sucursal)
      .input('nombre', sql.VarChar(100), data.nombre)
      .input('direccion', sql.VarChar(200), data.direccion)
      .input('cp', sql.Char(2), data.codigo_pais)
      .query(`INSERT INTO sucursal (id_sucursal,nombre,direccion,activo,codigo_pais) VALUES(@id_sucursal,@nombre,@direccion,1,@cp)`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(
      `INSERT INTO sucursal (id_sucursal,nombre,direccion,activo,codigo_pais) VALUES($1,$2,$3,TRUE,$4)`,
      [data.id_sucursal, data.nombre, data.direccion, data.codigo_pais]
    )
  }

  try { await syncSucursalBolivia(data) }
  catch (err) {
    await insertSyncLog({ tabla: 'sucursal', operacion: 'INSERT', id_registro: data.id_sucursal, payload: data as unknown as Record<string, unknown>, codigo_pais, error_detalle: err instanceof Error ? err.message : String(err) })
  }
  return data
}

export async function actualizarSucursal(nodeConn: NodeConnection, id: string, input: Partial<SucursalInput>, codigo_pais: string): Promise<Sucursal | null> {
  const existing = await obtenerSucursal(nodeConn, id, codigo_pais)
  if (!existing) return null
  const data: Sucursal = { ...existing, ...input }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request()
      .input('id', sql.VarChar(40), id)
      .input('nombre', sql.VarChar(100), data.nombre)
      .input('direccion', sql.VarChar(200), data.direccion)
      .query(`UPDATE sucursal SET nombre=@nombre, direccion=@direccion WHERE id_sucursal=@id`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(`UPDATE sucursal SET nombre=$1, direccion=$2 WHERE id_sucursal=$3`, [data.nombre, data.direccion, id])
  }

  try { await syncSucursalBolivia(data) }
  catch (err) { await insertSyncLog({ tabla: 'sucursal', operacion: 'UPDATE', id_registro: id, payload: data as unknown as Record<string, unknown>, codigo_pais, error_detalle: err instanceof Error ? err.message : String(err) }) }
  return data
}

export async function eliminarSucursal(nodeConn: NodeConnection, id: string, codigo_pais: string): Promise<boolean> {
  const existing = await obtenerSucursal(nodeConn, id, codigo_pais)
  if (!existing) return false

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request().input('id', sql.VarChar(40), id).query(`UPDATE sucursal SET activo=0 WHERE id_sucursal=@id`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(`UPDATE sucursal SET activo=FALSE WHERE id_sucursal=$1`, [id])
  }

  const data = { ...existing, activo: false }
  try { await syncSucursalBolivia(data) }
  catch (err) { await insertSyncLog({ tabla: 'sucursal', operacion: 'UPDATE', id_registro: id, payload: data as unknown as Record<string, unknown>, codigo_pais, error_detalle: err instanceof Error ? err.message : String(err) }) }
  return true
}
