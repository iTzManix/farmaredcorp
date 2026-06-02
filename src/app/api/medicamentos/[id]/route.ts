// src/app/api/medicamentos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../middleware/auth.middleware'
import { obtenerMedicamento, actualizarMedicamento, eliminarMedicamento } from '../../../../services/medicamento.service'
import { AuthUser } from '../../../../types'

type Params = { id: string }

export const GET = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    if (user.rol === 'superadmin') {
      const { getDbBolivia } = await import('../../../../lib/db')
      const sql = await import('mssql')
      const db = await getDbBolivia()
      const res = await db.request().input('id', sql.default.VarChar(40), id)
        .query(`SELECT id_medicamento, nombre, descripcion, activo, codigo_pais FROM medicamento WHERE id_medicamento = @id`)
      if (!res.recordset[0]) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
      return NextResponse.json({ success: true, data: res.recordset[0] })
    }
    const { getNodeDb } = await import('../../../../lib/db')
    const data = await obtenerMedicamento(getNodeDb(user.codigo_pais), id, user.codigo_pais)
    if (!data) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
})

export const PUT = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    if (user.rol === 'superadmin') return NextResponse.json({ success: false, error: 'Use el admin del nodo correspondiente' }, { status: 403 })
    const body = await request.json()
    const { getNodeDb } = await import('../../../../lib/db')
    const data = await actualizarMedicamento(getNodeDb(user.codigo_pais), id, body, user.codigo_pais)
    if (!data) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}, ['admin_pe', 'admin_cl', 'superadmin'])

export const DELETE = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    if (user.rol === 'superadmin') return NextResponse.json({ success: false, error: 'Use el admin del nodo correspondiente' }, { status: 403 })
    const { getNodeDb } = await import('../../../../lib/db')
    const ok = await eliminarMedicamento(getNodeDb(user.codigo_pais), id, user.codigo_pais)
    if (!ok) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Medicamento desactivado (baja lógica)' })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}, ['admin_pe', 'admin_cl'])
