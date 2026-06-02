'use client'

import React, { useEffect, useState } from 'react'
import { useAuth, fetchWithAuth } from '../../../contexts/AuthContext'
import { Card, CardContent } from '../../../components/ui/Card'
import {
  DollarSign, Users, Package, AlertTriangle,
  ShoppingCart, TrendingUp, Info, Clock, RefreshCw
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatUSD(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Ahora'
  if (m < 60) return `Hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Hace ${h}h`
  return `Hace ${Math.floor(h / 24)}d`
}

const COUNTRY_LABEL: Record<string, string> = { PE: 'Perú', CL: 'Chile', BO: 'Bolivia' }
const COUNTRY_COLOR: Record<string, string> = { PE: '#f59e0b', CL: '#6366f1' }

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth()
  const cp = user?.codigo_pais ?? 'PE'

  // ── State ─────────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState({
    totalVentas: 0,
    montoTotal: 0,
    totalClientes: 0,
    stockAlertas: 0,
    stockItems: 0,
  })
  const [recentVentas, setRecentVentas] = useState<any[]>([])
  const [stockCritico, setStockCritico] = useState<any[]>([])
  const [topMeds, setTopMeds] = useState<any[]>([])
  const [ventasTrend, setVentasTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [analyticsOk, setAnalyticsOk] = useState(true) // Bolivia disponible?
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // ── Fetch data ────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    try {
      // Datos que SOLO dependen del nodo local
      const [resVentas, resClientes, resStock] = await Promise.all([
        fetchWithAuth(`/api/ventas?limit=1000`).then((r: any) => r.json()),
        fetchWithAuth(`/api/clientes?limit=1000`).then((r: any) => r.json()),
        fetchWithAuth(`/api/stock?limit=1000`).then((r: any) => r.json()),
      ])

      // KPIs locales
      const ventas = resVentas.success ? resVentas.data : []
      const clientes = resClientes.success ? resClientes.data : []
      const stockItems = resStock.success ? resStock.data : []

      const montoTotal = ventas.reduce((acc: number, v: any) => acc + Number(v.monto_total_usd || 0), 0)
      const alertas = stockItems.filter((s: any) => s.cantidad <= 15)

      setKpis({
        totalVentas: ventas.length,
        montoTotal,
        totalClientes: clientes.length,
        stockAlertas: alertas.length,
        stockItems: stockItems.length,
      })

      // Últimas 5 ventas para activity feed
      setRecentVentas(ventas.slice(0, 5))

      // Stock crítico local (umbral 15)
      setStockCritico(alertas.slice(0, 5))

      // Agrupar ventas por día para mini tendencia (últimos 14 días)
      const hace14Dias = new Date()
      hace14Dias.setDate(hace14Dias.getDate() - 14)
      const ventasRecientes = ventas.filter((v: any) => new Date(v.fecha) >= hace14Dias)

      const grouped: Record<string, number> = {}
      ventasRecientes.forEach((v: any) => {
        const day = v.fecha?.split('T')[0] ?? v.fecha
        grouped[day] = (grouped[day] || 0) + Number(v.monto_total_usd || 0)
      })
      const trend = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, monto]) => ({ fecha, monto }))
      setVentasTrend(trend)

      // Analytics desde Bolivia (opcional — puede fallar)
      try {
        const resTop = await fetchWithAuth(
          `/api/dashboard/analytics/top-medicamentos?codigo_pais=${cp}&limit=5`
        ).then((r: any) => r.json())
        if (resTop.success) {
          setTopMeds(resTop.data)
          setAnalyticsOk(true)
        }
      } catch {
        setAnalyticsOk(false)
      }

      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error cargando dashboard local', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando datos del nodo {COUNTRY_LABEL[cp]}...</span>
        </div>
      </div>
    )
  }

  const accentColor = cp === 'CL' ? '#6366f1' : '#f59e0b'
  const accentBg = cp === 'CL' ? 'bg-indigo-500' : 'bg-amber-500'
  const accentLight = cp === 'CL' ? 'bg-indigo-50' : 'bg-amber-50'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${accentBg}`}>
              Nodo {cp}
            </span>
            <span className="text-xs text-slate-400">
              {COUNTRY_LABEL[cp]} · Administración Local
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Vista operativa del nodo <strong>{COUNTRY_LABEL[cp]}</strong>
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar · {lastRefresh.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>

      {/* Aviso si Bolivia no responde */}
      {!analyticsOk && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Nodo central (Bolivia) sin respuesta.</strong> Los datos locales están disponibles.
            El ranking de medicamentos no está disponible en este momento.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Ingresos */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className={`absolute right-0 top-0 w-20 h-20 rounded-bl-full -mr-3 -mt-3 z-0 ${accentLight}`} />
          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Ingresos Totales</p>
                <h3 className="text-2xl font-bold text-slate-900">${formatUSD(kpis.montoTotal)}</h3>
              </div>
              <div className={`p-2 text-white rounded-lg shadow-sm ${accentBg}`}>
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-400">Todas las ventas registradas</p>
          </CardContent>
        </Card>

        {/* Ventas */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-3 -mt-3 z-0" />
          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Ventas</p>
                <h3 className="text-2xl font-bold text-slate-900">{kpis.totalVentas}</h3>
              </div>
              <div className="p-2 bg-primary text-white rounded-lg shadow-sm">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-400">Transacciones registradas</p>
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-20 h-20 bg-emerald-50 rounded-bl-full -mr-3 -mt-3 z-0" />
          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Pacientes</p>
                <h3 className="text-2xl font-bold text-slate-900">{kpis.totalClientes}</h3>
              </div>
              <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-sm">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-400">Clientes activos en el nodo</p>
          </CardContent>
        </Card>

        {/* Stock Alertas */}
        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-20 h-20 bg-red-50 rounded-bl-full -mr-3 -mt-3 z-0" />
          <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Stock Crítico</p>
                <h3 className="text-2xl font-bold text-slate-900">{kpis.stockAlertas}</h3>
              </div>
              <div className="p-2 bg-red-500 text-white rounded-lg shadow-sm">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            {kpis.stockAlertas > 0 ? (
              <p className="text-xs text-red-500 font-medium">Requiere atención</p>
            ) : (
              <p className="text-xs text-emerald-500 font-medium">Stock en niveles óptimos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Tendencia de ventas locales (datos del nodo) */}
        <Card className="col-span-1 lg:col-span-2 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tendencia de Ingresos</h3>
                <p className="text-xs text-slate-400 mt-0.5">Últimos 14 días · Nodo {COUNTRY_LABEL[cp]}</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                Datos locales
              </span>
            </div>
            <div className="h-56 w-full">
              {ventasTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ventasTrend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={accentColor} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="fecha"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={(v) => {
                        const d = new Date(v)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: any) => [`$${formatUSD(Number(v))}`, 'Ingresos']}
                      labelFormatter={(l) => `Fecha: ${l}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="monto"
                      stroke={accentColor}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#adminGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <TrendingUp className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Sin ventas en los últimos 14 días.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed: Últimas Ventas */}
        <Card className="col-span-1 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">Últimas Ventas</h3>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="space-y-4">
              {recentVentas.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
                  <Info className="w-6 h-6 opacity-40" />
                  <p className="text-xs">No hay ventas registradas aún.</p>
                </div>
              )}
              {recentVentas.map((v: any) => (
                <div key={v.id_venta} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      Venta #{v.id_venta?.slice(-8)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {v.fecha ? timeAgo(v.fecha) : '—'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900 shrink-0">
                    ${formatUSD(Number(v.monto_total_usd || 0))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom grid: Stock crítico + Top medicamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Stock crítico local */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Alertas de Stock</h3>
                <p className="text-xs text-slate-400 mt-0.5">Medicamentos con ≤ 15 unidades</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                {kpis.stockAlertas} alertas
              </span>
            </div>

            {stockCritico.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                <Package className="w-8 h-8 opacity-30" />
                <p className="text-sm">Todo el stock en niveles seguros.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stockCritico.map((s: any) => (
                  <div key={s.id_stock} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-red-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{s.nombre || s.medicamento_nombre || '—'}</p>
                      <p className="text-[10px] text-slate-500 truncate">{s.sucursal_nombre || 'Sucursal principal'}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.cantidad <= 5
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {s.cantidad} ud.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top medicamentos (viene de analytics/Bolivia) */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Top Medicamentos</h3>
                <p className="text-xs text-slate-400 mt-0.5">Más vendidos en {COUNTRY_LABEL[cp]}</p>
              </div>
              {!analyticsOk && (
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                  Bolivia offline
                </span>
              )}
            </div>

            {!analyticsOk ? (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                <Info className="w-8 h-8 opacity-30" />
                <p className="text-sm text-center">No disponible sin conexión al nodo central.</p>
              </div>
            ) : topMeds.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                <Package className="w-8 h-8 opacity-30" />
                <p className="text-sm">Sin datos de ventas aún.</p>
              </div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topMeds}
                    layout="vertical"
                    margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: any) => [v, 'Unidades vendidas']}
                    />
                    <Bar dataKey="total_vendido" radius={[0, 6, 6, 0]}>
                      {topMeds.map((_: any, i: number) => (
                        <Cell
                          key={i}
                          fill={accentColor}
                          fillOpacity={1 - i * 0.12}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
