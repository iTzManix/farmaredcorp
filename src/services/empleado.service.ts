// ============================================================
// src/services/empleado.service.ts
// CRUD de empleados con sincronización al almacén Bolivia.
// El empleado está ligado a una sucursal del mismo país.
// ============================================================

import sql from 'mssql'
import { Pool } from 'pg'
import { getDbBolivia, NodeConnection } from '../lib/db'
import { generateId } from '../lib/uuid'
import { insertSyncLog } from '../lib/syncLog'
import { Empleado, EmpleadoInput } from '../types'
import { PaginationParams, buildPaginatedResult, PaginatedResult } from '../lib/pagination'

async function syncEmpleadoBolivia(d: Empleado) {
  const db = await getDbBolivia()
  await db.request()
    .input('id_empleado',  sql.VarChar(40),  d.id_empleado)
    .input('nombre',       sql.VarChar(100), d.nombre)
    .input('cargo',        sql.VarChar(100), d.cargo)
    .input('id_sucursal',  sql.VarChar(40),  d.id_sucursal)
    .input('activo',       sql.Bit,          d.activo ? 1 : 0)
    .input('codigo_pais',  sql.Char(2),      d.codigo_pais)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM empleado WHERE id_empleado = @id_empleado)
        INSERT INTO empleado (id_empleado, nombre, cargo, id_sucursal, activo, codigo_pais)
        VALUES (@id_empleado, @nombre, @cargo, @id_sucursal, @activo, @codigo_pais)
      ELSE
        UPDATE empleado SET nombre=@nombre, cargo=@cargo, id_sucursal=@id_sucursal, activo=@activo
        WHERE id_empleado=@id_empleado
    `)
}

export async function listarEmpleados(
  nodeConn: NodeConnection,
  codigo_pais: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Empleado>> {
  const limit  = pagination?.limit  ?? 1000
  const offset = pagination?.offset ?? 0
  const page   = pagination?.page   ?? 1

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const countRes = await db.request().input('cp', sql.Char(2), codigo_pais)
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM empleado WHERE codigo_pais=@cp AND activo=1`)
    const total = countRes.recordset[0]?.total ?? 0
    const res = await db.request()
      .input('cp', sql.Char(2), codigo_pais).input('offset', sql.Int, offset).input('limit', sql.Int, limit)
      .query<Empleado>(`
        SELECT id_empleado, nombre, cargo, id_sucursal, activo, codigo_pais
        FROM empleado WHERE codigo_pais=@cp AND activo=1
        ORDER BY nombre OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `)
    return buildPaginatedResult(res.recordset, total, { page, limit, offset })
  } else {
    const db = await nodeConn.getDb() as Pool
    const countRes = await db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM empleado WHERE codigo_pais=$1 AND activo=TRUE`, [codigo_pais]
    )
    const total = parseInt(countRes.rows[0]?.total ?? '0')
    const res = await db.query<Empleado>(
      `SELECT id_empleado, nombre, cargo, id_sucursal, activo, codigo_pais
       FROM empleado WHERE codigo_pais=$1 AND activo=TRUE ORDER BY nombre LIMIT $2 OFFSET $3`,
      [codigo_pais, limit, offset]
    )
    return buildPaginatedResult(res.rows, total, { page, limit, offset })
  }
}

export async function obtenerEmpleado(nodeConn: NodeConnection, id: string, codigo_pais: string): Promise<Empleado | null> {
  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const res = await db.request()
      .input('id', sql.VarChar(40), id).input('cp', sql.Char(2), codigo_pais)
      .query<Empleado>(`SELECT id_empleado, nombre, cargo, id_sucursal, activo, codigo_pais FROM empleado WHERE id_empleado=@id AND codigo_pais=@cp`)
    return res.recordset[0] ?? null
  } else {
    const db = await nodeConn.getDb() as Pool
    const res = await db.query<Empleado>(
      `SELECT id_empleado, nombre, cargo, id_sucursal, activo, codigo_pais FROM empleado WHERE id_empleado=$1 AND codigo_pais=$2`,
      [id, codigo_pais]
    )
    return res.rows[0] ?? null
  }
}

export async function crearEmpleado(nodeConn: NodeConnection, input: EmpleadoInput, codigo_pais: string): Promise<Empleado> {
  const data: Empleado = { ...input, id_empleado: generateId(codigo_pais), activo: true, codigo_pais }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request()
      .input('id_empleado', sql.VarChar(40), data.id_empleado)
      .input('nombre', sql.VarChar(100), data.nombre)
      .input('cargo', sql.VarChar(100), data.cargo)
      .input('id_sucursal', sql.VarChar(40), data.id_sucursal)
      .input('cp', sql.Char(2), data.codigo_pais)
      .query(`INSERT INTO empleado (id_empleado,nombre,cargo,id_sucursal,activo,codigo_pais) VALUES(@id_empleado,@nombre,@cargo,@id_sucursal,1,@cp)`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(
      `INSERT INTO empleado (id_empleado,nombre,cargo,id_sucursal,activo,codigo_pais) VALUES($1,$2,$3,$4,TRUE,$5)`,
      [data.id_empleado, data.nombre, data.cargo, data.id_sucursal, data.codigo_pais]
    )
  }

  try { await syncEmpleadoBolivia(data) }
  catch (err) { await insertSyncLog({ tabla: 'empleado', operacion: 'INSERT', id_registro: data.id_empleado, payload: data as unknown as Record<string, unknown>, codigo_pais, error_detalle: err instanceof Error ? err.message : String(err) }) }
  return data
}

export async function actualizarEmpleado(nodeConn: NodeConnection, id: string, input: Partial<EmpleadoInput>, codigo_pais: string): Promise<Empleado | null> {
  const existing = await obtenerEmpleado(nodeConn, id, codigo_pais)
  if (!existing) return null
  const data: Empleado = { ...existing, ...input }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request()
      .input('id', sql.VarChar(40), id)
      .input('nombre', sql.VarChar(100), data.nombre)
      .input('cargo', sql.VarChar(100), data.cargo)
      .input('id_sucursal', sql.VarChar(40), data.id_sucursal)
      .query(`UPDATE empleado SET nombre=@nombre, cargo=@cargo, id_sucursal=@id_sucursal WHERE id_empleado=@id`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(`UPDATE empleado SET nombre=$1, cargo=$2, id_sucursal=$3 WHERE id_empleado=$4`, [data.nombre, data.cargo, data.id_sucursal, id])
  }

  try { await syncEmpleadoBolivia(data) }
  catch (err) { await insertSyncLog({ tabla: 'empleado', operacion: 'UPDATE', id_registro: id, payload: data as unknown as Record<string, unknown>, codigo_pais, error_detalle: err instanceof Error ? err.message : String(err) }) }
  return data
}

export async function eliminarEmpleado(nodeConn: NodeConnection, id: string, codigo_pais: string): Promise<boolean> {
  const existing = await obtenerEmpleado(nodeConn, id, codigo_pais)
  if (!existing) return false

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request().input('id', sql.VarChar(40), id).query(`UPDATE empleado SET activo=0 WHERE id_empleado=@id`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(`UPDATE empleado SET activo=FALSE WHERE id_empleado=$1`, [id])
  }

  const data = { ...existing, activo: false }
  try { await syncEmpleadoBolivia(data) }
  catch (err) { await insertSyncLog({ tabla: 'empleado', operacion: 'UPDATE', id_registro: id, payload: data as unknown as Record<string, unknown>, codigo_pais, error_detalle: err instanceof Error ? err.message : String(err) }) }
  return true
}
