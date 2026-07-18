"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Paperclip, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS } from "@/components/support/ticket-categories"
import Link from "next/link"

export default function CreateTicketPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  
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
      let attachmentKey
      let attachmentName
      
      if (attachment) {
        const formDataUpload = new FormData()
        formDataUpload.append("file", attachment)
        const uploadRes = await apiFetch("/files", {
          method: "POST",
          body: formDataUpload,
        })
        if (!uploadRes.ok) throw new Error("Error subiendo el archivo adjunto")
        const uploadData = await uploadRes.json()
        attachmentKey = uploadData.key
        attachmentName = attachment.name
      }

      const res = await apiFetch("/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          attachmentKey,
          attachmentName
        })
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
    <div className="flex flex-col h-full w-full bg-background relative">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="sm:hidden shrink-0" asChild>
            <Link href="/admin/soporte"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Volver a Soporte</p>
            <h1 className="text-sm sm:text-base font-bold line-clamp-1">Crear Ticket de Soporte</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 max-w-4xl mx-auto w-full space-y-6">

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
                  {TICKET_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{TICKET_CATEGORY_LABELS[category]}</option>
                  ))}
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
                placeholder="Describe los detalles de tu solicitud.&#10;&#10;Sugerencias si es un error:&#10;- ¿Qué estabas intentando hacer?&#10;- Pasos para reproducirlo&#10;- ¿Estás en PC o Celular? ¿Qué navegador?" 
                className="min-h-[150px]"
                required 
                minLength={10}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Captura de pantalla o Archivo (Opcional)</Label>
              <div className="flex items-center gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="gap-2"
                >
                  <Paperclip className="h-4 w-4" />
                  Adjuntar archivo
                </Button>
                <input 
                  id="file-upload" 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  accept="image/*,.pdf,.doc,.docx"
                />
                {attachment && (
                  <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md text-sm">
                    <span className="truncate max-w-[200px]">{attachment.name}</span>
                    <button type="button" onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Puedes subir imágenes o PDFs que ayuden a entender el problema.</p>
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
