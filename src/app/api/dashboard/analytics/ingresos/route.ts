// src/app/api/dashboard/analytics/ingresos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../../middleware/auth.middleware'
import { getIngresosPorPeriodo } from '../../../../../services/analytics.service'
import { AuthUser } from '../../../../../types'

/**
 * GET /api/dashboard/analytics/ingresos
 * Solo superadmin.
 *
 * Query params:
 *   dias = 7 | 30 | 90 | 365 (default 30)
 *
 * Retorna ingresos totales en USD por país para el período indicado.
 * Útil para tarjetas KPI de "Ingresos del mes" comparando PE vs CL.
 */
export const GET = withAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const url  = new URL(request.url)
    const cpParam = url.searchParams.get('codigo_pais')
    const cp = user.rol === 'superadmin' ? cpParam : user.codigo_pais
    const dias = Math.min(365, Math.max(1, parseInt(url.searchParams.get('dias') ?? '30')))

    const data = await getIngresosPorPeriodo(dias, cp && ['PE', 'CL'].includes(cp) ? cp : undefined)

    return NextResponse.json({ success: true, data, meta: { dias } })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})
