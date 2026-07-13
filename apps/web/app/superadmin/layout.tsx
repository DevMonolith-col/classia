"use client"

import { useState } from "react"
import { SuperAdminSidebar } from "@/components/superadmin/sidebar"

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <SuperAdminSidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((current) => !current)} />
      <div className={`transition-all duration-300 lg:pt-0 pt-16 ${isCollapsed ? "lg:pl-16" : "lg:pl-72"}`}>
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
