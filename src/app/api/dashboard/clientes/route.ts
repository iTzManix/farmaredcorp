// src/app/api/dashboard/clientes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../middleware/auth.middleware'
import { AuthUser } from '../../../../types'
import { parsePagination } from '../../../../lib/pagination'

/**
 * GET /api/dashboard/clientes?codigo_pais=PE|CL|ALL&page=1&limit=20
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
      ? `WHERE codigo_pais = '${cp}' AND activo = 1`
      : `WHERE codigo_pais IN ('PE', 'CL') AND activo = 1`

    const db = await getDbBolivia()

    const countRes = await db.request()
      .query<{ total: number }>(`SELECT COUNT(*) AS total FROM cliente ${whereCP}`)
    const total = countRes.recordset[0]?.total ?? 0

    const res = await db.request()
      .input('offset', sql.default.Int, pag.offset).input('limit', sql.default.Int, pag.limit)
      .query(`
        SELECT id_cliente, nombre, email, codigo_pais
        FROM cliente ${whereCP} ORDER BY codigo_pais, nombre
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
