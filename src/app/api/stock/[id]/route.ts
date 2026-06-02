// src/app/api/stock/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../middleware/auth.middleware'
import { obtenerStock, actualizarStock } from '../../../../services/stock.service'
import { AuthUser } from '../../../../types'

type Params = { id: string }

export const GET = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id; if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    const { getNodeDb } = await import('../../../../lib/db')
    const cp = user.rol === 'superadmin' ? (new URL(request.url).searchParams.get('codigo_pais') ?? 'PE') : user.codigo_pais
    const nodeConn = getNodeDb(cp)
    const data = await obtenerStock(nodeConn, id, cp)
    if (!data) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})

/**
 * PUT /api/stock/:id
 * Actualiza cantidad y/o precio_usd de un registro de stock.
 */
export const PUT = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id; if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    const body = await request.json()

    let codigo_pais = user.codigo_pais
    if (user.rol === 'superadmin') {
      if (!body.codigo_pais || !['PE','CL'].includes(body.codigo_pais))
        return NextResponse.json({ success: false, error: "Superadmin debe especificar codigo_pais" }, { status: 400 })
      codigo_pais = body.codigo_pais
    }

    const { getNodeDb } = await import('../../../../lib/db')
    const data = await actualizarStock(getNodeDb(codigo_pais), id, {
      cantidad: body.cantidad,
      precio_usd: body.precio_usd,
    }, codigo_pais)

    if (!data) return NextResponse.json({ success: false, error: 'Stock no encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})
