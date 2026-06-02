'use client'

import React, { useEffect, useState } from 'react'
import { useAuth, fetchWithAuth } from '../../../contexts/AuthContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Label } from '../../../components/ui/Label'
import { Select } from '../../../components/ui/Select'
import { Modal } from '../../../components/ui/Modal'
import { Plus, Edit2, Trash2, Building2, Users } from 'lucide-react'

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.rol === 'superadmin'

  const [activeTab, setActiveTab] = useState<'sucursales' | 'empleados'>('sucursales')
  
  // Data States
  const [sucursales, setSucursales] = useState<any[]>([])
  const [empleados, setEmpleados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [isSucursalModalOpen, setIsSucursalModalOpen] = useState(false)
  const [isEmpleadoModalOpen, setIsEmpleadoModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  // Forms
  const [sucursalForm, setSucursalForm] = useState({ nombre: '', direccion: '', codigo_pais: 'PE' })
  const [empleadoForm, setEmpleadoForm] = useState({ nombre: '', cargo: '', id_sucursal: '', codigo_pais: 'PE' })

  // ─── Fetch Data ─────────────────────────────────────────────────────────────
  
  const loadData = async () => {
    setLoading(true)
    try {
      const [resSuc, resEmp] = await Promise.all([
        fetchWithAuth(`/api/sucursales?limit=1000`).then(r => r.json()),
        fetchWithAuth(`/api/empleados?limit=1000`).then(r => r.json())
      ])
      if (resSuc.success) setSucursales(resSuc.data)
      if (resEmp.success) setEmpleados(resEmp.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadData()
  }, [user])

  // ─── Handlers Sucursales ────────────────────────────────────────────────────

  const handleSucursalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingItem ? `/api/sucursales/${editingItem.id_sucursal}` : '/api/sucursales'
    const method = editingItem ? 'PUT' : 'POST'
    
    const payload: any = { nombre: sucursalForm.nombre, direccion: sucursalForm.direccion }
    if (!editingItem && isSuperadmin) payload.codigo_pais = sucursalForm.codigo_pais

    const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) }).then(r => r.json())
    if (res.success) {
      setIsSucursalModalOpen(false)
      loadData()
    } else {
      alert(res.error || 'Error')
    }
  }

  const deleteSucursal = async (id: string) => {
    if (!confirm('Eliminar sucursal?')) return
    const res = await fetchWithAuth(`/api/sucursales/${id}`, { method: 'DELETE' }).then(r => r.json())
    if (res.success) loadData()
  }

  // ─── Handlers Empleados ─────────────────────────────────────────────────────

  const handleEmpleadoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingItem ? `/api/empleados/${editingItem.id_empleado}` : '/api/empleados'
    const method = editingItem ? 'PUT' : 'POST'
    
    const payload: any = { 
      nombre: empleadoForm.nombre, 
      cargo: empleadoForm.cargo,
      id_sucursal: empleadoForm.id_sucursal 
    }
    if (!editingItem && isSuperadmin) payload.codigo_pais = empleadoForm.codigo_pais

    const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) }).then(r => r.json())
    if (res.success) {
      setIsEmpleadoModalOpen(false)
      loadData()
    } else {
      alert(res.error || 'Error')
    }
  }

  const deleteEmpleado = async (id: string) => {
    if (!confirm('Eliminar empleado?')) return
    const res = await fetchWithAuth(`/api/empleados/${id}`, { method: 'DELETE' }).then(r => r.json())
    if (res.success) loadData()
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header & Tabs */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-sm text-slate-500">Administra las sucursales y el personal médico/operativo.</p>
        </div>

        <div className="flex space-x-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('sucursales')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sucursales' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Building2 className="w-4 h-4" /> Sucursales
          </button>
          <button
            onClick={() => setActiveTab('empleados')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'empleados' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" /> Personal
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        
        {/* Actions Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-semibold text-slate-700">
            {activeTab === 'sucursales' ? 'Directorio de Sucursales' : 'Directorio de Personal'}
          </h2>
          <Button 
            onClick={() => {
              setEditingItem(null)
              if (activeTab === 'sucursales') {
                setSucursalForm({ nombre: '', direccion: '', codigo_pais: user?.codigo_pais || 'PE' })
                setIsSucursalModalOpen(true)
              } else {
                setEmpleadoForm({ nombre: '', cargo: '', id_sucursal: sucursales[0]?.id_sucursal || '', codigo_pais: user?.codigo_pais || 'PE' })
                setIsEmpleadoModalOpen(true)
              }
            }} 
            className="h-9 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nuevo {activeTab === 'sucursales' ? 'Local' : 'Empleado'}
          </Button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
             <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {activeTab === 'sucursales' ? (
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              ) : (
                <TableRow>
                  <TableHead>Nombre / Cargo</TableHead>
                  <TableHead>Sucursal Asignada</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              
              {/* Render Sucursales */}
              {activeTab === 'sucursales' && sucursales.map((s) => (
                <TableRow key={s.id_sucursal}>
                  <TableCell className="font-medium text-slate-900">{s.nombre}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{s.direccion}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">{s.codigo_pais}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${s.activo ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {s.activo ? 'Operativa' : 'Cerrada'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {s.activo && (
                      <>
                        <button 
                          onClick={() => { setEditingItem(s); setSucursalForm({ nombre: s.nombre, direccion: s.direccion, codigo_pais: s.codigo_pais }); setIsSucursalModalOpen(true) }}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                        ><Edit2 className="w-4 h-4" /></button>
                        <button 
                          onClick={() => deleteSucursal(s.id_sucursal)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        ><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {/* Render Empleados */}
              {activeTab === 'empleados' && empleados.map((e) => (
                <TableRow key={e.id_empleado}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{e.nombre}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">{e.cargo}</p>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {sucursales.find(s => s.id_sucursal === e.id_sucursal)?.nombre || 'Desconocida'}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">{e.codigo_pais}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${e.activo ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {e.activo ? 'Activo' : 'Baja'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {e.activo && (
                      <>
                        <button 
                          onClick={() => { setEditingItem(e); setEmpleadoForm({ nombre: e.nombre, cargo: e.cargo, id_sucursal: e.id_sucursal, codigo_pais: e.codigo_pais }); setIsEmpleadoModalOpen(true) }}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                        ><Edit2 className="w-4 h-4" /></button>
                        <button 
                          onClick={() => deleteEmpleado(e.id_empleado)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        ><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal Sucursal */}
      <Modal isOpen={isSucursalModalOpen} onClose={() => setIsSucursalModalOpen(false)} title={editingItem ? "Editar Sucursal" : "Nueva Sucursal"}>
        <form onSubmit={handleSucursalSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre del Local</Label>
            <Input required value={sucursalForm.nombre} onChange={e => setSucursalForm({...sucursalForm, nombre: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input required value={sucursalForm.direccion} onChange={e => setSucursalForm({...sucursalForm, direccion: e.target.value})} />
          </div>
          {!editingItem && isSuperadmin && (
            <div className="space-y-2">
              <Label>Nodo Destino</Label>
              <Select value={sucursalForm.codigo_pais} onChange={e => setSucursalForm({...sucursalForm, codigo_pais: e.target.value})}>
                <option value="PE">Perú</option><option value="CL">Chile</option><option value="BO">Bolivia</option>
              </Select>
            </div>
          )}
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsSucursalModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Empleado */}
      <Modal isOpen={isEmpleadoModalOpen} onClose={() => setIsEmpleadoModalOpen(false)} title={editingItem ? "Editar Empleado" : "Nuevo Empleado"}>
        <form onSubmit={handleEmpleadoSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre Completo</Label>
            <Input required value={empleadoForm.nombre} onChange={e => setEmpleadoForm({...empleadoForm, nombre: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Cargo / Puesto</Label>
            <Input required value={empleadoForm.cargo} onChange={e => setEmpleadoForm({...empleadoForm, cargo: e.target.value})} placeholder="Ej. Farmacéutico Titular" />
          </div>
          <div className="space-y-2">
            <Label>Sucursal Asignada</Label>
            <Select required value={empleadoForm.id_sucursal} onChange={e => setEmpleadoForm({...empleadoForm, id_sucursal: e.target.value})}>
              <option value="">Seleccione una sucursal...</option>
              {sucursales.filter(s => s.activo && (isSuperadmin ? true : s.codigo_pais === user?.codigo_pais)).map(s => (
                <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre} ({s.codigo_pais})</option>
              ))}
            </Select>
          </div>
          {!editingItem && isSuperadmin && (
            <div className="space-y-2">
              <Label>Nodo Destino</Label>
              <Select value={empleadoForm.codigo_pais} onChange={e => setEmpleadoForm({...empleadoForm, codigo_pais: e.target.value})}>
                <option value="PE">Perú</option><option value="CL">Chile</option><option value="BO">Bolivia</option>
              </Select>
            </div>
          )}
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsEmpleadoModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
