import { ProfesorSidebar } from "@/components/profesor/sidebar"

export default function ProfesorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <ProfesorSidebar />
      <div className="lg:pl-64">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
