// ============================================================
// src/lib/retrySync.ts
// Lógica de reintento para entradas pendientes en sync_log.
//
// Este módulo es invocado por el job periódico (syncRetry.job.ts).
// Consulta las entradas con estado = 'PENDIENTE' e intentos < 5,
// e intenta aplicarlas al almacén central Bolivia.
// ============================================================

import sql from 'mssql'
import { getDbBolivia } from './db'
import { markSyncOk, markSyncError } from './syncLog'
import { SyncLogRow } from '../types'

/**
 * Construye y ejecuta la query de sincronización en Bolivia
 * para un registro dado (INSERT o UPDATE lógico).
 *
 * Nota: No se usa ORM — SQL explícito para visibilidad y auditoría.
 */
async function applyToBolivia(
  db: sql.ConnectionPool,
  tabla: string,
  operacion: string,
  payload: Record<string, unknown>
): Promise<void> {
  const idCol = `id_${tabla}`
  const idVal = payload[idCol] as string

  if (!idVal) {
    throw new Error(`Payload no contiene el campo ${idCol}`)
  }

  if (operacion === 'INSERT') {
    const cols = Object.keys(payload).join(', ')
    const vals = Object.keys(payload)
      .map((k) => {
        const v = payload[k]
        if (v === null || v === undefined) return 'NULL'
        if (typeof v === 'boolean') return v ? '1' : '0'
        // Escapar comillas simples
        return `'${String(v).replace(/'/g, "''")}'`
      })
      .join(', ')

    await db.request().query(`
      IF NOT EXISTS (SELECT 1 FROM ${tabla} WHERE ${idCol} = '${idVal}')
        INSERT INTO ${tabla} (${cols}) VALUES (${vals})
    `)
  } else if (operacion === 'UPDATE' || operacion === 'DELETE') {
    // DELETE en entidades maestras = baja lógica (activo = 0)
    const sets = Object.entries(payload)
      .filter(([k]) => k !== idCol)
      .map(([k, v]) => {
        if (v === null || v === undefined) return `${k} = NULL`
        if (typeof v === 'boolean') return `${k} = ${v ? '1' : '0'}`
        return `${k} = '${String(v).replace(/'/g, "''")}'`
      })
      .join(', ')

    if (sets) {
      await db.request().query(`
        UPDATE ${tabla} SET ${sets} WHERE ${idCol} = '${idVal}'
      `)
    }
  }
}

/**
 * Procesa hasta 50 registros pendientes del sync_log.
 * Llamado periódicamente por el cron job.
 */
export async function retryPendingSyncs(): Promise<void> {
  let db: sql.ConnectionPool
  try {
    db = await getDbBolivia()
  } catch (err) {
    console.error('[SyncRetry] No se pudo conectar a Bolivia:', err)
    return
  }

  let pendingResult: sql.IResult<SyncLogRow>
  try {
    pendingResult = await db.request().query<SyncLogRow>(`
      SELECT TOP 50
        id_log, tabla, operacion, id_registro, payload, codigo_pais,
        estado, intentos, fecha_creacion, fecha_ultimo_intento, error_detalle
      FROM sync_log
      WHERE estado = 'PENDIENTE' AND intentos < 5
      ORDER BY fecha_creacion ASC
    `)
  } catch (err) {
    console.error('[SyncRetry] Error al leer sync_log:', err)
    return
  }

  const rows = pendingResult.recordset
  if (rows.length === 0) return

  console.log(`[SyncRetry] Procesando ${rows.length} entradas pendientes...`)

  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>
      await applyToBolivia(db, row.tabla, row.operacion, payload)
      await markSyncOk(row.id_log)
      console.log(`[SyncRetry] ✓ OK: ${row.tabla}#${row.id_registro}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await markSyncError(row.id_log, msg)
      console.error(`[SyncRetry] ✗ ERROR (intento ${row.intentos + 1}): ${row.tabla}#${row.id_registro} — ${msg}`)
    }
  }
}
