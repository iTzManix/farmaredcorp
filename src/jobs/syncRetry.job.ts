// ============================================================
// src/jobs/syncRetry.job.ts
// Cron job que procesa entradas pendientes del sync_log.
//
// Intervalo: configurable via SYNC_RETRY_INTERVAL_MS (default 60s).
// Este archivo es importado por src/instrumentation.ts al arrancar el servidor.
//
// Cada ejecución procesa hasta 50 registros PENDIENTES con < 5 intentos.
// Registros que superan 5 intentos quedan en estado ERROR (solo superadmin puede verlos).
// ============================================================

import { retryPendingSyncs } from '../lib/retrySync'

let jobInterval: ReturnType<typeof setInterval> | null = null

/**
 * Inicia el job de reintento de sincronización.
 * Llama a retryPendingSyncs() cada SYNC_RETRY_INTERVAL_MS milisegundos.
 * Si el job ya está corriendo, no lo inicia de nuevo.
 */
export function startSyncRetryJob(): void {
  if (jobInterval) {
    console.log('[SyncRetryJob] Ya está en ejecución, ignorando inicio duplicado.')
    return
  }

  const intervalMs = parseInt(process.env.SYNC_RETRY_INTERVAL_MS ?? '60000')
  console.log(`[SyncRetryJob] Iniciado. Intervalo: ${intervalMs}ms (${intervalMs / 1000}s)`)

  // Primera ejecución después de 10 segundos del arranque
  const initialDelay = setTimeout(async () => {
    console.log('[SyncRetryJob] Primera ejecución...')
    await retryPendingSyncs()
  }, 10_000)

  // Ejecuciones periódicas
  jobInterval = setInterval(async () => {
    await retryPendingSyncs()
  }, intervalMs)

  // Limpieza al cerrar el proceso
  process.on('SIGTERM', () => {
    clearTimeout(initialDelay)
    if (jobInterval) {
      clearInterval(jobInterval)
      jobInterval = null
      console.log('[SyncRetryJob] Detenido por SIGTERM.')
    }
  })
}

/**
 * Detiene el job de reintento.
 */
export function stopSyncRetryJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval)
    jobInterval = null
    console.log('[SyncRetryJob] Detenido manualmente.')
  }
}
