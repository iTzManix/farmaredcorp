// ============================================================
// src/services/cliente.service.ts
// CRUD de clientes con sincronización al almacén central Bolivia.
//
// Reglas de negocio:
//   - Un admin solo opera registros de su propio codigo_pais.
//   - La eliminación es lógica: activo = false (nunca DELETE físico).
//   - La escritura siempre inicia en el nodo operativo.
//   - Si falla la sync a Bolivia, se registra en sync_log.
// ============================================================

import sql from 'mssql'
import { Pool } from 'pg'
import { getDbBolivia, NodeConnection } from '../lib/db'
import { generateId } from '../lib/uuid'
import { insertSyncLog } from '../lib/syncLog'
import { Cliente, ClienteInput } from '../types'
import { PaginationParams, buildPaginatedResult, PaginatedResult } from '../lib/pagination'

// ─── Helpers de inserción explícita ─────────────────────────────────────────

async function insertClienteMssql(db: sql.ConnectionPool, d: Cliente) {
  await db
    .request()
    .input('id_cliente',  sql.VarChar(40),  d.id_cliente)
    .input('nombre',      sql.VarChar(100), d.nombre)
    .input('email',       sql.VarChar(100), d.email ?? null)
    .input('telefono',    sql.VarChar(20),  d.telefono ?? null)
    .input('codigo_pais', sql.Char(2),      d.codigo_pais)
    .query(`
      INSERT INTO cliente (id_cliente, nombre, email, telefono, activo, codigo_pais)
      VALUES (@id_cliente, @nombre, @email, @telefono, 1, @codigo_pais)
    `)
}

async function insertClientePg(db: Pool, d: Cliente) {
  await db.query(
    `INSERT INTO cliente (id_cliente, nombre, email, telefono, activo, codigo_pais)
     VALUES ($1, $2, $3, $4, TRUE, $5)`,
    [d.id_cliente, d.nombre, d.email ?? null, d.telefono ?? null, d.codigo_pais]
  )
}

async function syncClienteBolivia(d: Cliente) {
  const db = await getDbBolivia()
  await db
    .request()
    .input('id_cliente',  sql.VarChar(40),  d.id_cliente)
    .input('nombre',      sql.VarChar(100), d.nombre)
    .input('email',       sql.VarChar(100), d.email ?? null)
    .input('telefono',    sql.VarChar(20),  d.telefono ?? null)
    .input('activo',      sql.Bit,          d.activo ? 1 : 0)
    .input('codigo_pais', sql.Char(2),      d.codigo_pais)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = @id_cliente)
        INSERT INTO cliente (id_cliente, nombre, email, telefono, activo, codigo_pais)
        VALUES (@id_cliente, @nombre, @email, @telefono, @activo, @codigo_pais)
      ELSE
        UPDATE cliente
        SET nombre = @nombre, email = @email, telefono = @telefono, activo = @activo
        WHERE id_cliente = @id_cliente
    `)
}

// ─── Operaciones públicas del servicio ───────────────────────────────────────

export async function listarClientes(
  nodeConn: NodeConnection,
  codigo_pais: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Cliente>> {
  const limit  = pagination?.limit  ?? 1000
  const offset = pagination?.offset ?? 0
  const page   = pagination?.page   ?? 1

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const countRes = await db.request()
      .input('codigo_pais', sql.Char(2), codigo_pais)
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM cliente WHERE codigo_pais = @codigo_pais AND activo = 1`)
    const total = countRes.recordset[0]?.total ?? 0

    const res = await db.request()
      .input('codigo_pais', sql.Char(2), codigo_pais)
      .input('offset', sql.Int, offset)
      .input('limit',  sql.Int, limit)
      .query<Cliente>(`
        SELECT id_cliente, nombre, email, telefono, activo, codigo_pais
        FROM cliente WHERE codigo_pais = @codigo_pais AND activo = 1
        ORDER BY nombre
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `)
    return buildPaginatedResult(res.recordset, total, { page, limit, offset })
  } else {
    const db = await nodeConn.getDb() as Pool
    const countRes = await db.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM cliente WHERE codigo_pais = $1 AND activo = TRUE`, [codigo_pais]
    )
    const total = parseInt(countRes.rows[0]?.total ?? '0')
    const res = await db.query<Cliente>(
      `SELECT id_cliente, nombre, email, telefono, activo, codigo_pais
       FROM cliente WHERE codigo_pais = $1 AND activo = TRUE
       ORDER BY nombre LIMIT $2 OFFSET $3`,
      [codigo_pais, limit, offset]
    )
    return buildPaginatedResult(res.rows, total, { page, limit, offset })
  }
}

export async function obtenerCliente(
  nodeConn: NodeConnection,
  id: string,
  codigo_pais: string
): Promise<Cliente | null> {
  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    const res = await db
      .request()
      .input('id',          sql.VarChar(40), id)
      .input('codigo_pais', sql.Char(2),     codigo_pais)
      .query<Cliente>(`
        SELECT id_cliente, nombre, email, telefono, activo, codigo_pais
        FROM cliente
        WHERE id_cliente = @id AND codigo_pais = @codigo_pais
      `)
    return res.recordset[0] ?? null
  } else {
    const db = await nodeConn.getDb() as Pool
    const res = await db.query<Cliente>(
      `SELECT id_cliente, nombre, email, telefono, activo, codigo_pais
       FROM cliente
       WHERE id_cliente = $1 AND codigo_pais = $2`,
      [id, codigo_pais]
    )
    return res.rows[0] ?? null
  }
}

export async function crearCliente(
  nodeConn: NodeConnection,
  input: ClienteInput,
  codigo_pais: string
): Promise<Cliente> {
  const data: Cliente = {
    ...input,
    id_cliente: generateId(codigo_pais),
    email:      input.email ?? null,
    telefono:   input.telefono ?? null,
    activo:     true,
    codigo_pais,
  }

  // Paso 1: nodo operativo
  if (nodeConn.type === 'mssql') {
    await insertClienteMssql(await nodeConn.getDb() as sql.ConnectionPool, data)
  } else {
    await insertClientePg(await nodeConn.getDb() as Pool, data)
  }

  // Paso 2: almacén central (con fallback a sync_log)
  try {
    await syncClienteBolivia(data)
  } catch (err) {
    await insertSyncLog({
      tabla: 'cliente', operacion: 'INSERT',
      id_registro: data.id_cliente,
      payload: data as unknown as Record<string, unknown>,
      codigo_pais,
      error_detalle: err instanceof Error ? err.message : String(err),
    })
  }

  return data
}

export async function actualizarCliente(
  nodeConn: NodeConnection,
  id: string,
  input: Partial<ClienteInput>,
  codigo_pais: string
): Promise<Cliente | null> {
  const existing = await obtenerCliente(nodeConn, id, codigo_pais)
  if (!existing) return null

  const data: Cliente = { ...existing, ...input }

  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db
      .request()
      .input('id',       sql.VarChar(40),  id)
      .input('nombre',   sql.VarChar(100), data.nombre)
      .input('email',    sql.VarChar(100), data.email ?? null)
      .input('telefono', sql.VarChar(20),  data.telefono ?? null)
      .query(`
        UPDATE cliente
        SET nombre = @nombre, email = @email, telefono = @telefono
        WHERE id_cliente = @id
      `)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(
      `UPDATE cliente
       SET nombre = $1, email = $2, telefono = $3
       WHERE id_cliente = $4`,
      [data.nombre, data.email ?? null, data.telefono ?? null, id]
    )
  }

  try {
    await syncClienteBolivia(data)
  } catch (err) {
    await insertSyncLog({
      tabla: 'cliente', operacion: 'UPDATE',
      id_registro: id,
      payload: data as unknown as Record<string, unknown>,
      codigo_pais,
      error_detalle: err instanceof Error ? err.message : String(err),
    })
  }

  return data
}

export async function eliminarCliente(
  nodeConn: NodeConnection,
  id: string,
  codigo_pais: string
): Promise<boolean> {
  const existing = await obtenerCliente(nodeConn, id, codigo_pais)
  if (!existing) return false

  // Borrado lógico: activo = false
  if (nodeConn.type === 'mssql') {
    const db = await nodeConn.getDb() as sql.ConnectionPool
    await db.request().input('id', sql.VarChar(40), id)
      .query(`UPDATE cliente SET activo = 0 WHERE id_cliente = @id`)
  } else {
    const db = await nodeConn.getDb() as Pool
    await db.query(`UPDATE cliente SET activo = FALSE WHERE id_cliente = $1`, [id])
  }

  const data: Cliente = { ...existing, activo: false }
  try {
    await syncClienteBolivia(data)
  } catch (err) {
    await insertSyncLog({
      tabla: 'cliente', operacion: 'UPDATE',
      id_registro: id,
      payload: data as unknown as Record<string, unknown>,
      codigo_pais,
      error_detalle: err instanceof Error ? err.message : String(err),
    })
  }

  return true
}
