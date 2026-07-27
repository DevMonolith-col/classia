"use client"

import { useState, useEffect } from "react"
import {
  Globe2,
  Mail,
  Save,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { apiFetch } from "@/lib/api-client"

export default function SuperAdminSettingsPage() {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [settings, setSettings] = useState({
    baseDomain: "classia.com.co",
    appName: "Classia SaaS",
    force2FA: false,
    strictIpLock: true,
    smtpHost: "smtp.sendgrid.net",
    smtpPort: "587",
    smtpUser: "apikey",
    smtpPass: "",
    smtpFrom: "notificaciones@classia.com.co",
    planBaseMaxStudents: 200,
    planBaseMaxUsers: 20,
    planBaseMaxStorageGb: 5,
    planProMaxStudents: 1000,
    planProMaxUsers: 100,
    planProMaxStorageGb: 50,
  })

  const [smtpTesting, setSmtpTesting] = useState(false)
  const [smtpResult, setSmtpResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiFetch("/settings")
        if (res.ok) {
          const data = await res.json()
          setSettings(prev => ({ ...prev, ...data }))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error("Error al guardar la configuración")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof typeof settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleTestSmtp = async () => {
    setSmtpTesting(true)
    setSmtpResult(null)
    try {
      const res = await apiFetch("/settings/smtp-test", { method: "POST" })
      const data = await res.json()
      setSmtpResult(data)
    } catch {
      setSmtpResult({ ok: false, message: "Sin conexión con el servidor." })
    } finally {
      setSmtpTesting(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando configuración...</div>
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administración Global</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración SaaS</h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto p-1 bg-secondary/50">
            <TabsTrigger value="general" className="py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Globe2 className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="smtp" className="py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Mail className="h-4 w-4 mr-2" />
              SMTP & Correo
            </TabsTrigger>
            <TabsTrigger value="plans" className="py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CreditCard className="h-4 w-4 mr-2" />
              Planes y Límites
            </TabsTrigger>
          </TabsList>

          {/* GENERAL TAB */}
          <TabsContent value="general" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Identidad del Sistema</CardTitle>
                <CardDescription>Configura los dominios globales por defecto para los colegios nuevos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="base-domain">Dominio Base (Wildcard)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground bg-secondary px-3 py-2 rounded-md border text-sm font-mono">*.</span>
                    <Input 
                      id="base-domain" 
                      value={settings.baseDomain}
                      onChange={e => updateSetting("baseDomain", e.target.value)}
                      className="max-w-md" 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Los colegios nuevos se crearán automáticamente bajo este subdominio (ej. colegio.classia.com.co)</p>
                </div>
                <div className="grid gap-2 pt-4">
                  <Label htmlFor="app-name">Nombre de la Aplicación Global</Label>
                  <Input 
                    id="app-name" 
                    value={settings.appName} 
                    onChange={e => updateSetting("appName", e.target.value)}
                    className="max-w-md" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Ajustes de Seguridad Globales</CardTitle>
                <CardDescription>Políticas de seguridad forzadas para todos los colegios de la plataforma.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Forzar Autenticación de Dos Factores (2FA)</Label>
                    <p className="text-sm text-muted-foreground">Exigir 2FA a todos los roles administrativos de los colegios.</p>
                  </div>
                  <Switch 
                    checked={settings.force2FA} 
                    onCheckedChange={v => updateSetting("force2FA", v)} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Bloqueo estricto por IP</Label>
                    <p className="text-sm text-muted-foreground">Permitir a los colegios restringir el acceso a la plataforma solo desde la IP de sus sedes.</p>
                  </div>
                  <Switch 
                    checked={settings.strictIpLock} 
                    onCheckedChange={v => updateSetting("strictIpLock", v)} 
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMTP TAB */}
          <TabsContent value="smtp" className="space-y-6">
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-500" /> Servidor de Correo Saliente
                </CardTitle>
                <CardDescription>
                  El envío real de correo (notificaciones, reseteos de contraseña) usa el proveedor
                  configurado en el servidor (Resend), no estos campos. Se guardan como referencia pero
                  &quot;Probar conexión&quot; valida el proveedor activo del servidor.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="smtp-host">Host SMTP</Label>
                  <Input id="smtp-host" value={settings.smtpHost} onChange={e => updateSetting("smtpHost", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtp-port">Puerto</Label>
                  <Input id="smtp-port" value={settings.smtpPort} onChange={e => updateSetting("smtpPort", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtp-user">Usuario SMTP</Label>
                  <Input id="smtp-user" value={settings.smtpUser} onChange={e => updateSetting("smtpUser", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtp-pass">Contraseña SMTP</Label>
                  <Input id="smtp-pass" type="password" value={settings.smtpPass} onChange={e => updateSetting("smtpPass", e.target.value)} placeholder="Dejar en blanco para mantener" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="smtp-from">Correo remitente por defecto (From)</Label>
                  <Input id="smtp-from" value={settings.smtpFrom} onChange={e => updateSetting("smtpFrom", e.target.value)} />
                </div>
              </CardContent>
              <CardFooter className="bg-secondary/20 flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                {smtpResult ? (
                  <p className={`flex items-center gap-1.5 text-xs ${smtpResult.ok ? "text-emerald-600" : "text-destructive"}`}>
                    {smtpResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {smtpResult.message}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin probar todavía.</p>
                )}
                <Button variant="outline" size="sm" onClick={handleTestSmtp} disabled={smtpTesting} className="gap-2">
                  {smtpTesting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {smtpTesting ? "Probando..." : "Probar conexión"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* PLANES TAB */}
          <TabsContent value="plans" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Límites por Defecto de Planes</CardTitle>
                <CardDescription>Define la capacidad máxima que se asigna automáticamente al provisionar un colegio bajo cada plan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Plan Básico */}
                <div className="grid gap-4 border p-4 rounded-lg bg-secondary/10">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-slate-500" /> Plan Básico
                    </h3>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>Máx. Estudiantes</Label>
                      <Input type="number" value={settings.planBaseMaxStudents} onChange={e => updateSetting("planBaseMaxStudents", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Máx. Usuarios (Staff)</Label>
                      <Input type="number" value={settings.planBaseMaxUsers} onChange={e => updateSetting("planBaseMaxUsers", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Almacenamiento (GB)</Label>
                      <Input type="number" value={settings.planBaseMaxStorageGb} onChange={e => updateSetting("planBaseMaxStorageGb", parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>

                {/* Plan Pro */}
                <div className="grid gap-4 border border-primary/20 p-4 rounded-lg bg-primary/5">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                      <ShieldCheck className="h-5 w-5" /> Plan Pro
                    </h3>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>Máx. Estudiantes</Label>
                      <Input type="number" value={settings.planProMaxStudents} onChange={e => updateSetting("planProMaxStudents", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Máx. Usuarios (Staff)</Label>
                      <Input type="number" value={settings.planProMaxUsers} onChange={e => updateSetting("planProMaxUsers", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Almacenamiento (GB)</Label>
                      <Input type="number" value={settings.planProMaxStorageGb} onChange={e => updateSetting("planProMaxStorageGb", parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
