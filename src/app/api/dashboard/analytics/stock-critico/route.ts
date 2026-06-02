// src/app/api/dashboard/analytics/stock-critico/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../../middleware/auth.middleware'
import { getStockCritico } from '../../../../../services/analytics.service'
import { AuthUser } from '../../../../../types'

/**
 * GET /api/dashboard/analytics/stock-critico
 * Solo superadmin.
 *
 * Query params:
 *   codigo_pais = PE | CL | ALL (default ALL)
 *   umbral      = número entero (default 10) — unidades mínimas antes de alerta
 *
 * Respuesta útil para: tabla de alertas de reposición, badge de conteo en dashboard.
 */
export const GET = withAuth(async (request: NextRequest, _user: AuthUser) => {
  try {
    const url    = new URL(request.url)
    const cp     = url.searchParams.get('codigo_pais')
    const umbral = Math.max(0, parseInt(url.searchParams.get('umbral') ?? '10'))

    const data = await getStockCritico(
      cp && ['PE', 'CL'].includes(cp) ? cp : undefined,
      umbral
    )

    return NextResponse.json({
      success: true,
      data,
      meta: { umbral, codigo_pais: cp ?? 'ALL', total_alertas: data.length }
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}, ['superadmin'])
