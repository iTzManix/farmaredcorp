// src/app/api/dashboard/analytics/ventas-por-dia/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../../middleware/auth.middleware'
import { getVentasPorDia } from '../../../../../services/analytics.service'
import { AuthUser } from '../../../../../types'

/**
 * GET /api/dashboard/analytics/ventas-por-dia
 * Solo superadmin.
 *
 * 
 * Query params:
 *   codigo_pais = PE | CL | ALL (default ALL)
 *   dias        = 7 | 14 | 30 | 90 (default 30, máx 365)
 *
 * Respuesta útil para: gráfico de línea/área de ingresos diarios.
 */
export const GET = withAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const url   = new URL(request.url)
    const cpParam = url.searchParams.get('codigo_pais')
    const cp = user.rol === 'superadmin' ? cpParam : user.codigo_pais
    const dias  = Math.min(365, Math.max(1, parseInt(url.searchParams.get('dias') ?? '30')))

    const data = await getVentasPorDia(
      cp && ['PE', 'CL'].includes(cp) ? cp : undefined,
      dias
    )

    return NextResponse.json({ success: true, data, meta: { dias, codigo_pais: cp ?? 'ALL' } })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})
