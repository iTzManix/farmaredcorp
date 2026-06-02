'use client'

import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'

const TEST_USERS = [
  { label: 'Super Admin', email: 'superadmin@farma.bo', pass: '123456', cp: 'BO' },
  { label: 'Admin Perú', email: 'admin@farma.pe', pass: '123456', cp: 'PE' },
  { label: 'Admin Chile', email: 'admin@farma.cl', pass: '123456', cp: 'CL' }
]

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codigoPais, setCodigoPais] = useState('BO')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, codigo_pais: codigoPais })
      })

      const data = await res.json()
      if (data.success) {
        login(data.token, data.usuario)
      } else {
        setError(data.error || 'Error de autenticación')
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor')
    } finally {
      setIsLoading(false)
    }
  }

  const fillTestUser = (u: typeof TEST_USERS[0]) => {
    setEmail(u.email)
    setPassword(u.pass)
    setCodigoPais(u.cp)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary">Global Pharma</h2>
          <p className="text-sm text-slate-500 mt-2">Clinical Systems - Acceso Administrativo</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-center">Iniciar Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contraseña</label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                />
              </div>
              
              {/* Select temporal solo para el login, simulando la selección de nodo */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Nodo de Acceso (País)</label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={codigoPais}
                  onChange={(e) => setCodigoPais(e.target.value)}
                >
                  <option value="BO">Bolivia (Central)</option>
                  <option value="PE">Perú</option>
                  <option value="CL">Chile</option>
                </select>
              </div>

              {error && (
                <div className="p-3 rounded bg-red-50 text-red-600 text-sm border border-red-100">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                {isLoading ? 'Conectando...' : 'Entrar al Sistema'}
              </Button>
            </form>

            <div className="mt-8 border-t pt-6">
              <p className="text-sm font-medium text-slate-500 mb-3 text-center">Usuarios de Prueba Rápida:</p>
              <div className="grid grid-cols-1 gap-2">
                {TEST_USERS.map((u) => (
                  <Button 
                    key={u.email} 
                    variant="outline" 
                    className="justify-start text-xs h-8"
                    onClick={() => fillTestUser(u)}
                  >
                    {u.label} - {u.cp}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
