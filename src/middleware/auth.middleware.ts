// ============================================================
// src/middleware/auth.middleware.ts
// Verificación de JWT y protección de rutas via HOF.
//
// Uso en API routes:
//   export const GET = withAuth(handler)
//   export const POST = withAuth(handler, ['superadmin'])
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { AuthUser, Rol } from '../types'

/**
 * Extrae y verifica el JWT del header Authorization.
 * Lanza Error si el token es inválido o no está presente.
 */
export function verifyToken(request: NextRequest): AuthUser {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Token no proporcionado. Use: Authorization: Bearer <token>')
  }

  const token = authHeader.split(' ')[1]
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET no está configurado en el servidor')
  }

  // jwt.verify lanza JsonWebTokenError o TokenExpiredError si es inválido
  const payload = jwt.verify(token, secret) as AuthUser
  return payload
}

// ─── Tipos del HOF ────────────────────────────────────────────────────────────

export type RouteHandler<P = Record<string, string>> = (
  request: NextRequest,
  user: AuthUser,
  params?: P
) => Promise<NextResponse>

/**
 * Higher-order function que protege una ruta validando el JWT.
 *
 * @param handler   - Función de ruta que recibe (request, user, params)
 * @param allowedRoles - Si se especifica, solo esos roles pueden acceder
 *
 * @example
 * // Solo superadmin
 * export const GET = withAuth(handler, ['superadmin'])
 *
 * // Admin de cualquier país
 * export const POST = withAuth(handler, ['admin_pe', 'admin_cl'])
 *
 * // Cualquier usuario autenticado
 * export const GET = withAuth(handler)
 */
export function withAuth<P = Record<string, string>>(
  handler: RouteHandler<P>,
  allowedRoles?: Rol[]
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<P> }
  ): Promise<NextResponse> => {
    let user: AuthUser
    try {
      user = verifyToken(request)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No autorizado'
      return NextResponse.json({ success: false, error: msg }, { status: 401 })
    }

    if (allowedRoles && !allowedRoles.includes(user.rol)) {
      return NextResponse.json(
        { success: false, error: `Acceso denegado. Se requiere rol: ${allowedRoles.join(' | ')}` },
        { status: 403 }
      )
    }

    const params = context?.params ? await context.params : undefined
    return handler(request, user, params)
  }
}
