// ============================================================
// src/services/medicamento.service.ts
// CRUD de medicamentos con sincronización al almacén Bolivia.
//
// Regla crítica: Desactivar un medicamento NO elimina ventas
// históricas ni registros de detalle que lo referencien.
// ============================================================

import sql from 'mssql'
import { Pool } from 'pg'
import { getDbBolivia, NodeConnection } from '../lib/db'
import { generateId } from '../lib/uuid'
import { insertSyncLog } from '../lib/syncLog'
import { Medicamento, MedicamentoInput } from '../types'
import { PaginationParams, buildPaginatedResult, PaginatedResult } from '../lib/pagination'

async function syncMedicamentoBolivia(d: Medicamento) {
  const db = await getDbBolivia()
  await db
    .request()
    .input('id_medicamento', sql.VarChar(40),  d.id_medicamento)
    .input('nombre',         sql.VarChar(100), d.nombre)
    .input('descripcion',    sql.VarChar(500), d.descripcion ?? null)
    .input('activo',         sql.Bit,          d.activo ? 1 : 0)
    .input('codigo_pais',    sql.Char(2),      d.codigo_pais)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM medicamento WHERE id_medicamento = @id_medicamento)
        INSERT INTO medicamento (id_medicamento, nombre, descripcion, activo, codigo_pais)
        VALUES (@id_medicamento, @nombre, @descripcion, @activo, @codigo_pais)
      ELSE
        UPDATE medicamento
        SET nombre = @nombre, descripcion = @descripcion, activo = @activo
        WHERE id_medicamento = @id_medicamento
    `)
}

export async function listarMedicamentos(
  nodeConn: NodeConnection,
  codigo_pais: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Medicamento>> {
  const limit  = pagination?.limit  ?? 1000
  const offset = pagination?.offset ?? 0
  const page   = pagination?.page   ?? 1

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const countRes = await db.request().input('cp', sql.Char(2), codigo_pais)
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM medicamento WHERE codigo_pais = @cp AND activo = 1`)
    const total = countRes.recordset[0]?.total ?? 0
    const res = await db.request()
      .input('cp', sql.Char(2), codigo_pais)
      .input('offset', sql.Int, offset).input('limit', sql.Int, limit)
      .query<Medicamento>(`
        SELECT id_medicamento, nombre, descripcion, activo, codigo_pais
        FROM medicamento WHERE codigo_pais = @cp AND activo = 1
        ORDER BY nombre OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `)
    return buildPaginatedResult(res.recordset, total, { page, limit, offset })
  } else {
    const db = await nodeConn.getDb() as Pool
    const countRes = await db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM medicamento WHERE codigo_pais = $1 AND activo = TRUE`, [codigo_pais]
    )
    const total = parseInt(countRes.rows[0]?.total ?? '0')
    const res = await db.query<Medicamento>(
      `SELECT id_medicamento, nombre, descripcion, activo, codigo_pais
       FROM medicamento WHERE codigo_pais = $1 AND activo = TRUE ORDER BY nombre LIMIT $2 OFFSET $3`,
      [codigo_pais, limit, offset]
    )
    return buildPaginatedResult(res.rows, total, { page, limit, offset })
  }
}

export async function obtenerMedicamento(
  nodeConn: NodeConnection,
  id: string,
  codigo_pais: string
): Promise<Medicamento | null> {
  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const res = await db.request()
      .input('id', sql.VarChar(40), id)
      .input('codigo_pais', sql.Char(2), codigo_pais)
      .query<Medicamento>(`
        SELECT id_medicamento, nombre, descripcion, activo, codigo_pais
        FROM medicamento WHERE id_medicamento = @id AND codigo_pais = @codigo_pais
      `)
    return res.recordset[0] ?? null
  } else {
    const db = await nodeConn.getDb() as Pool
    const res = await db.query<Medicamento>(
      `SELECT id_medicamento, nombre, descripcion, activo, codigo_pais
       FROM medicamento WHERE id_medicamento = $1 AND codigo_pais = $2`,
      [id, codigo_pais]
    )
    return res.rows[0] ?? null
  }
}

export async function crearMedicamento(
  nodeConn: NodeConnection,
  input: MedicamentoInput,
  codigo_pais: string
): Promise<Medicamento> {
  const data: Medicamento = {
    ...input,
    id_medicamento: generateId(codigo_pais),
    descripcion: input.descripcion ?? null,
    activo: true,
    codigo_pais,
  }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request()
      .input('id_medicamento', sql.VarChar(40),  data.id_medicamento)
      .input('nombre',         sql.VarChar(100), data.nombre)
      .input('descripcion',    sql.VarChar(500), data.descripcion ?? null)
      .input('codigo_pais',    sql.Char(2),      data.codigo_pais)
      .query(`
        INSERT INTO medicamento (id_medicamento, nombre, descripcion, activo, codigo_pais)
        VALUES (@id_medicamento, @nombre, @descripcion, 1, @codigo_pais)
      `)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(
      `INSERT INTO medicamento (id_medicamento, nombre, descripcion, activo, codigo_pais)
       VALUES ($1, $2, $3, TRUE, $4)`,
      [data.id_medicamento, data.nombre, data.descripcion ?? null, data.codigo_pais]
    )
  }

  try {
    await syncMedicamentoBolivia(data)
  } catch (err) {
    await insertSyncLog({
      tabla: 'medicamento', operacion: 'INSERT',
      id_registro: data.id_medicamento,
      payload: data as unknown as Record<string, unknown>,
      codigo_pais,
      error_detalle: err instanceof Error ? err.message : String(err),
    })
  }

  return data
}

export async function actualizarMedicamento(
  nodeConn: NodeConnection,
  id: string,
  input: Partial<MedicamentoInput>,
  codigo_pais: string
): Promise<Medicamento | null> {
  const existing = await obtenerMedicamento(nodeConn, id, codigo_pais)
  if (!existing) return null
  const data: Medicamento = { ...existing, ...input }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request()
      .input('id', sql.VarChar(40), id)
      .input('nombre', sql.VarChar(100), data.nombre)
      .input('descripcion', sql.VarChar(500), data.descripcion ?? null)
      .query(`UPDATE medicamento SET nombre=@nombre, descripcion=@descripcion WHERE id_medicamento=@id`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(
      `UPDATE medicamento SET nombre=$1, descripcion=$2 WHERE id_medicamento=$3`,
      [data.nombre, data.descripcion ?? null, id]
    )
  }

  try { await syncMedicamentoBolivia(data) }
  catch (err) {
    await insertSyncLog({
      tabla: 'medicamento', operacion: 'UPDATE', id_registro: id,
      payload: data as unknown as Record<string, unknown>, codigo_pais,
      error_detalle: err instanceof Error ? err.message : String(err),
    })
  }
  return data
}

export async function eliminarMedicamento(
  nodeConn: NodeConnection,
  id: string,
  codigo_pais: string
): Promise<boolean> {
  const existing = await obtenerMedicamento(nodeConn, id, codigo_pais)
  if (!existing) return false

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request().input('id', sql.VarChar(40), id)
      .query(`UPDATE medicamento SET activo = 0 WHERE id_medicamento = @id`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(`UPDATE medicamento SET activo = FALSE WHERE id_medicamento = $1`, [id])
  }

  const data = { ...existing, activo: false }
  try { await syncMedicamentoBolivia(data) }
  catch (err) {
    await insertSyncLog({
      tabla: 'medicamento', operacion: 'UPDATE', id_registro: id,
      payload: data as unknown as Record<string, unknown>, codigo_pais,
      error_detalle: err instanceof Error ? err.message : String(err),
    })
  }
  return true
}
