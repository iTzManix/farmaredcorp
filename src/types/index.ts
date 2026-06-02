// ============================================================
// src/types/index.ts
// Tipos compartidos de la aplicación FarmaredCorp
// ============================================================

/** Roles disponibles en el sistema */
export type Rol = 'superadmin' | 'admin_pe' | 'admin_cl'

/** Códigos de país usados en el sistema */
export type CodigoPais = 'BO' | 'PE' | 'CL'

/** Payload del JWT autenticado */
export interface AuthUser {
  id_usuario: string
  email: string
  rol: Rol
  codigo_pais: CodigoPais
  iat: number
  exp: number
}

/** Entrada al sync_log para registrar fallos de sincronización */
export interface SyncLogInput {
  tabla: string
  operacion: 'INSERT' | 'UPDATE' | 'DELETE'
  id_registro: string
  payload: Record<string, unknown>
  codigo_pais: string
  error_detalle?: string
}

/** Registro de sync_log leído de la base de datos */
export interface SyncLogRow {
  id_log: number
  tabla: string
  operacion: string
  id_registro: string
  payload: string
  codigo_pais: string
  estado: 'PENDIENTE' | 'OK' | 'ERROR'
  intentos: number
  fecha_creacion: Date
  fecha_ultimo_intento: Date | null
  error_detalle: string | null
}

// ─── Entidades de dominio ────────────────────────────────────────────────────

export interface Cliente {
  id_cliente: string
  nombre: string
  email: string | null
  telefono: string | null
  activo: boolean
  codigo_pais: string
}

export interface ClienteInput {
  nombre: string
  email?: string | null
  telefono?: string | null
}

export interface Medicamento {
  id_medicamento: string
  nombre: string
  descripcion: string | null
  activo: boolean
  codigo_pais: string
}

export interface MedicamentoInput {
  nombre: string
  descripcion?: string | null
}

export interface Sucursal {
  id_sucursal: string
  nombre: string
  direccion: string
  activo: boolean
  codigo_pais: string
}

export interface SucursalInput {
  nombre: string
  direccion: string
}

export interface Empleado {
  id_empleado: string
  nombre: string
  cargo: string
  id_sucursal: string
  activo: boolean
  codigo_pais: string
}

export interface EmpleadoInput {
  nombre: string
  cargo: string
  id_sucursal: string
}

export interface Stock {
  id_stock: string
  id_medicamento: string
  id_sucursal: string
  cantidad: number
  precio_usd: number
  fecha_actualizacion: Date
  codigo_pais: string
  medicamento_nombre?: string
  sucursal_nombre?: string
}

export interface StockInput {
  id_medicamento: string
  id_sucursal: string
  cantidad: number
  precio_usd: number
}

export interface StockUpdateInput {
  cantidad?: number
  precio_usd?: number
}

export interface Venta {
  id_venta: string
  id_cliente: string
  id_empleado: string
  id_sucursal: string
  fecha: Date
  monto_total_usd: number
  codigo_pais: string
  cliente_nombre?: string
}

export interface DetalleVentaInput {
  id_medicamento: string
  cantidad: number
  precio_unitario_usd: number
}

export interface VentaInput {
  id_cliente: string
  id_empleado: string
  id_sucursal: string
  detalles: DetalleVentaInput[]
}

export interface DetalleVenta {
  id_detalle: string
  id_venta: string
  id_medicamento: string
  cantidad: number
  precio_unitario_usd: number
  subtotal_usd: number
  codigo_pais: string
}

export interface VentaCompleta extends Venta {
  detalles: DetalleVenta[]
}

/** Respuesta estándar de API */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
