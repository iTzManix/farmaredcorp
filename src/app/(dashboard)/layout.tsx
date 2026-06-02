'use client'

import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  Search,
  Bell,
  HelpCircle,
  Plus
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { StatusLights } from '../../components/ui/StatusLights'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentCp = searchParams.get('cp') || 'ALL'

  const isSuperadmin = user?.rol === 'superadmin'
  const dashboardHref = isSuperadmin ? '/dashboard' : '/admin'

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading || !isAuthenticated || !user) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  }

  // isSuperadmin ya se definió arriba

  const NavItem = ({ icon: Icon, label, href }: { icon: any, label: string, href: string }) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium
        ${isActive ? 'bg-primary-light text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
      `}>
        <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg leading-none mt-[-2px]">G</span>
            </div>
            <div>
              <h1 className="font-bold text-primary leading-tight">Global Pharma</h1>
              <p className="text-[10px] text-slate-500 font-medium">Clinical Systems</p>
            </div>
          </div>
          
          <Button className="w-full mb-8 shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> New Report
          </Button>

          <nav className="space-y-1">
            <NavItem icon={LayoutDashboard} label="Dashboard" href={dashboardHref} />
            <NavItem icon={Package} label="Inventario" href="/inventario" />
            <NavItem icon={ShoppingCart} label="Ventas" href="/ventas" />
            <NavItem icon={Users} label="Pacientes" href="/clientes" />
            <NavItem icon={Settings} label="Configuración" href="/configuracion" />
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center space-x-3 px-2 py-2 mb-2 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold text-xs">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user.email}</p>
              <p className="text-[10px] text-slate-500 uppercase">{user.rol}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="w-96 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <Input 
              type="text" 
              placeholder="Search patients, inventory, or sales..." 
              className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-1"
            />
          </div>

          <div className="flex items-center space-x-6">
            {isSuperadmin && (
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-slate-500 font-medium">Global View:</span>
                <select 
                  className="h-8 rounded border-slate-200 text-sm bg-slate-50 font-medium text-slate-700 outline-none focus:ring-1 focus:ring-primary px-2"
                  value={currentCp}
                  onChange={(e) => router.push(`?cp=${e.target.value}`)}
                >
                  <option value="ALL">All Countries</option>
                  <option value="PE">Perú (PE)</option>
                  <option value="CL">Chile (CL)</option>
                </select>
              </div>
            )}
            
            {/* STATUS LIGHTS HERE */}
            <StatusLights />

            <div className="flex items-center space-x-4 text-slate-500">
              <button className="relative hover:text-slate-900 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>
              <button className="hover:text-slate-900 transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
