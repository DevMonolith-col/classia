"use client"

import { useState } from "react"
import { AdminSidebar } from "@/components/admin/sidebar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((c) => !c)} />
      {/* Mobile top bar offset */}
      <div className={`transition-all duration-300 lg:pt-0 pt-16 ${isCollapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
