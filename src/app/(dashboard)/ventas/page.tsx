'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth, fetchWithAuth } from '../../../contexts/AuthContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Label } from '../../../components/ui/Label'
import { Select } from '../../../components/ui/Select'
import { Modal } from '../../../components/ui/Modal'
import { ShoppingCart, Plus, Trash2 } from 'lucide-react'

function formatUSD(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function VentasPage() {
  const { user } = useAuth()
  
  const [ventas, setVentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Data for the modal
  const [clientes, setClientes] = useState<any[]>([])
  const [empleados, setEmpleados] = useState<any[]>([])
  const [sucursales, setSucursales] = useState<any[]>([])
  const [stockActivo, setStockActivo] = useState<any[]>([])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Cart / Form State
  const [formData, setFormData] = useState({
    id_cliente: '',
    id_empleado: '',
    id_sucursal: ''
  })
  const [cart, setCart] = useState<any[]>([])
  const [selectedStockId, setSelectedStockId] = useState('')
  const [selectedQty, setSelectedQty] = useState(1)

  const loadVentas = async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/ventas?limit=100`).then(r => r.json())
      if (res.success) setVentas(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadDependencies = async () => {
    try {
      const [rCli, rEmp, rSuc, rStock] = await Promise.all([
        fetchWithAuth(`/api/clientes?limit=1000`).then(r => r.json()),
        fetchWithAuth(`/api/empleados?limit=1000`).then(r => r.json()),
        fetchWithAuth(`/api/sucursales?limit=1000`).then(r => r.json()),
        fetchWithAuth(`/api/stock?limit=1000`).then(r => r.json())
      ])
      
      // Filtrar activos (y que coincidan con el nodo actual, aunque la API ya lo hace para admins locales)
      if (rCli.success) setClientes(rCli.data.filter((c:any) => c.activo))
      if (rEmp.success) setEmpleados(rEmp.data.filter((e:any) => e.activo))
      if (rSuc.success) setSucursales(rSuc.data.filter((s:any) => s.activo))
      if (rStock.success) {
        // Solo stock con cantidad > 0
        setStockActivo(rStock.data.filter((s:any) => s.cantidad > 0))
      }
    } catch (e) {
      console.error("Error loading pos dependencies", e)
    }
  }

  useEffect(() => {
    if (user) loadVentas()
  }, [user])

  const openPosModal = async () => {
    setIsModalOpen(true)
    setCart([])
    setFormData({ id_cliente: '', id_empleado: '', id_sucursal: '' })
    await loadDependencies()
  }

  const addToCart = () => {
    if (!selectedStockId || selectedQty <= 0) return
    const stockItem = stockActivo.find(s => s.id_stock === selectedStockId)
    if (!stockItem) return
    
    // Validar cantidad disponible
    const currentInCart = cart.find(c => c.id_stock === selectedStockId)?.cantidad || 0
    if (currentInCart + selectedQty > stockItem.cantidad) {
      alert('No hay suficiente stock para agregar esa cantidad.')
      return
    }

    setCart(prev => {
      const existing = prev.find(item => item.id_stock === selectedStockId)
      if (existing) {
        return prev.map(item => item.id_stock === selectedStockId 
          ? { ...item, cantidad: item.cantidad + selectedQty, subtotal: (item.cantidad + selectedQty) * item.precio_usd } 
          : item)
      } else {
        return [...prev, {
          id_stock: stockItem.id_stock,
          id_medicamento: stockItem.id_medicamento,
          nombre: stockItem.medicamento_nombre,
          precio_usd: stockItem.precio_usd,
          cantidad: selectedQty,
          subtotal: selectedQty * stockItem.precio_usd
        }]
      }
    })

    setSelectedStockId('')
    setSelectedQty(1)
  }

  const removeFromCart = (id_stock: string) => {
    setCart(prev => prev.filter(item => item.id_stock !== id_stock))
  }

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.subtotal, 0), [cart])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) return alert('El carrito está vacío.')
    
    setIsSubmitting(true)
    try {
      const payload = {
        id_cliente: formData.id_cliente,
        id_empleado: formData.id_empleado,
        id_sucursal: formData.id_sucursal,
        detalles: cart.map(item => ({
          id_medicamento: item.id_medicamento,
          cantidad: item.cantidad,
          precio_unitario_usd: item.precio_usd
        }))
      }

      const res = await fetchWithAuth('/api/ventas', {
        method: 'POST',
        body: JSON.stringify(payload)
      }).then(r => r.json())

      if (res.success) {
        setIsModalOpen(false)
        loadVentas()
      } else {
        alert(res.error || 'Error al procesar la venta')
      }
    } catch (err) {
      alert('Error de red al procesar venta')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
          <p className="text-sm text-slate-500">Historial de transacciones y punto de venta.</p>
        </div>
        <Button onClick={openPosModal} className="shrink-0 shadow-sm">
          <ShoppingCart className="w-4 h-4 mr-2" />
          Nueva Venta (POS)
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Venta</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total (USD)</TableHead>
                <TableHead>País</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">No hay ventas registradas.</TableCell>
                </TableRow>
              ) : ventas.map(v => (
                <TableRow key={v.id_venta}>
                  <TableCell className="font-medium text-slate-900 truncate max-w-[150px]">
                    {v.id_venta.split('-').pop()}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {new Date(v.fecha).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-slate-600">{v.cliente_nombre || '—'}</TableCell>
                  <TableCell className="font-bold text-slate-900">${formatUSD(Number(v.monto_total_usd))}</TableCell>
                  <TableCell><span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">{v.codigo_pais}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* POS Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Terminal Punto de Venta (POS)" maxWidth="max-w-4xl">
        <form onSubmit={handleSubmit} className="flex gap-6 h-[65vh]">
          
          {/* Columna Izquierda: Configuración de la venta y productos */}
          <div className="flex-1 flex flex-col space-y-4 pr-6 border-r border-slate-100 overflow-y-auto">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select required value={formData.id_cliente} onChange={e => setFormData({...formData, id_cliente: e.target.value})}>
                  <option value="">Seleccione un cliente...</option>
                  {clientes.map(c => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Empleado (Vendedor)</Label>
                <Select required value={formData.id_empleado} onChange={e => setFormData({...formData, id_empleado: e.target.value})}>
                  <option value="">Seleccione un empleado...</option>
                  {empleados.map(emp => <option key={emp.id_empleado} value={emp.id_empleado}>{emp.nombre}</option>)}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sucursal (Origen del stock)</Label>
              <Select required value={formData.id_sucursal} onChange={e => {
                setFormData({...formData, id_sucursal: e.target.value})
                setCart([]) // Si cambia de sucursal, vaciamos el carrito porque el stock depende de la sucursal
              }}>
                <option value="">Seleccione la sucursal de la venta...</option>
                {sucursales.map(s => <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>)}
              </Select>
            </div>

            <hr className="border-slate-100 my-4" />

            {formData.id_sucursal && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-200">
                <h3 className="font-semibold text-slate-900 text-sm">Agregar Producto</h3>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select 
                      value={selectedStockId} 
                      onChange={e => setSelectedStockId(e.target.value)}
                    >
                      <option value="">Buscar en inventario...</option>
                      {stockActivo.filter(s => s.id_sucursal === formData.id_sucursal).map(s => (
                        <option key={s.id_stock} value={s.id_stock}>
                          {s.medicamento_nombre} - ${s.precio_usd} (Stock: {s.cantidad})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Input 
                    type="number" 
                    min="1" 
                    className="w-24" 
                    value={selectedQty} 
                    onChange={e => setSelectedQty(Number(e.target.value))} 
                  />
                  <Button type="button" onClick={addToCart} disabled={!selectedStockId}>
                    Agregar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Carrito y Totales */}
          <div className="w-[300px] flex flex-col shrink-0">
            <h3 className="font-bold text-slate-900 mb-4">Resumen de Venta</h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
              {cart.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm text-center">
                  El carrito está vacío.<br/>Agrega productos para continuar.
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id_stock} className="bg-slate-50 border border-slate-200 rounded-lg p-3 relative">
                    <button 
                      type="button" 
                      onClick={() => removeFromCart(item.id_stock)}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <p className="font-semibold text-slate-800 text-sm pr-6">{item.nombre}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.cantidad} x ${item.precio_usd}
                    </p>
                    <p className="font-bold text-slate-900 text-sm mt-2 text-right">
                      ${formatUSD(item.subtotal)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 shrink-0">
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-500 font-medium">Total a Pagar</span>
                <span className="text-2xl font-bold text-slate-900">${formatUSD(cartTotal)}</span>
              </div>
              <Button type="submit" className="w-full h-12 text-lg" disabled={cart.length === 0 || isSubmitting}>
                {isSubmitting ? 'Procesando...' : 'Completar Venta'}
              </Button>
            </div>
          </div>

        </form>
      </Modal>

    </div>
  )
}
