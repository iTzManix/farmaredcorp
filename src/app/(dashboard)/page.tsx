'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Página raíz del grupo (dashboard).
 * Redirige al dashboard correcto según el rol del usuario:
 *  - superadmin → /dashboard  (ya está en la misma ruta via el page.tsx original, renombrado)
 *  - admin_pe / admin_cl → /admin
 */
export default function DashboardRouter() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.rol === 'superadmin') {
      router.replace('/dashboard')
    } else {
      router.replace('/admin')
    }
  }, [user, isLoading, router])

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
