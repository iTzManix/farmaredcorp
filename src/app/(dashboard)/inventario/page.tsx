'use client'

import React, { useEffect, useState } from 'react'
import { useAuth, fetchWithAuth } from '../../../contexts/AuthContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Label } from '../../../components/ui/Label'
import { Select } from '../../../components/ui/Select'
import { Modal } from '../../../components/ui/Modal'
import { Plus, Edit2, Package, AlertTriangle } from 'lucide-react'

export default function InventarioPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.rol === 'superadmin'

  const [stockItems, setStockItems] = useState<any[]>([])
  const [medicamentos, setMedicamentos] = useState<any[]>([])
  const [sucursales, setSucursales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [isMedModalOpen, setIsMedModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  
  // Edit State
  const [editingStock, setEditingStock] = useState<any>(null)
  
  // Forms
  const [medForm, setMedForm] = useState({ nombre: '', descripcion: '', codigo_pais: (user?.codigo_pais || 'PE') as string })
  const [stockForm, setStockForm] = useState({ id_medicamento: '', id_sucursal: '', cantidad: 0, precio_usd: 0 })

  const loadData = async () => {
    setLoading(true)
    try {
      const [resStock, resMeds, resSuc] = await Promise.all([
        fetchWithAuth(`/api/stock?limit=1000`).then(r => r.json()),
        fetchWithAuth(`/api/medicamentos?limit=1000`).then(r => r.json()),
        fetchWithAuth(`/api/sucursales?limit=1000`).then(r => r.json())
      ])
      if (resStock.success) setStockItems(resStock.data)
      if (resMeds.success) setMedicamentos(resMeds.data)
      if (resSuc.success) setSucursales(resSuc.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const handleMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = { nombre: medForm.nombre, descripcion: medForm.descripcion }
    if (isSuperadmin) payload.codigo_pais = medForm.codigo_pais

    const res = await fetchWithAuth('/api/medicamentos', { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json())
    if (res.success) {
      setIsMedModalOpen(false)
      loadData() // Recargar para que aparezca en los selects
    } else alert(res.error)
  }

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingStock ? `/api/stock/${editingStock.id_stock}` : '/api/stock'
    const method = editingStock ? 'PUT' : 'POST'
    
    // Si edito, solo mando cantidad y precio. Si creo, mando id_med y id_sucursal
    const payload = editingStock 
      ? { cantidad: Number(stockForm.cantidad), precio_usd: Number(stockForm.precio_usd) }
      : { 
          id_medicamento: stockForm.id_medicamento, 
          id_sucursal: stockForm.id_sucursal,
          cantidad: Number(stockForm.cantidad), 
          precio_usd: Number(stockForm.precio_usd)
        }

    const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) }).then(r => r.json())
    if (res.success) {
      setIsStockModalOpen(false)
      loadData()
    } else alert(res.error)
  }

  const openEditStock = (item: any) => {
    setEditingStock(item)
    setStockForm({
      id_medicamento: item.id_medicamento,
      id_sucursal: item.id_sucursal,
      cantidad: item.cantidad,
      precio_usd: item.precio_usd
    })
    setIsStockModalOpen(true)
  }

  const openNewStock = () => {
    setEditingStock(null)
    setStockForm({
      id_medicamento: medicamentos[0]?.id_medicamento || '',
      id_sucursal: sucursales[0]?.id_sucursal || '',
      cantidad: 0,
      precio_usd: 0
    })
    setIsStockModalOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventario y Stock</h1>
          <p className="text-sm text-slate-500">Consulta de medicamentos y niveles de stock por sucursal.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => { setMedForm({nombre:'', descripcion:'', codigo_pais: (user?.codigo_pais || 'PE') as string}); setIsMedModalOpen(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Catalogo de Medicamento
          </Button>
          <Button onClick={openNewStock}>
            <Package className="w-4 h-4 mr-2" /> Entrada de Stock
          </Button>
        </div>
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
                <TableHead>Medicamento</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Cantidad (Unidades)</TableHead>
                <TableHead>Precio (USD)</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">No hay registros de stock.</TableCell>
                </TableRow>
              ) : stockItems.map(s => {
                const isCritico = s.cantidad <= 15
                return (
                  <TableRow key={s.id_stock}>
                    <TableCell className="font-medium text-slate-900">{s.medicamento_nombre || s.nombre || 'Desconocido'}</TableCell>
                    <TableCell className="text-slate-500">{s.sucursal_nombre || 'Desconocida'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                        isCritico ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isCritico && <AlertTriangle className="w-3 h-3" />}
                        {s.cantidad}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-700">${Number(s.precio_usd).toFixed(2)}</TableCell>
                    <TableCell><span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">{s.codigo_pais}</span></TableCell>
                    <TableCell className="text-right">
                      <button onClick={() => openEditStock(s)} className="p-1.5 text-slate-400 hover:text-primary transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal Nuevo Medicamento */}
      <Modal isOpen={isMedModalOpen} onClose={() => setIsMedModalOpen(false)} title="Agregar Medicamento al Catálogo">
        <form onSubmit={handleMedSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre Comercial</Label>
            <Input required value={medForm.nombre} onChange={e => setMedForm({...medForm, nombre: e.target.value})} placeholder="Ej. Paracetamol 500mg" />
          </div>
          <div className="space-y-2">
            <Label>Descripción / Principio Activo</Label>
            <Input value={medForm.descripcion} onChange={e => setMedForm({...medForm, descripcion: e.target.value})} />
          </div>
          {isSuperadmin && (
            <div className="space-y-2">
              <Label>Nodo Destino</Label>
              <Select value={medForm.codigo_pais} onChange={e => setMedForm({...medForm, codigo_pais: e.target.value})}>
                <option value="PE">Perú</option><option value="CL">Chile</option><option value="BO">Bolivia</option>
              </Select>
            </div>
          )}
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsMedModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal CRUD Stock */}
      <Modal isOpen={isStockModalOpen} onClose={() => setIsStockModalOpen(false)} title={editingStock ? "Actualizar Stock" : "Registrar Entrada de Stock"}>
        <form onSubmit={handleStockSubmit} className="space-y-4">
          
          {!editingStock ? (
            <>
              <div className="space-y-2">
                <Label>Medicamento</Label>
                <Select required value={stockForm.id_medicamento} onChange={e => setStockForm({...stockForm, id_medicamento: e.target.value})}>
                  <option value="">Seleccione medicamento...</option>
                  {medicamentos.filter(m => m.activo && (isSuperadmin ? true : m.codigo_pais === user?.codigo_pais)).map(m => (
                    <option key={m.id_medicamento} value={m.id_medicamento}>{m.nombre} ({m.codigo_pais})</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sucursal de Destino</Label>
                <Select required value={stockForm.id_sucursal} onChange={e => setStockForm({...stockForm, id_sucursal: e.target.value})}>
                  <option value="">Seleccione sucursal...</option>
                  {sucursales.filter(s => s.activo && (isSuperadmin ? true : s.codigo_pais === user?.codigo_pais)).map(s => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre} ({s.codigo_pais})</option>
                  ))}
                </Select>
              </div>
            </>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 mb-4">
              Editando stock de: <strong className="text-slate-900">{editingStock.medicamento_nombre}</strong><br/>
              Sucursal: <strong className="text-slate-900">{editingStock.sucursal_nombre}</strong>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cantidad (Unidades)</Label>
              <Input type="number" min="0" required value={stockForm.cantidad} onChange={e => setStockForm({...stockForm, cantidad: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Precio Unitario (USD)</Label>
              <Input type="number" min="0" step="0.01" required value={stockForm.precio_usd} onChange={e => setStockForm({...stockForm, precio_usd: Number(e.target.value)})} />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsStockModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
