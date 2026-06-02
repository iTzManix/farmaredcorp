// src/app/api/clientes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../middleware/auth.middleware'
import { obtenerCliente, actualizarCliente, eliminarCliente } from '../../../../services/cliente.service'
import { AuthUser } from '../../../../types'

type Params = { id: string }

/**
 * GET /api/clientes/:id
 * El admin solo puede ver clientes de su país. El superadmin puede ver cualquiera.
 */
export const GET = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    const { getNodeDb, getDbBolivia } = await import('../../../../lib/db')

    let data
    if (user.rol === 'superadmin') {
      const db = await getDbBolivia()
      const res = await db.request()
        .input('id', (await import('mssql')).default.VarChar(40), id)
        .query(`SELECT id_cliente, nombre, email, telefono, activo, codigo_pais FROM cliente WHERE id_cliente = @id`)
      data = res.recordset[0] ?? null
    } else {
      const nodeConn = getNodeDb(user.codigo_pais)
      data = await obtenerCliente(nodeConn, id, user.codigo_pais)
    }

    if (!data) return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
})

/**
 * PUT /api/clientes/:id
 * Solo admin del país correspondiente.
 */
export const PUT = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    if (user.rol === 'superadmin') {
      return NextResponse.json({ success: false, error: 'El superadmin no puede editar directamente. Use el admin del país correspondiente.' }, { status: 403 })
    }

    const body = await request.json()
    const { getNodeDb } = await import('../../../../lib/db')
    const nodeConn = getNodeDb(user.codigo_pais)
    const data = await actualizarCliente(nodeConn, id, body, user.codigo_pais)

    if (!data) return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}, ['admin_pe', 'admin_cl', 'superadmin'])

/**
 * DELETE /api/clientes/:id
 * Borrado lógico. Solo admin del país correspondiente.
 */
export const DELETE = withAuth(async (request: NextRequest, user: AuthUser, params?: Params) => {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })

    if (user.rol === 'superadmin') {
      return NextResponse.json({ success: false, error: 'El superadmin no puede eliminar directamente.' }, { status: 403 })
    }

    const { getNodeDb } = await import('../../../../lib/db')
    const nodeConn = getNodeDb(user.codigo_pais)
    const ok = await eliminarCliente(nodeConn, id, user.codigo_pais)

    if (!ok) return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Cliente desactivado (baja lógica)' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}, ['admin_pe', 'admin_cl'])
