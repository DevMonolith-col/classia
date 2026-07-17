"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminSidebar } from "@/components/admin/sidebar"
import { isImpersonating, exitImpersonation } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { AlertTriangle, LogOut } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setImpersonating(isImpersonating())
  }, [])

  const handleExit = () => {
    if (exitImpersonation()) {
      router.push("/superadmin/tenants")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((c) => !c)} />
      {/* Mobile top bar offset */}
      <div className={`transition-all duration-300 lg:pt-0 pt-16 ${isCollapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        {impersonating && (
          <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-500 px-6 py-2.5 text-amber-950 shadow-md">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-5 w-5" />
              <span>Estás operando en modo Super Administrador dentro de este colegio.</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 border-amber-700 bg-amber-100 text-amber-900 hover:bg-amber-200"
              onClick={handleExit}
            >
              <LogOut className="h-4 w-4" />
              Volver al panel SaaS
            </Button>
          </div>
        )}
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
