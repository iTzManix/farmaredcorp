// ============================================================
// src/services/auth.service.ts
// Autenticación de usuarios contra el nodo correspondiente.
//
// Flujo:
//   BO → consulta Bolivia (superadmin)
//   PE → consulta nodo Perú
//   CL → consulta nodo Chile
//
// Retorna JWT con payload: id_usuario, email, rol, codigo_pais
// ============================================================

import sql from 'mssql'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import path from 'path'
import { getDbBolivia, getDbPeru, getDbChile } from '../lib/db'
import { AuthUser } from '../types'

dotenv.config({ path: path.join(process.cwd(), '.env') })

export interface LoginPayload {
  email: string
  password: string
  codigo_pais: string
}

export interface LoginResult {
  token: string
  usuario: Omit<AuthUser, 'iat' | 'exp'>
}

interface UsuarioRow {
  id_usuario: string
  nombre: string
  email: string
  rol: string
  codigo_pais: string
}

/** Busca el usuario en el nodo correcto según codigo_pais */
async function findUser(
  email: string,
  password: string,
  codigo_pais: string
): Promise<UsuarioRow | null> {
  if (codigo_pais === 'BO') {
    const db = await getDbBolivia()
    const res = await db
      .request()
      .input('email',    sql.VarChar(100), email)
      .input('password', sql.VarChar(100), password)
      .query<UsuarioRow>(`
        SELECT id_usuario, nombre, email, rol, codigo_pais
        FROM usuario
        WHERE email = @email
          AND password_plain = @password
          AND activo = 1
      `)
    return res.recordset[0] ?? null
  }

  if (codigo_pais === 'PE') {
    const db = await getDbPeru()
    const res = await db
      .request()
      .input('email',    sql.VarChar(100), email)
      .input('password', sql.VarChar(100), password)
      .query<UsuarioRow>(`
        SELECT id_usuario, nombre, email, rol, codigo_pais
        FROM usuario
        WHERE email = @email
          AND password_plain = @password
          AND activo = 1
      `)
    return res.recordset[0] ?? null
  }

  if (codigo_pais === 'CL') {
    const db = getDbChile()
    const res = await db.query<UsuarioRow>(
      `SELECT id_usuario, nombre, email, rol, codigo_pais
       FROM usuario
       WHERE email = $1
         AND password_plain = $2
         AND activo = TRUE`,
      [email, password]
    )
    return res.rows[0] ?? null
  }

  return null
}

/**
 * Autentica un usuario y retorna un JWT firmado.
 * @throws Error si las credenciales son inválidas o el código de país es desconocido
 */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  const { email, password, codigo_pais } = payload

  if (!['BO', 'PE', 'CL'].includes(codigo_pais)) {
    throw new Error(`código de país inválido: ${codigo_pais}. Use BO, PE o CL.`)
  }

  const usuario = await findUser(email, password, codigo_pais)

  if (!usuario) {
    throw new Error('Credenciales inválidas o usuario inactivo')
  }

  const secret = process.env.JWT_SECRET
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as string

  if (!secret) throw new Error('JWT_SECRET no configurado')

  const jwtPayload = {
    id_usuario:  usuario.id_usuario,
    email:       usuario.email,
    rol:         usuario.rol,
    codigo_pais: usuario.codigo_pais,
  }

  const token = jwt.sign(jwtPayload, secret, { expiresIn } as jwt.SignOptions)

  return {
    token,
    usuario: jwtPayload as Omit<AuthUser, 'iat' | 'exp'>,
  }
}
