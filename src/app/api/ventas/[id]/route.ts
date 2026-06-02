// src/app/api/ventas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../middleware/auth.middleware'
import { obtenerVenta } from '../../../../services/venta.service'
import { AuthUser } from '../../../../types'

type Params = { id: string }

/**
 * GET /api/ventas/:id
 * Retorna la venta con su detalle completo.
 * Las ventas NUNCA se pueden eliminar (ni hay DELETE route).
 */
export const GET = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    if (user.rol === 'superadmin') {
      // Leer desde almacén central Bolivia
      const { getDbBolivia } = await import('../../../../lib/db')
      const sql = await import('mssql')
      const db = await getDbBolivia()
      const resV = await db.request().input('id', sql.default.VarChar(40), id)
        .query(`SELECT id_venta,id_cliente,id_empleado,id_sucursal,fecha,monto_total_usd,codigo_pais FROM venta WHERE id_venta=@id`)
      if (!resV.recordset[0]) return NextResponse.json({ success: false, error: 'Venta no encontrada' }, { status: 404 })
      const resD = await db.request().input('id_venta', sql.default.VarChar(40), id)
        .query(`SELECT id_detalle,id_venta,id_medicamento,cantidad,precio_unitario_usd,subtotal_usd,codigo_pais FROM detalle_venta WHERE id_venta=@id_venta`)
      return NextResponse.json({ success: true, data: { ...resV.recordset[0], detalles: resD.recordset } })
    }

    const { getNodeDb } = await import('../../../../lib/db')
    const data = await obtenerVenta(getNodeDb(user.codigo_pais), id, user.codigo_pais)
    if (!data) return NextResponse.json({ success: false, error: 'Venta no encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})
