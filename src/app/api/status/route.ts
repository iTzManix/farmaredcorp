import { NextRequest, NextResponse } from 'next/server'
import { getDbBolivia, getDbPeru, getDbChile } from '../../../lib/db'
import { withAuth } from '../../../middleware/auth.middleware'
import { AuthUser } from '../../../types'

/**
 * GET /api/status
 * Devuelve el estado de conexión a los nodos de BD.
 */
export const GET = withAuth(async (request: NextRequest, user: AuthUser) => {
  const result: Record<string, string> = { BO: 'offline', PE: 'offline', CL: 'offline' }

  const checkNode = async (country: string, getDbFn: Function) => {
    try {
      const db = await getDbFn()
      // En PostgreSQL (Chile) el pool tiene .query() directo
      if (country === 'CL') {
        await db.query('SELECT 1')
      } else {
        // En SQL Server (Bolivia, Perú) el pool usa .request().query()
        await db.request().query('SELECT 1')
      }
      result[country] = 'online'
    } catch (e) {
      result[country] = 'offline'
    }
  }

  const checks = []

  // Todos verifican el nodo central (Bolivia)
  checks.push(checkNode('BO', getDbBolivia))

  if (user.rol === 'superadmin' || user.codigo_pais === 'PE') {
    checks.push(checkNode('PE', getDbPeru))
  }
  if (user.rol === 'superadmin' || user.codigo_pais === 'CL') {
    checks.push(checkNode('CL', getDbChile))
  }

  await Promise.all(checks)

  return NextResponse.json({ success: true, nodes: result })
})
