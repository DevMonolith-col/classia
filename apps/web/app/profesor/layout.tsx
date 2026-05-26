"use client"

import { useState } from "react"
import { ProfesorSidebar } from "@/components/profesor/sidebar"

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <ProfesorSidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((c) => !c)} />
      <div className={`transition-all duration-300 lg:pt-0 pt-16 ${isCollapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
