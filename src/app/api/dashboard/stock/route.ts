// src/app/api/dashboard/stock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../middleware/auth.middleware'
import { AuthUser } from '../../../../types'
import { parsePagination } from '../../../../lib/pagination'

/**
 * GET /api/dashboard/stock?codigo_pais=PE|CL|ALL&page=1&limit=20
 * Solo superadmin.
 */
export const GET = withAuth(async (request: NextRequest, _user: AuthUser) => {
  try {
    const { getDbBolivia } = await import('../../../../lib/db')
    const sql = await import('mssql')
    const url = new URL(request.url)
    const cp  = url.searchParams.get('codigo_pais')
    const pag = parsePagination(url)

    const whereCP = cp && ['PE','CL'].includes(cp)
      ? `WHERE st.codigo_pais = '${cp}'`
      : `WHERE st.codigo_pais IN ('PE', 'CL')`

    const db = await getDbBolivia()

    const countRes = await db.request()
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM stock st ${whereCP}`)
    const total = countRes.recordset[0]?.total ?? 0

    const res = await db.request()
      .input('offset', sql.default.Int, pag.offset).input('limit', sql.default.Int, pag.limit)
      .query(`
        SELECT st.id_stock,st.id_medicamento,st.id_sucursal,st.cantidad,st.precio_usd,st.codigo_pais
        FROM stock st ${whereCP} ORDER BY st.codigo_pais, st.id_sucursal
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
