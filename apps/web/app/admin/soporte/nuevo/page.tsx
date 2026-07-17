"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"

export default function CreateTicketPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  const [formData, setFormData] = useState({
    title: "",
    category: "BUG",
    priority: "MEDIUM",
    description: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    try {
      const res = await apiFetch("/support/tickets", {
        method: "POST",
        body: JSON.stringify(formData)
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || "Error al crear el ticket")
      }
      
      router.push("/admin/soporte")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/admin/soporte">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volver a Soporte</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Crear Ticket de Soporte</h1>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Detalles del Ticket</CardTitle>
          <CardDescription>Esta información será enviada al equipo técnico de la plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                {error}
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="title">Asunto</Label>
              <Input 
                id="title" 
                placeholder="Ej. Problema al generar boletines" 
                required 
                minLength={5}
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label htmlFor="category">Categoría</Label>
                <select 
                  id="category"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="BUG">Error en el sistema</option>
                  <option value="BILLING">Facturación / Pagos</option>
                  <option value="FEATURE">Nueva Funcionalidad</option>
                  <option value="HELP">Duda / Ayuda</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Prioridad Estimada</Label>
                <select 
                  id="priority"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.priority}
                  onChange={e => setFormData({...formData, priority: e.target.value})}
                >
                  <option value="LOW">Baja (Sin prisa)</option>
                  <option value="MEDIUM">Media (Normal)</option>
                  <option value="HIGH">Alta (Bloquea algo importante)</option>
                  <option value="CRITICAL">Crítica (Sistema caído / Bloqueo total)</option>
                </select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción Detallada</Label>
              <Textarea 
                id="description" 
                placeholder="Por favor describe los pasos para reproducir el problema o los detalles de tu solicitud..." 
                className="min-h-[150px]"
                required 
                minLength={10}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            
            <div className="flex justify-end pt-4 border-t border-border gap-4">
              <Button type="button" variant="ghost" asChild>
                <Link href="/admin/soporte">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                <Save className="h-4 w-4" />
                {loading ? "Creando..." : "Crear Ticket"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
  )
}
