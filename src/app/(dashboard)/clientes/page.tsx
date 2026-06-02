'use client'

import React, { useEffect, useState } from 'react'
import { useAuth, fetchWithAuth } from '../../../contexts/AuthContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Label } from '../../../components/ui/Label'
import { Select } from '../../../components/ui/Select'
import { Modal } from '../../../components/ui/Modal'
import { Plus, Edit2, Trash2, Search, AlertCircle } from 'lucide-react'

export default function ClientesPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.rol === 'superadmin'

  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<any>(null)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    codigo_pais: (user?.codigo_pais || 'PE') as string
  })

  const loadClientes = async (p = 1) => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/clientes?page=${p}&limit=10`).then(r => r.json())
      if (res.success) {
        setClientes(res.data)
        setPagination(res.pagination)
        setPage(p)
      }
    } catch (error) {
      console.error("Error loading clientes", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadClientes()
  }, [user])

  const openNewModal = () => {
    setEditingCliente(null)
    setFormData({ nombre: '', email: '', telefono: '', codigo_pais: (user?.codigo_pais || 'PE') as string })
    setErrorMsg('')
    setIsModalOpen(true)
  }

  const openEditModal = (cliente: any) => {
    setEditingCliente(cliente)
    setFormData({
      nombre: cliente.nombre || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      codigo_pais: cliente.codigo_pais
    })
    setErrorMsg('')
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este paciente (baja lógica)?')) return
    
    try {
      const res = await fetchWithAuth(`/api/clientes/${id}`, {
        method: 'DELETE'
      }).then(r => r.json())

      if (res.success) {
        loadClientes(page)
      } else {
        alert(res.error || 'Error al eliminar')
      }
    } catch (error) {
      alert('Error de red al eliminar')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const url = editingCliente ? `/api/clientes/${editingCliente.id_cliente}` : `/api/clientes`
      const method = editingCliente ? 'PUT' : 'POST'
      
      const payload: any = {
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
      }
      
      // Superadmin debe enviar codigo_pais al crear
      if (!editingCliente && isSuperadmin) {
        payload.codigo_pais = formData.codigo_pais
      }

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload)
      }).then(r => r.json())

      if (res.success) {
        setIsModalOpen(false)
        loadClientes(editingCliente ? page : 1) // ir a pag 1 si es nuevo
      } else {
        setErrorMsg(res.error || 'Error al guardar')
      }
    } catch (error) {
      setErrorMsg('Error de red')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500">Gestiona los pacientes registrados en el sistema.</p>
        </div>
        <Button onClick={openNewModal} className="shrink-0 shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Paciente
        </Button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9 h-9 bg-white" placeholder="Buscar paciente..." />
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      No hay pacientes registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((c) => (
                    <TableRow key={c.id_cliente}>
                      <TableCell className="font-medium text-slate-900">{c.nombre}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-600">{c.email || '—'}</span>
                          <span className="text-xs text-slate-400">{c.telefono || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          c.codigo_pais === 'PE' ? 'bg-amber-100 text-amber-800' : 
                          c.codigo_pais === 'CL' ? 'bg-indigo-100 text-indigo-800' : 
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {c.codigo_pais}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.activo ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                            Inactivo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {c.activo && (
                          <>
                            <button onClick={() => openEditModal(c)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50 rounded transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(c.id_cliente)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
                </span>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    className="h-8 text-xs" 
                    disabled={!pagination.hasPrev}
                    onClick={() => loadClientes(pagination.page - 1)}
                  >
                    Anterior
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-8 text-xs" 
                    disabled={!pagination.hasNext}
                    onClick={() => loadClientes(pagination.page + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal CRUD */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingCliente ? 'Editar Paciente' : 'Nuevo Paciente'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre Completo *</Label>
            <Input 
              id="nombre" 
              required 
              value={formData.nombre}
              onChange={e => setFormData({...formData, nombre: e.target.value})}
              placeholder="Ej. Juan Pérez"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="juan@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input 
                id="telefono" 
                value={formData.telefono}
                onChange={e => setFormData({...formData, telefono: e.target.value})}
                placeholder="+56 9..."
              />
            </div>
          </div>

          {/* País (solo superadmin creando nuevo) */}
          {!editingCliente && isSuperadmin && (
            <div className="space-y-2">
              <Label htmlFor="pais">Nodo Destino *</Label>
              <Select 
                id="pais"
                value={formData.codigo_pais}
                onChange={e => setFormData({...formData, codigo_pais: e.target.value})}
              >
                <option value="PE">Perú (PE)</option>
                <option value="CL">Chile (CL)</option>
                <option value="BO">Bolivia (BO - Central)</option>
              </Select>
              <p className="text-[10px] text-slate-500">Selecciona en qué base de datos se guardará el registro.</p>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Paciente'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
