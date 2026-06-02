// ============================================================
// src/lib/uuid.ts
// Generador de UUID prefijado por país.
//
// Formato: "PE-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
//          "CL-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
//          "BO-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
//
// El prefijo permite identificar el país de origen del registro
// sin necesidad de consultar la columna codigo_pais.
// Se genera en el backend ANTES de insertar en la base de datos.
// El mismo ID se usa en el nodo operativo y en Bolivia (almacén central).
// ============================================================

import { v4 as uuidv4 } from 'uuid'

/**
 * Genera un UUID v4 prefijado con el código de país.
 *
 * @param codigo_pais - 'PE', 'CL' o 'BO'
 * @returns string con formato "{PAIS}-{uuid-v4}"
 *
 * @example
 * generateId('PE') // → "PE-3f6a1c2d-4b5e-47a1-b9c2-1234567890ab"
 * generateId('CL') // → "CL-9d2b8e1f-0a3c-4d7e-8f1b-abcdef123456"
 */
export function generateId(codigo_pais: string): string {
  return `${codigo_pais.toUpperCase()}-${uuidv4()}`
}
