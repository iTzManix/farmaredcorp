// ============================================================
// src/middleware/country.middleware.ts
// Inyecta la conexión correcta según el país del admin autenticado.
//
// Uso en API routes de admin local:
//   export const GET = withCountry(handler)
//
// Para superadmin con selección de país:
//   Usar withAuth(['superadmin']) y leer codigo_pais del body.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { AuthUser, Rol } from '../types'
import { NodeConnection, getNodeDb } from '../lib/db'
import { withAuth, RouteHandler } from './auth.middleware'

/** Handler de ruta que además recibe la conexión al nodo del país */
export type CountryRouteHandler<P = Record<string, string>> = (
  request: NextRequest,
  user: AuthUser,
  nodeConn: NodeConnection,
  params?: P
) => Promise<NextResponse>

/**
 * HOF que protege la ruta, verifica el JWT y además inyecta
 * la conexión al nodo correspondiente al país del usuario autenticado.
 *
 * Solo acepta admin_pe y admin_cl por defecto.
 * El superadmin usa withAuth directamente y selecciona el nodo manualmente.
 *
 * @example
 * export const GET = withCountry(async (req, user, nodeConn) => {
 *   const db = await nodeConn.getDb()
 *   // ...
 * })
 */
export function withCountry<P = Record<string, string>>(
  handler: CountryRouteHandler<P>,
  allowedRoles: Rol[] = ['admin_pe', 'admin_cl']
) {
  const inner: RouteHandler<P> = async (request, user, params) => {
    // BO no tiene nodo operativo propio; usa Bolivia directamente.
    if (!user.codigo_pais || user.codigo_pais === 'BO') {
      return NextResponse.json(
        { success: false, error: 'El superadmin debe especificar codigo_pais en el body' },
        { status: 400 }
      )
    }

    let nodeConn: NodeConnection
    try {
      nodeConn = getNodeDb(user.codigo_pais)
    } catch {
      return NextResponse.json(
        { success: false, error: `País no reconocido: ${user.codigo_pais}` },
        { status: 400 }
      )
    }

    return handler(request, user, nodeConn, params)
  }

  return withAuth<P>(inner, allowedRoles)
}

/**
 * Versión para el superadmin: selecciona el nodo según codigo_pais del body.
 * Requiere que el body incluya { codigo_pais: 'PE' | 'CL' }.
 */
export function withSuperadminCountry<P = Record<string, string>>(
  handler: CountryRouteHandler<P>
) {
  const inner: RouteHandler<P> = async (request, user, params) => {
    let bodyCodigoPais: string
    try {
      const body = await request.clone().json()
      bodyCodigoPais = body?.codigo_pais
    } catch {
      return NextResponse.json(
        { success: false, error: 'Body inválido. Se requiere codigo_pais' },
        { status: 400 }
      )
    }

    if (!bodyCodigoPais || !['PE', 'CL'].includes(bodyCodigoPais)) {
      return NextResponse.json(
        { success: false, error: "codigo_pais debe ser 'PE' o 'CL'" },
        { status: 400 }
      )
    }

    const nodeConn = getNodeDb(bodyCodigoPais)
    return handler(request, user, nodeConn, params)
  }

  return withAuth<P>(inner, ['superadmin'])
}
