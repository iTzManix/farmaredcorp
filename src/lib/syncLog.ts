// ============================================================
// src/lib/syncLog.ts
// Gestión de la tabla sync_log en el almacén central Bolivia.
//
// La tabla sync_log actúa como cola de recuperación:
//   - Se inserta cuando falla la sincronización al almacén central.
//   - El job de reintento (syncRetry.job.ts) procesa entradas PENDIENTES.
//   - Registros con más de 5 intentos quedan en estado ERROR (revisión manual).
// ============================================================

import sql from 'mssql'
import { getDbBolivia } from './db'
import { SyncLogInput } from '../types'

/**
 * Inserta un registro fallido en sync_log del almacén central.
 * Se llama cuando la sincronización a Bolivia falla después de
 * una operación exitosa en el nodo operativo.
 */
export async function insertSyncLog(entry: SyncLogInput): Promise<void> {
  const db = await getDbBolivia()
  await db
    .request()
    .input('tabla',         sql.VarChar(50),      entry.tabla)
    .input('operacion',     sql.VarChar(10),      entry.operacion)
    .input('id_registro',   sql.VarChar(40),      entry.id_registro)
    .input('payload',       sql.NVarChar(sql.MAX), JSON.stringify(entry.payload))
    .input('codigo_pais',   sql.Char(2),          entry.codigo_pais)
    .input('error_detalle', sql.NVarChar(sql.MAX), entry.error_detalle ?? null)
    .query(`
      INSERT INTO sync_log
        (tabla, operacion, id_registro, payload, codigo_pais, estado, intentos, error_detalle)
      VALUES
        (@tabla, @operacion, @id_registro, @payload, @codigo_pais, 'PENDIENTE', 0, @error_detalle)
    `)
}

/**
 * Marca un registro de sync_log como sincronizado exitosamente.
 */
export async function markSyncOk(id_log: number): Promise<void> {
  const db = await getDbBolivia()
  await db
    .request()
    .input('id_log', sql.Int, id_log)
    .query(`
      UPDATE sync_log
      SET estado                = 'OK',
          fecha_ultimo_intento  = GETDATE()
      WHERE id_log = @id_log
    `)
}

/**
 * Incrementa el contador de intentos y actualiza el detalle de error.
 * Si los intentos superan 5, cambia el estado a 'ERROR' (revisión manual).
 */
export async function markSyncError(id_log: number, error_detalle: string): Promise<void> {
  const db = await getDbBolivia()
  await db
    .request()
    .input('id_log',        sql.Int,               id_log)
    .input('error_detalle', sql.NVarChar(sql.MAX),  error_detalle)
    .query(`
      UPDATE sync_log
      SET estado                = CASE WHEN intentos + 1 >= 5 THEN 'ERROR' ELSE 'PENDIENTE' END,
          intentos              = intentos + 1,
          fecha_ultimo_intento  = GETDATE(),
          error_detalle         = @error_detalle
      WHERE id_log = @id_log
    `)
}
