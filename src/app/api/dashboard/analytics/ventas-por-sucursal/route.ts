// src/app/api/dashboard/analytics/ventas-por-sucursal/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../../middleware/auth.middleware'
import { getVentasPorSucursal } from '../../../../../services/analytics.service'
import { AuthUser } from '../../../../../types'

/**
 * GET /api/dashboard/analytics/ventas-por-sucursal
 * Solo superadmin.
 *
 * Query params:
 *   codigo_pais = PE | CL | ALL (default ALL)
 *
 * Respuesta útil para: comparar desempeño entre sucursales (barras, mapa de calor).
 * Incluye ticket_promedio para análisis de calidad de venta.
 */
export const GET = withAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const url = new URL(request.url)
    const cpParam = url.searchParams.get('codigo_pais')
    const cp = user.rol === 'superadmin' ? cpParam : user.codigo_pais

    const data = await getVentasPorSucursal(
      cp && ['PE', 'CL'].includes(cp) ? cp : undefined
    )

    return NextResponse.json({ success: true, data, meta: { codigo_pais: cp ?? 'ALL' } })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})
