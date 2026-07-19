"use client"

import { TicketSidebar } from "@/components/support/TicketSidebar"
import { useParams } from "next/navigation"

export default function SuperAdminSupportLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id?: string }

  return (
    <div className="p-4 lg:p-6 h-[calc(100vh-4rem)] lg:h-screen">
      <div className="flex h-full w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className={`w-full sm:w-[350px] lg:w-[400px] shrink-0 border-r border-border h-full ${id ? 'hidden sm:block' : 'block'}`}>
          <TicketSidebar basePath="/superadmin/support/inbox" isTenant={false} />
        </div>
        <div className={`flex-1 min-w-0 h-full bg-background relative ${!id ? 'hidden sm:flex' : 'flex'}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
