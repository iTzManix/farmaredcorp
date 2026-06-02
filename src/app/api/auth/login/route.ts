// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { login } from '../../../../services/auth.service'

/**
 * POST /api/auth/login
 * Body: { email: string, password: string, codigo_pais: "BO" | "PE" | "CL" }
 * Response: { success: true, token: string, usuario: {...} }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { email, password, codigo_pais } = body

    if (!email || !password || !codigo_pais) {
      return NextResponse.json(
        { success: false, error: 'Se requiere email, password y codigo_pais' },
        { status: 400 }
      )
    }

    const result = await login({ email, password, codigo_pais })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de autenticación'
    return NextResponse.json({ success: false, error: msg }, { status: 401 })
  }
}
