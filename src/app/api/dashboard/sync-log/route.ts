// src/app/api/dashboard/sync-log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../middleware/auth.middleware'
import { AuthUser } from '../../../../types'
import { parsePagination } from '../../../../lib/pagination'

/**
 * GET /api/dashboard/sync-log?estado=PENDIENTE|OK|ERROR&page=1&limit=50
 * Solo superadmin. Muestra el estado de las sincronizaciones.
 */
export const GET = withAuth(async (request: NextRequest, _user: AuthUser) => {
  try {
    const { getDbBolivia } = await import('../../../../lib/db')
    const sql = await import('mssql')
    const url    = new URL(request.url)
    const estado = url.searchParams.get('estado')
    const pag    = parsePagination(url, 50) // default 50 por página para logs

    const whereEstado = estado && ['PENDIENTE','OK','ERROR'].includes(estado)
      ? `WHERE estado = '${estado}'`
      : ''

    const db = await getDbBolivia()

    const countRes = await db.request()
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM sync_log ${whereEstado}`)
    const total = countRes.recordset[0]?.total ?? 0

    const res = await db.request()
      .input('offset', sql.default.Int, pag.offset).input('limit', sql.default.Int, pag.limit)
      .query(`
        SELECT id_log,tabla,operacion,id_registro,payload,codigo_pais,
               estado,intentos,fecha_creacion,fecha_ultimo_intento,error_detalle
        FROM sync_log ${whereEstado}
        ORDER BY fecha_creacion DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `)

    const totalPages = Math.max(1, Math.ceil(total / pag.limit))
    return NextResponse.json({
      success: true, data: res.recordset, total,
      pagination: { page: pag.page, limit: pag.limit, total, totalPages, hasNext: pag.page < totalPages, hasPrev: pag.page > 1 }
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}, ['superadmin'])
