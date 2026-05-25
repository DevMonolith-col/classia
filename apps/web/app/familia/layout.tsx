import { FamiliaSidebar } from "@/components/familia/sidebar"

export default function FamiliaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <FamiliaSidebar />
      <div className="lg:pl-64">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
