// src/app/api/empleados/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../middleware/auth.middleware'
import { listarEmpleados, crearEmpleado } from '../../../services/empleado.service'
import { AuthUser } from '../../../types'
import { parsePagination } from '../../../lib/pagination'

export const GET = withAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const url = new URL(request.url)
    const pag = parsePagination(url)

    if (user.rol === 'superadmin') {
      const { getDbBolivia } = await import('../../../lib/db')
      const cp = url.searchParams.get('codigo_pais')
      const db = await getDbBolivia()
      const sql = await import('mssql')
      const w = cp && ['PE','CL'].includes(cp) ? `AND codigo_pais='${cp}'` : `AND codigo_pais IN ('PE','CL')`
      const countRes = await db.request().query<{ total: number }>(`SELECT COUNT(*) AS total FROM empleado WHERE activo=1 ${w}`)
      const total = countRes.recordset[0]?.total ?? 0
      const res = await db.request()
        .input('offset', sql.default.Int, pag.offset).input('limit', sql.default.Int, pag.limit)
        .query(`SELECT id_empleado,nombre,cargo,id_sucursal,activo,codigo_pais FROM empleado WHERE activo=1 ${w} ORDER BY nombre OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`)
      const totalPages = Math.max(1, Math.ceil(total / pag.limit))
      return NextResponse.json({ success: true, data: res.recordset, total, pagination: { page: pag.page, limit: pag.limit, total, totalPages, hasNext: pag.page < totalPages, hasPrev: pag.page > 1 } })
    }

    const { getNodeDb } = await import('../../../lib/db')
    const result = await listarEmpleados(getNodeDb(user.codigo_pais), user.codigo_pais, pag)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})

export const POST = withAuth(async (request: NextRequest, user: AuthUser) => {
  try {
    const body = await request.json()
    if (!body.nombre || !body.cargo || !body.id_sucursal)
      return NextResponse.json({ success: false, error: 'nombre, cargo e id_sucursal son requeridos' }, { status: 400 })
    let codigo_pais = user.codigo_pais
    if (user.rol === 'superadmin') {
      if (!body.codigo_pais || !['PE','CL'].includes(body.codigo_pais))
        return NextResponse.json({ success: false, error: "Superadmin debe especificar codigo_pais" }, { status: 400 })
      codigo_pais = body.codigo_pais
    }
    const { getNodeDb } = await import('../../../lib/db')
    const data = await crearEmpleado(getNodeDb(codigo_pais), { nombre: body.nombre, cargo: body.cargo, id_sucursal: body.id_sucursal }, codigo_pais)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})
