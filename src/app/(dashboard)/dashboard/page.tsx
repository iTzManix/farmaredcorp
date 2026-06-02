'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth, fetchWithAuth } from '../../../contexts/AuthContext'
import { Card, CardContent } from '../../../components/ui/Card'
import { DollarSign, Users, AlertTriangle, Activity, ShoppingCart, Info } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function formatUSD(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SuperadminDashboard() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const cpParam = searchParams.get('cp') || 'ALL'

  const [resumen, setResumen] = useState<any>(null)
  const [ingresos, setIngresos] = useState<number>(0)
  const [ventasDia, setVentasDia] = useState<any[]>([])
  const [stockCritico, setStockCritico] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const q = cpParam !== 'ALL' ? `?codigo_pais=${cpParam}` : ''

        const [resResumen, resIngresos, resVentasDia, resStock] = await Promise.all([
          fetchWithAuth(`/api/dashboard/resumen`).then((r: any) => r.json()),
          fetchWithAuth(`/api/dashboard/analytics/ingresos${q}`).then((r: any) => r.json()),
          fetchWithAuth(`/api/dashboard/analytics/ventas-por-dia${q}`).then((r: any) => r.json()),
          fetchWithAuth(`/api/dashboard/analytics/stock-critico${q ? q + '&umbral=15' : '?umbral=15'}`).then((r: any) => r.json()),
        ])

        if (resResumen.success) setResumen(resResumen.data)

        if (resIngresos.success) {
          setIngresos(resIngresos.data.reduce((acc: number, c: any) => acc + c.ingreso_total_usd, 0))
        }

        if (resVentasDia.success) {
          const chartData = resVentasDia.data.reduce((acc: any[], curr: any) => {
            const existing = acc.find(i => i.fecha === curr.fecha)
            if (existing) { existing.monto += curr.monto_total } 
            else { acc.push({ fecha: curr.fecha, monto: curr.monto_total }) }
            return acc
          }, [])
          setVentasDia(chartData)
        }

        if (resStock.success) setStockCritico(resStock.data.slice(0, 5))
      } catch (err) {
        console.error('Error cargando dashboard superadmin', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user, cpParam])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando métricas globales...</span>
        </div>
      </div>
    )
  }

  const isGlobal = cpParam === 'ALL'
  const totalClientes = isGlobal
    ? (resumen?.clientes_pe ?? 0) + (resumen?.clientes_cl ?? 0)
    : cpParam === 'PE' ? resumen?.clientes_pe ?? 0 : resumen?.clientes_cl ?? 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold bg-primary text-white px-2.5 py-0.5 rounded-full">
            Superadmin
          </span>
          <span className="text-xs text-slate-400">Vista Global Consolidada</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {isGlobal ? 'Consolidado Perú + Chile' : `Filtrado por: ${cpParam}`}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 z-0" />
          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Total Sales</p>
                <h3 className="text-2xl font-bold text-slate-900">${formatUSD(ingresos)}</h3>
              </div>
              <div className="p-2 bg-primary text-white rounded-lg shadow-sm">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium text-xs">
              ↑ 12% vs last month
            </span>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 z-0" />
          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Total Patients</p>
                <h3 className="text-2xl font-bold text-slate-900">{totalClientes}</h3>
              </div>
              <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-sm">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium text-xs">
              ↑ 3.1% vs last week
            </span>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 z-0" />
          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Low Stock Alerts</p>
                <h3 className="text-2xl font-bold text-slate-900">{stockCritico.length}</h3>
              </div>
              <div className="p-2 bg-red-500 text-white rounded-lg shadow-sm">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            {stockCritico.length > 0
              ? <span className="text-red-500 font-medium text-xs">Needs attention</span>
              : <span className="text-emerald-500 font-medium text-xs">All good</span>}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 z-0" />
          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Sync Pending</p>
                <h3 className="text-2xl font-bold text-slate-900">{resumen?.sync_pendientes ?? 0}</h3>
              </div>
              <div className="p-2 bg-orange-500 text-white rounded-lg shadow-sm">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-400">Central DB Sync Queue</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Daily Sales Trends</h3>
                <p className="text-xs text-slate-400 mt-0.5">Últimos 30 días · Todos los nodos</p>
              </div>
              <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
                <button className="px-3 py-1 text-xs font-medium rounded-md text-slate-600 hover:text-slate-900">Weekly</button>
                <button className="px-3 py-1 text-xs font-medium rounded-md bg-primary text-white shadow-sm">Monthly</button>
              </div>
            </div>
            <div className="h-64 w-full">
              {ventasDia.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ventasDia} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="fecha"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}` }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: any) => [`$${formatUSD(Number(v))}`, 'Ventas']}
                      labelFormatter={(l) => `Fecha: ${l}`}
                    />
                    <Area type="monotone" dataKey="monto" stroke="#1d4ed8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMonto)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No hay datos de ventas en este período.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-1 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">Recent Activity</h3>
              <button className="text-xs text-primary font-medium hover:underline">View All</button>
            </div>
            <div className="space-y-5">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Venta Registrada</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Operación completada en el sistema.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Hace 10 mins</p>
                </div>
              </div>

              {stockCritico.map((stock: any) => (
                <div key={stock.id_stock} className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Alerta de Inventario</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {stock.medicamento_nombre} — {stock.cantidad} uds. restantes
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">{stock.sucursal_nombre} · {stock.codigo_pais}</p>
                  </div>
                </div>
              ))}

              {stockCritico.length === 0 && (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Sistema Óptimo</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">No hay alertas de stock activas.</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
