// src/app/api/dashboard/resumen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../middleware/auth.middleware'
import { getResumenGlobal } from '../../../../services/dashboard.service'
import { AuthUser } from '../../../../types'

/**
 * GET /api/dashboard/resumen
 * Solo superadmin. Retorna totales globales de ventas, clientes y stock.
 */
export const GET = withAuth(async (_request: NextRequest, _user: AuthUser) => {
  try {
    const data = await getResumenGlobal()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}, ['superadmin'])
