// src/app/api/dashboard/analytics/top-medicamentos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../../middleware/auth.middleware'
import { getTopMedicamentos } from '../../../../../services/analytics.service'
import { AuthUser } from '../../../../../types'

/**
 * GET /api/dashboard/analytics/top-medicamentos
 * Solo superadmin.
 *
 * Query params:
 *   codigo_pais = PE | CL | ALL (default ALL)
 *   limit       = 1-50 (default 10)
 *
 * Respuesta útil para: ranking de medicamentos más vendidos (barras horizontales).
 */
export const GET = withAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const url   = new URL(request.url)
    const cpParam = url.searchParams.get('codigo_pais')
    const cp = user.rol === 'superadmin' ? cpParam : user.codigo_pais
    const topN  = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10')))

    const data = await getTopMedicamentos(
      cp && ['PE', 'CL'].includes(cp) ? cp : undefined,
      topN
    )

    return NextResponse.json({ success: true, data, meta: { limit: topN, codigo_pais: cp ?? 'ALL' } })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})
