// ============================================================
// src/lib/db.ts
// Pool de conexiones a los 3 nodos de la BDD distribuida.
//
// Nodos:
//   Bolivia  → SQL Server (almacén central, lectura/escritura superadmin)
//   Perú     → SQL Server (nodo operativo PE)
//   Chile    → PostgreSQL (nodo operativo CL)
//
// Patrón singleton global para sobrevivir el hot-reload de Next.js en dev.
// Las conexiones se inicializan de forma lazy (primera vez que se necesitan).
// ============================================================

import sql from 'mssql'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import path from 'path'

// Carga los cuatro archivos .env en orden.
// dotenv no sobreescribe variables ya definidas, por lo que el orden importa.
dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.bolivia') })
dotenv.config({ path: path.join(process.cwd(), '.env.peru') })
dotenv.config({ path: path.join(process.cwd(), '.env.chile') })

// ─── Configuraciones de conexión ────────────────────────────────────────────

const boliviaConfig: sql.config = {
  server:   process.env.DB_BOLIVIA_HOST!,
  port:     parseInt(process.env.DB_BOLIVIA_PORT ?? '1433'),
  database: process.env.DB_BOLIVIA_NAME!,
  user:     process.env.DB_BOLIVIA_USER!,
  password: process.env.DB_BOLIVIA_PASS!,
  options: {
    trustServerCertificate: true,
    encrypt: false,           // Red local Radmin — sin TLS obligatorio
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  connectionTimeout: 15_000,
  requestTimeout: 30_000,
}

const peruConfig: sql.config = {
  server:   process.env.DB_PERU_HOST!,
  port:     parseInt(process.env.DB_PERU_PORT ?? '1433'),
  database: process.env.DB_PERU_NAME!,
  user:     process.env.DB_PERU_USER!,
  password: process.env.DB_PERU_PASS!,
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  connectionTimeout: 15_000,
  requestTimeout: 30_000,
}

// ─── Singletons globales (sobreviven hot-reload en desarrollo) ────────────────

declare global {
  // eslint-disable-next-line no-var
  var _dbBolivia: sql.ConnectionPool | undefined
  // eslint-disable-next-line no-var
  var _dbPeru: sql.ConnectionPool | undefined
  // eslint-disable-next-line no-var
  var _dbChile: Pool | undefined
}

// ─── Getters con lazy initialization ─────────────────────────────────────────

/**
 * Devuelve el pool de Bolivia (almacén central).
 * Crea la conexión si no existe o si se cerró.
 */
export async function getDbBolivia(): Promise<sql.ConnectionPool> {
  if (!global._dbBolivia || !global._dbBolivia.connected) {
    global._dbBolivia = await new sql.ConnectionPool(boliviaConfig).connect()
    console.log('[DB] Conectado a Bolivia (almacén central)')
  }
  return global._dbBolivia
}

/**
 * Devuelve el pool de Perú (nodo operativo PE).
 */
export async function getDbPeru(): Promise<sql.ConnectionPool> {
  if (!global._dbPeru || !global._dbPeru.connected) {
    global._dbPeru = await new sql.ConnectionPool(peruConfig).connect()
    console.log('[DB] Conectado a Perú (nodo PE)')
  }
  return global._dbPeru
}

/**
 * Devuelve el pool de Chile (nodo operativo CL).
 * pg.Pool gestiona las conexiones internamente; no se necesita .connect().
 */
export function getDbChile(): Pool {
  if (!global._dbChile) {
    global._dbChile = new Pool({
      host:               process.env.DB_CHILE_HOST!,
      port:               parseInt(process.env.DB_CHILE_PORT ?? '5432'),
      database:           process.env.DB_CHILE_NAME!,
      user:               process.env.DB_CHILE_USER!,
      password:           process.env.DB_CHILE_PASS!,
      max:                10,
      idleTimeoutMillis:  30_000,
      connectionTimeoutMillis: 15_000,
    })
    console.log('[DB] Pool de Chile (nodo CL) inicializado')
  }
  return global._dbChile
}

// ─── Tipos del selector de nodo ──────────────────────────────────────────────

export type DbType = 'mssql' | 'pg'

export interface NodeConnection {
  type: DbType
  /** Llama a esta función para obtener la conexión activa del nodo */
  getDb: () => Promise<sql.ConnectionPool | Pool>
}

/**
 * Devuelve la conexión correcta según el código de país.
 * Solo acepta 'PE' (Perú) y 'CL' (Chile).
 * Bolivia es el almacén central y se accede directamente con getDbBolivia().
 *
 * @throws Error si el código de país no es 'PE' ni 'CL'
 */
export function getNodeDb(codigo_pais: string): NodeConnection {
  if (codigo_pais === 'PE') {
    return {
      type: 'mssql',
      getDb: () => getDbPeru(),
    }
  }
  if (codigo_pais === 'CL') {
    return {
      type: 'pg',
      getDb: () => Promise.resolve(getDbChile()),
    }
  }
  throw new Error(`País no reconocido: ${codigo_pais}. Use 'PE' o 'CL'.`)
}
