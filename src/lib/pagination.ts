// ============================================================
// src/lib/pagination.ts
// Utilidad de paginación reutilizable para todos los endpoints.
//
// Uso en rutas:
//   const pag = parsePagination(new URL(request.url))
//   const result = await listarClientes(nodeConn, cp, pag)
//   return NextResponse.json({ success: true, ...result })
// ============================================================

/** Parámetros de paginación calculados desde la URL */
export interface PaginationParams {
  page:   number
  limit:  number
  offset: number
}

/** Metadata de paginación incluida en cada respuesta de lista */
export interface PaginationMeta {
  page:       number
  limit:      number
  total:      number
  totalPages: number
  hasNext:    boolean
  hasPrev:    boolean
}

/** Resultado paginado retornado por los servicios */
export interface PaginatedResult<T> {
  data:       T[]
  total:      number
  pagination: PaginationMeta
}

/**
 * Extrae y valida los parámetros de paginación de la URL.
 * - page: mínimo 1
 * - limit: entre 1 y 100, default 20
 *
 * @example
 * // GET /api/clientes?page=2&limit=10
 * parsePagination(url) // → { page: 2, limit: 10, offset: 10 }
 */
export function parsePagination(url: URL, defaultLimit = 20): PaginationParams {
  const page  = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? String(defaultLimit))))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

/**
 * Construye el objeto de metadata de paginación.
 */
export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / params.limit))
  return {
    page:       params.page,
    limit:      params.limit,
    total,
    totalPages,
    hasNext:  params.page < totalPages,
    hasPrev:  params.page > 1,
  }
}

/**
 * Construye el resultado paginado completo a partir de datos y total.
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    data,
    total,
    pagination: buildPaginationMeta(total, params),
  }
}
