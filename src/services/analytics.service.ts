// ============================================================
// src/services/analytics.service.ts
// Consultas de análisis y tendencias para el dashboard del superadmin.
//
// Todas las queries se ejecutan contra el almacén central Bolivia
// que consolida datos de PE y CL.
//
// Endpoints que usan este servicio:
//   GET /api/dashboard/analytics/ventas-por-dia
//   GET /api/dashboard/analytics/top-medicamentos
//   GET /api/dashboard/analytics/ventas-por-sucursal
//   GET /api/dashboard/analytics/stock-critico
// ============================================================

import sql from 'mssql'
import { getDbBolivia } from '../lib/db'

// ─── Ventas por día ──────────────────────────────────────────────────────────

export interface VentaPorDia {
  fecha:         string   // ISO date string "YYYY-MM-DD"
  total_ventas:  number
  monto_total:   number
  codigo_pais:   string
}

/**
 * Agrupa las ventas por día en los últimos N días.
 * Útil para gráficos de línea/área de tendencia de ingresos.
 *
 * @param codigo_pais - 'PE', 'CL', o undefined para ambos
 * @param dias        - número de días hacia atrás (default 30)
 */
export async function getVentasPorDia(
  codigo_pais?: string,
  dias = 30
): Promise<VentaPorDia[]> {
  const db = await getDbBolivia()

  const whereCP = codigo_pais && ['PE', 'CL'].includes(codigo_pais)
    ? `AND codigo_pais = '${codigo_pais}'`
    : `AND codigo_pais IN ('PE', 'CL')`

  const res = await db.request()
    .input('dias', sql.Int, dias)
    .query<VentaPorDia>(`
      SELECT
        CONVERT(VARCHAR(10), fecha, 120)   AS fecha,
        COUNT(*)                           AS total_ventas,
        ISNULL(SUM(monto_total_usd), 0)    AS monto_total,
        codigo_pais
      FROM venta
      WHERE fecha >= DATEADD(day, -@dias, GETDATE())
        ${whereCP}
      GROUP BY CONVERT(VARCHAR(10), fecha, 120), codigo_pais
      ORDER BY fecha ASC
    `)

  return res.recordset
}

// ─── Top medicamentos más vendidos ───────────────────────────────────────────

export interface TopMedicamento {
  id_medicamento:  string
  nombre:          string
  codigo_pais:     string
  total_vendido:   number   // unidades totales
  ingreso_total:   number   // USD
  veces_en_ventas: number   // número de ventas distintas donde aparece
}

/**
 * Los N medicamentos con mayor volumen de ventas (en unidades).
 * Útil para un ranking tipo "podio" o gráfico de barras horizontales.
 *
 * @param codigo_pais - 'PE', 'CL', o undefined para ambos
 * @param topN        - cuántos medicamentos retornar (default 10)
 */
export async function getTopMedicamentos(
  codigo_pais?: string,
  topN = 10
): Promise<TopMedicamento[]> {
  const db = await getDbBolivia()

  const whereCP = codigo_pais && ['PE', 'CL'].includes(codigo_pais)
    ? `AND d.codigo_pais = '${codigo_pais}'`
    : `AND d.codigo_pais IN ('PE', 'CL')`

  const res = await db.request()
    .input('topN', sql.Int, Math.min(50, Math.max(1, topN)))
    .query<TopMedicamento>(`
      SELECT TOP (@topN)
        d.id_medicamento,
        m.nombre,
        d.codigo_pais,
        SUM(d.cantidad)         AS total_vendido,
        SUM(d.subtotal_usd)     AS ingreso_total,
        COUNT(DISTINCT d.id_venta) AS veces_en_ventas
      FROM detalle_venta d
      JOIN medicamento m ON d.id_medicamento = m.id_medicamento
      WHERE 1 = 1 ${whereCP}
      GROUP BY d.id_medicamento, m.nombre, d.codigo_pais
      ORDER BY total_vendido DESC
    `)

  return res.recordset
}

// ─── Ventas por sucursal ─────────────────────────────────────────────────────

export interface VentaPorSucursal {
  id_sucursal:      string
  sucursal_nombre:  string
  codigo_pais:      string
  total_ventas:     number
  monto_total:      number
  ticket_promedio:  number   // monto_total / total_ventas
}

/**
 * Resumen de ventas agrupado por sucursal.
 * Útil para comparar desempeño entre locales.
 *
 * @param codigo_pais - 'PE', 'CL', o undefined para ambos
 */
export async function getVentasPorSucursal(
  codigo_pais?: string
): Promise<VentaPorSucursal[]> {
  const db = await getDbBolivia()

  const whereCP = codigo_pais && ['PE', 'CL'].includes(codigo_pais)
    ? `AND v.codigo_pais = '${codigo_pais}'`
    : `AND v.codigo_pais IN ('PE', 'CL')`

  const res = await db.request().query<VentaPorSucursal>(`
    SELECT
      v.id_sucursal,
      s.nombre                              AS sucursal_nombre,
      v.codigo_pais,
      COUNT(*)                              AS total_ventas,
      ISNULL(SUM(v.monto_total_usd), 0)     AS monto_total,
      ISNULL(AVG(v.monto_total_usd), 0)     AS ticket_promedio
    FROM venta v
    JOIN sucursal s ON v.id_sucursal = s.id_sucursal
    WHERE 1 = 1 ${whereCP}
    GROUP BY v.id_sucursal, s.nombre, v.codigo_pais
    ORDER BY monto_total DESC
  `)

  return res.recordset
}

// ─── Stock crítico ───────────────────────────────────────────────────────────

export interface StockCritico {
  id_stock:          string
  id_medicamento:    string
  medicamento_nombre: string
  id_sucursal:       string
  sucursal_nombre:   string
  cantidad:          number
  precio_usd:        number
  codigo_pais:       string
}

/**
 * Registros de stock por debajo de un umbral mínimo.
 * Útil para alertas de reposición en el dashboard.
 *
 * @param codigo_pais - 'PE', 'CL', o undefined para ambos
 * @param umbral      - cantidad mínima (default 10 unidades)
 */
export async function getStockCritico(
  codigo_pais?: string,
  umbral = 10
): Promise<StockCritico[]> {
  const db = await getDbBolivia()

  const whereCP = codigo_pais && ['PE', 'CL'].includes(codigo_pais)
    ? `AND st.codigo_pais = '${codigo_pais}'`
    : `AND st.codigo_pais IN ('PE', 'CL')`

  const res = await db.request()
    .input('umbral', sql.Int, umbral)
    .query<StockCritico>(`
      SELECT
        st.id_stock,
        st.id_medicamento,
        m.nombre          AS medicamento_nombre,
        st.id_sucursal,
        s.nombre          AS sucursal_nombre,
        st.cantidad,
        st.precio_usd,
        st.codigo_pais
      FROM stock st
      JOIN medicamento m ON st.id_medicamento = m.id_medicamento
      JOIN sucursal    s ON st.id_sucursal    = s.id_sucursal
      WHERE st.cantidad <= @umbral
        AND m.activo = 1
        ${whereCP}
      ORDER BY st.cantidad ASC
    `)

  return res.recordset
}

// ─── Resumen de ingresos (útil para KPI de monto total) ─────────────────────

export interface IngresoResumen {
  codigo_pais:         string
  total_ventas:        number
  ingreso_total_usd:   number
  ticket_promedio_usd: number
  periodo_dias:        number
}

/**
 * Ingresos totales en los últimos N días, por país.
 *
 * @param dias - número de días (default 30)
 */
export async function getIngresosPorPeriodo(dias = 30, codigo_pais?: string): Promise<IngresoResumen[]> {
  const db = await getDbBolivia()

  const whereCP = codigo_pais && ['PE', 'CL'].includes(codigo_pais)
    ? `AND codigo_pais = '${codigo_pais}'`
    : `AND codigo_pais IN ('PE', 'CL')`

  const res = await db.request()
    .input('dias', sql.Int, dias)
    .query<IngresoResumen>(`
      SELECT
        codigo_pais,
        COUNT(*)                        AS total_ventas,
        ISNULL(SUM(monto_total_usd), 0) AS ingreso_total_usd,
        ISNULL(AVG(monto_total_usd), 0) AS ticket_promedio_usd,
        @dias                           AS periodo_dias
      FROM venta
      WHERE fecha >= DATEADD(day, -@dias, GETDATE())
        ${whereCP}
      GROUP BY codigo_pais
    `)

  return res.recordset
}
