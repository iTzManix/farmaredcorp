// ============================================================
// src/instrumentation.ts
// Punto de entrada del servidor Next.js (App Router).
// Se ejecuta UNA VEZ al arrancar el servidor.
//
// Responsabilidades:
//   1. Cargar variables de entorno de los 4 archivos .env.*
//   2. Iniciar el job de reintento de sincronización (sync_log)
//
// Documentación: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
// ============================================================

export async function register() {
  // Solo ejecutar en el proceso del servidor (no en el cliente)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dotenv = await import('dotenv')
    const path = await import('path')

    // Cargar todos los archivos de entorno al arrancar
    dotenv.config({ path: path.join(process.cwd(), '.env') })
    dotenv.config({ path: path.join(process.cwd(), '.env.bolivia') })
    dotenv.config({ path: path.join(process.cwd(), '.env.peru') })
    dotenv.config({ path: path.join(process.cwd(), '.env.chile') })

    console.log('[Instrumentation] Variables de entorno cargadas desde .env.*')

    // Iniciar el job de reintento de sincronización
    try {
      const { startSyncRetryJob } = await import('./jobs/syncRetry.job')
      startSyncRetryJob()
      console.log('[Instrumentation] Job de sincronización iniciado.')
    } catch (err) {
      console.error('[Instrumentation] Error al iniciar job de sincronización:', err)
    }
  }
}
