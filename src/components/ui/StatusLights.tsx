'use client'

import React, { useEffect, useState } from 'react'
import { useAuth, fetchWithAuth } from '../../contexts/AuthContext'

export function StatusLights() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user) return

    const checkStatus = async () => {
      try {
        const res = await fetchWithAuth('/api/status').then(r => r.json())
        if (res.success) {
          setStatus(res.nodes)
        }
      } catch (err) {
        console.error('Error fetching DB status', err)
      }
    }

    checkStatus()
    // Poll cada 30 segundos
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [user])

  if (!user) return null

  // Definimos qué nodos mostrar según el usuario
  const nodesToShow = []
  nodesToShow.push({ id: 'BO', label: 'Central (BO)' })
  
  if (user.rol === 'superadmin' || user.codigo_pais === 'PE') {
    nodesToShow.push({ id: 'PE', label: 'Perú (PE)' })
  }
  if (user.rol === 'superadmin' || user.codigo_pais === 'CL') {
    nodesToShow.push({ id: 'CL', label: 'Chile (CL)' })
  }

  return (
    <div className="flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
      {nodesToShow.map(node => {
        const isOnline = status[node.id] === 'online'
        const isOffline = status[node.id] === 'offline'
        // Si aún no carga, mostramos amarillo/gris
        const bgColor = isOnline ? 'bg-emerald-500' : isOffline ? 'bg-red-500' : 'bg-slate-300'
        const shadow = isOnline ? 'shadow-[0_0_8px_rgba(16,185,129,0.6)]' : ''

        return (
          <div key={node.id} className="flex items-center space-x-1.5" title={`${node.label}: ${status[node.id] || 'Cargando...'}`}>
            <div className="relative flex items-center justify-center">
              <span className={`w-2.5 h-2.5 rounded-full ${bgColor} ${shadow} transition-all duration-500`}></span>
              {isOnline && (
                <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-50 animate-ping"></span>
              )}
            </div>
            <span className="text-[10px] font-medium text-slate-600 select-none">
              {node.id}
            </span>
          </div>
        )
      })}
    </div>
  )
}
