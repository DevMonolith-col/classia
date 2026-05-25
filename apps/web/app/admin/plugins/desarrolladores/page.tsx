"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Code2,
  Terminal,
  FileJson,
  Key,
  Shield,
  Webhook,
  BookOpen,
  Rocket,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Download,
  ExternalLink,
  ChevronRight,
  Users,
  Package,
  GitBranch,
  Zap,
  Server,
  Database,
  Lock,
  Unlock,
  RefreshCw,
  Plus,
  Trash2,
  Settings,
  ArrowLeft,
  Clock,
  TrendingUp,
  Star,
  MessageSquare,
  Bug,
  TestTube,
  Upload,
  FileCode,
  Globe,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type TabType = "overview" | "credentials" | "webhooks" | "sandbox" | "docs" | "submit"

interface ApiKey {
  id: string
  name: string
  key: string
  created: string
  lastUsed: string
  scopes: string[]
  active: boolean
}

interface WebhookConfig {
  id: string
  url: string
  events: string[]
  active: boolean
  secret: string
  lastTriggered: string
  successRate: number
}

const apiKeys: ApiKey[] = [
  {
    id: "1",
    name: "Production Key",
    key: "clss_live_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    created: "2024-01-15",
    lastUsed: "2024-03-10",
    scopes: ["read:students", "read:courses", "write:attendance", "read:grades"],
    active: true,
  },
  {
    id: "2",
    name: "Development Key",
    key: "clss_test_sk_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    created: "2024-02-01",
    lastUsed: "2024-03-09",
    scopes: ["read:students", "read:courses", "write:attendance", "read:grades", "admin:plugins"],
    active: true,
  },
]

const webhooks: WebhookConfig[] = [
  {
    id: "1",
    url: "https://mi-plugin.com/webhooks/attendance",
    events: ["attendance.created", "attendance.updated"],
    active: true,
    secret: "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    lastTriggered: "Hace 2 horas",
    successRate: 98.5,
  },
  {
    id: "2",
    url: "https://mi-plugin.com/webhooks/grades",
    events: ["grade.created", "grade.updated", "grade.deleted"],
    active: false,
    secret: "whsec_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    lastTriggered: "Hace 5 días",
    successRate: 95.2,
  },
]

const availableScopes = [
  { id: "read:students", name: "Leer Estudiantes", description: "Acceso de lectura a información de estudiantes" },
  { id: "write:students", name: "Escribir Estudiantes", description: "Crear y modificar estudiantes" },
  { id: "read:courses", name: "Leer Cursos", description: "Acceso de lectura a cursos y asignaturas" },
  { id: "write:courses", name: "Escribir Cursos", description: "Crear y modificar cursos" },
  { id: "read:attendance", name: "Leer Asistencia", description: "Acceso a registros de asistencia" },
  { id: "write:attendance", name: "Escribir Asistencia", description: "Registrar y modificar asistencia" },
  { id: "read:grades", name: "Leer Calificaciones", description: "Acceso a calificaciones" },
  { id: "write:grades", name: "Escribir Calificaciones", description: "Registrar y modificar calificaciones" },
  { id: "admin:plugins", name: "Admin Plugins", description: "Gestionar configuración de plugins" },
]

const webhookEvents = [
  { id: "student.created", name: "Estudiante Creado" },
  { id: "student.updated", name: "Estudiante Actualizado" },
  { id: "student.deleted", name: "Estudiante Eliminado" },
  { id: "attendance.created", name: "Asistencia Registrada" },
  { id: "attendance.updated", name: "Asistencia Actualizada" },
  { id: "grade.created", name: "Calificación Creada" },
  { id: "grade.updated", name: "Calificación Actualizada" },
  { id: "grade.deleted", name: "Calificación Eliminada" },
  { id: "course.started", name: "Curso Iniciado" },
  { id: "course.ended", name: "Curso Finalizado" },
]

export default function DeveloperPortalPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  
  // Form states
  const [pluginName, setPluginName] = useState("")
  const [pluginDescription, setPluginDescription] = useState("")
  const [pluginCategory, setPluginCategory] = useState("")
  const [pluginVersion, setPluginVersion] = useState("")
  const [repoUrl, setRepoUrl] = useState("")

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyId)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  const tabs = [
    { id: "overview", label: "Inicio", icon: Rocket },
    { id: "credentials", label: "Credenciales", icon: Key },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "sandbox", label: "Sandbox", icon: TestTube },
    { id: "docs", label: "Documentación", icon: BookOpen },
    { id: "submit", label: "Publicar Plugin", icon: Upload },
  ]

  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/admin/plugins" 
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Plugins
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                Portal de Desarrolladores
              </h1>
              <p className="mt-1 text-muted-foreground">
                Crea, prueba y publica plugins para la comunidad educativa
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Soporte
              </Button>
              <Button className="gap-2">
                <Code2 className="h-4 w-4" />
                Consola API
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted p-1">
          {tabs.map((tab) => {
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                      <Key className="h-6 w-6 text-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{apiKeys.length}</p>
                      <p className="text-sm text-muted-foreground">API Keys</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">12.5K</p>
                      <p className="text-sm text-muted-foreground">Requests/día</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Webhook className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{webhooks.length}</p>
                      <p className="text-sm text-muted-foreground">Webhooks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                      <Package className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">3</p>
                      <p className="text-sm text-muted-foreground">Plugins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Start Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Guía de Inicio Rápido
                </CardTitle>
                <CardDescription>
                  Sigue estos pasos para crear tu primer plugin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-4">
                  {[
                    { step: 1, title: "Crea tu API Key", description: "Genera credenciales para autenticarte con nuestra API", icon: Key, action: "credentials" },
                    { step: 2, title: "Configura Webhooks", description: "Suscríbete a eventos para recibir notificaciones en tiempo real", icon: Webhook, action: "webhooks" },
                    { step: 3, title: "Prueba en Sandbox", description: "Usa nuestro entorno de pruebas antes de ir a producción", icon: TestTube, action: "sandbox" },
                    { step: 4, title: "Publica tu Plugin", description: "Envía tu plugin para revisión y publicación", icon: Upload, action: "submit" },
                  ].map((item) => {
                    const StepIcon = item.icon
                    return (
                      <button
                        key={item.step}
                        onClick={() => setActiveTab(item.action as TabType)}
                        className="flex flex-col items-start rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-secondary/50"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                            {item.step}
                          </div>
                          <StepIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Technologies & Standards */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Seguridad y Autenticación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "OAuth 2.0", description: "Autorización segura con tokens de acceso", status: "Soportado" },
                    { name: "API Keys", description: "Autenticación simple para server-to-server", status: "Soportado" },
                    { name: "JWT Tokens", description: "Tokens firmados con expiración automática", status: "Soportado" },
                    { name: "Webhook Signatures", description: "HMAC-SHA256 para verificar webhooks", status: "Soportado" },
                    { name: "Rate Limiting", description: "10,000 requests/hora por API Key", status: "Activo" },
                  ].map((tech, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="font-medium text-foreground">{tech.name}</p>
                        <p className="text-sm text-muted-foreground">{tech.description}</p>
                      </div>
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        {tech.status}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-5 w-5" />
                    SDK y Herramientas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "JavaScript/TypeScript SDK", version: "v2.3.0", downloads: "15.2K", icon: FileCode },
                    { name: "Python SDK", version: "v1.8.0", downloads: "8.7K", icon: Terminal },
                    { name: "PHP SDK", version: "v1.5.0", downloads: "4.2K", icon: FileJson },
                    { name: "CLI Tools", version: "v1.2.0", downloads: "2.1K", icon: Terminal },
                  ].map((sdk, index) => {
                    const SdkIcon = sdk.icon
                    return (
                      <div key={index} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                            <SdkIcon className="h-5 w-5 text-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{sdk.name}</p>
                            <p className="text-sm text-muted-foreground">{sdk.version} - {sdk.downloads} descargas</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Download className="h-3 w-3" />
                          Descargar
                        </Button>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            {/* API Endpoints Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Endpoints Principales
                </CardTitle>
                <CardDescription>
                  Base URL: <code className="rounded bg-muted px-2 py-1 font-mono text-sm">https://api.classia.edu/v1</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { method: "GET", path: "/students", description: "Lista todos los estudiantes" },
                    { method: "GET", path: "/courses", description: "Lista todos los cursos" },
                    { method: "POST", path: "/attendance", description: "Registra asistencia" },
                    { method: "GET", path: "/grades/{studentId}", description: "Obtiene calificaciones de un estudiante" },
                    { method: "POST", path: "/webhooks", description: "Configura webhooks" },
                    { method: "GET", path: "/reports/export", description: "Exporta reportes" },
                  ].map((endpoint, index) => (
                    <div key={index} className="flex items-center gap-4 rounded-lg border border-border p-3">
                      <span className={`rounded px-2 py-1 text-xs font-bold ${
                        endpoint.method === "GET" ? "bg-blue-100 text-blue-700" :
                        endpoint.method === "POST" ? "bg-green-100 text-green-700" :
                        endpoint.method === "PUT" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="font-mono text-sm text-foreground">{endpoint.path}</code>
                      <span className="text-sm text-muted-foreground">{endpoint.description}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => setActiveTab("docs")}>
                  <BookOpen className="h-4 w-4" />
                  Ver Documentación Completa
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Credentials Tab */}
        {activeTab === "credentials" && (
          <div className="space-y-6">
            {/* Existing API Keys */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Gestiona tus claves de API para autenticación</CardDescription>
                </div>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva API Key
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          apiKey.name.includes("Production") ? "bg-green-100" : "bg-blue-100"
                        }`}>
                          <Key className={`h-5 w-5 ${
                            apiKey.name.includes("Production") ? "text-green-600" : "text-blue-600"
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{apiKey.name}</p>
                            {apiKey.active ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Activa</span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Inactiva</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Creada: {apiKey.created} | Último uso: {apiKey.lastUsed}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1">
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted p-3">
                      <code className="flex-1 font-mono text-sm">
                        {showKey[apiKey.id] ? apiKey.key : apiKey.key.replace(/./g, "*").slice(0, 40) + "..."}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowKey((prev) => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                      >
                        {showKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                      >
                        {copiedKey === apiKey.id ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="mt-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Permisos</p>
                      <div className="flex flex-wrap gap-1">
                        {apiKey.scopes.map((scope) => (
                          <span key={scope} className="rounded bg-secondary px-2 py-1 text-xs text-foreground">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Create New API Key */}
            <Card>
              <CardHeader>
                <CardTitle>Crear Nueva API Key</CardTitle>
                <CardDescription>Selecciona los permisos necesarios para tu aplicación</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Nombre de la Key</Label>
                  <Input id="keyName" placeholder="ej: Mi Plugin de Asistencia" />
                </div>
                
                <div className="space-y-2">
                  <Label>Permisos (Scopes)</Label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {availableScopes.map((scope) => (
                      <button
                        key={scope.id}
                        onClick={() => toggleScope(scope.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          selectedScopes.includes(scope.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${
                          selectedScopes.includes(scope.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        }`}>
                          {selectedScopes.includes(scope.id) && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{scope.name}</p>
                          <p className="text-xs text-muted-foreground">{scope.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="gap-2">
                    <Key className="h-4 w-4" />
                    Generar API Key
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* OAuth Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Configuración OAuth 2.0
                </CardTitle>
                <CardDescription>Para aplicaciones que requieren autenticación de usuarios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <div className="flex gap-2">
                      <Input value="clss_oauth_cid_abc123def456" readOnly className="font-mono" />
                      <Button size="icon" variant="outline">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <div className="flex gap-2">
                      <Input type="password" value="clss_oauth_sec_xxxxxxxxxx" readOnly className="font-mono" />
                      <Button size="icon" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Redirect URIs</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value="https://mi-plugin.com/callback" readOnly />
                      <Button size="icon" variant="outline" className="text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Agregar nueva URI..." />
                      <Button size="icon" variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === "webhooks" && (
          <div className="space-y-6">
            {/* Existing Webhooks */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Webhooks Configurados</CardTitle>
                  <CardDescription>Recibe notificaciones en tiempo real sobre eventos</CardDescription>
                </div>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Webhook
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          webhook.active ? "bg-green-100" : "bg-gray-100"
                        }`}>
                          <Webhook className={`h-5 w-5 ${webhook.active ? "text-green-600" : "text-gray-400"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-medium text-foreground">{webhook.url}</code>
                            {webhook.active ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Activo</span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Inactivo</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Último trigger: {webhook.lastTriggered} | Éxito: {webhook.successRate}%
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1">
                          <TestTube className="h-3 w-3" />
                          Test
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Eventos suscritos</p>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <span key={event} className="rounded bg-secondary px-2 py-1 text-xs text-foreground">
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted p-2">
                      <code className="flex-1 font-mono text-xs text-muted-foreground">
                        Secret: {webhook.secret.slice(0, 20)}...
                      </code>
                      <Button size="sm" variant="ghost">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Create New Webhook */}
            <Card>
              <CardHeader>
                <CardTitle>Configurar Nuevo Webhook</CardTitle>
                <CardDescription>Selecciona los eventos que deseas recibir</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">URL del Endpoint</Label>
                  <Input id="webhookUrl" placeholder="https://tu-servidor.com/webhooks/classia" />
                </div>
                
                <div className="space-y-2">
                  <Label>Eventos a Suscribir</Label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {webhookEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => toggleEvent(event.id)}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                          selectedEvents.includes(event.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                          selectedEvents.includes(event.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        }`}>
                          {selectedEvents.includes(event.id) && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <span className="text-sm text-foreground">{event.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="gap-2">
                    <Webhook className="h-4 w-4" />
                    Crear Webhook
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Webhook Signature Verification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Verificación de Firmas
                </CardTitle>
                <CardDescription>Cómo verificar que los webhooks provienen de Classia</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4">
                  <pre className="overflow-x-auto text-sm text-foreground">
{`// Node.js example
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from('sha256=' + expected)
  );
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sandbox Tab */}
        {activeTab === "sandbox" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Entorno de Pruebas
                </CardTitle>
                <CardDescription>
                  Prueba tu integración sin afectar datos reales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
                    <p className="font-medium text-green-700">Sandbox Activo</p>
                    <p className="text-sm text-green-600">Datos de prueba disponibles</p>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-center">
                    <Database className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium text-foreground">100 Estudiantes</p>
                    <p className="text-sm text-muted-foreground">Datos simulados</p>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-center">
                    <Server className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium text-foreground">10 Cursos</p>
                    <p className="text-sm text-muted-foreground">Con calificaciones</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="mb-2 text-sm font-medium text-foreground">URL Base Sandbox</p>
                    <div className="flex gap-2">
                      <code className="flex-1 rounded border border-border bg-background p-2 font-mono text-sm">
                        https://sandbox-api.classia.edu/v1
                      </code>
                      <Button size="sm" variant="outline">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <RefreshCw className="h-6 w-6" />
                      <span className="font-medium">Resetear Datos</span>
                      <span className="text-xs text-muted-foreground">Restaurar datos de prueba</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <Download className="h-6 w-6" />
                      <span className="font-medium">Exportar Logs</span>
                      <span className="text-xs text-muted-foreground">Descargar historial de requests</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Console */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Consola de API
                </CardTitle>
                <CardDescription>Prueba endpoints directamente desde el navegador</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <select className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
                      <option>GET</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>DELETE</option>
                    </select>
                    <Input placeholder="/students" className="flex-1 font-mono" />
                    <Button>Ejecutar</Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Headers</Label>
                    <Textarea
                      className="font-mono text-sm"
                      rows={3}
                      defaultValue={`Authorization: Bearer clss_test_sk_xxxx\nContent-Type: application/json`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Body (JSON)</Label>
                    <Textarea
                      className="font-mono text-sm"
                      rows={4}
                      placeholder='{ "key": "value" }'
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Respuesta</Label>
                    <div className="rounded-lg bg-muted p-4">
                      <pre className="overflow-x-auto text-sm text-muted-foreground">
{`{
  "data": [
    {
      "id": "std_001",
      "name": "Ana García López",
      "grade": "5to A",
      "status": "active"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Documentation Tab */}
        {activeTab === "docs" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-4">
              {/* Sidebar */}
              <Card className="lg:col-span-1">
                <CardContent className="p-4">
                  <nav className="space-y-1">
                    {[
                      { name: "Introducción", active: true },
                      { name: "Autenticación", active: false },
                      { name: "Rate Limiting", active: false },
                      { name: "Errores", active: false },
                      { name: "Estudiantes", active: false },
                      { name: "Cursos", active: false },
                      { name: "Asistencia", active: false },
                      { name: "Calificaciones", active: false },
                      { name: "Webhooks", active: false },
                      { name: "SDKs", active: false },
                    ].map((item, index) => (
                      <button
                        key={index}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                          item.active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {item.name}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ))}
                  </nav>
                </CardContent>
              </Card>

              {/* Content */}
              <div className="space-y-6 lg:col-span-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Introducción a la API de Classia</CardTitle>
                    <CardDescription>Versión 1.0 | Última actualización: Marzo 2024</CardDescription>
                  </CardHeader>
                  <CardContent className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground">
                      La API de Classia te permite integrar funcionalidades del sistema escolar en tus propias aplicaciones.
                      Utiliza autenticación basada en API Keys o OAuth 2.0 para acceder a los endpoints.
                    </p>

                    <h3 className="mt-6 text-lg font-semibold text-foreground">URL Base</h3>
                    <div className="rounded-lg bg-muted p-3">
                      <code className="text-sm">https://api.classia.edu/v1</code>
                    </div>

                    <h3 className="mt-6 text-lg font-semibold text-foreground">Autenticación</h3>
                    <p className="text-muted-foreground">
                      Todas las peticiones deben incluir el header de autorización:
                    </p>
                    <div className="rounded-lg bg-muted p-3">
                      <code className="text-sm">Authorization: Bearer tu_api_key</code>
                    </div>

                    <h3 className="mt-6 text-lg font-semibold text-foreground">Ejemplo de Request</h3>
                    <div className="rounded-lg bg-muted p-4">
                      <pre className="overflow-x-auto text-sm">
{`curl -X GET "https://api.classia.edu/v1/students" \\
  -H "Authorization: Bearer clss_live_sk_xxxx" \\
  -H "Content-Type: application/json"`}
                      </pre>
                    </div>

                    <h3 className="mt-6 text-lg font-semibold text-foreground">Respuesta</h3>
                    <div className="rounded-lg bg-muted p-4">
                      <pre className="overflow-x-auto text-sm">
{`{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "per_page": 20,
    "total_pages": 5
  }
}`}
                      </pre>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Códigos de Error</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        { code: 200, name: "OK", description: "Petición exitosa" },
                        { code: 201, name: "Created", description: "Recurso creado exitosamente" },
                        { code: 400, name: "Bad Request", description: "Parámetros inválidos" },
                        { code: 401, name: "Unauthorized", description: "API Key inválida o faltante" },
                        { code: 403, name: "Forbidden", description: "Sin permisos para este recurso" },
                        { code: 404, name: "Not Found", description: "Recurso no encontrado" },
                        { code: 429, name: "Too Many Requests", description: "Rate limit excedido" },
                        { code: 500, name: "Server Error", description: "Error interno del servidor" },
                      ].map((error) => (
                        <div key={error.code} className="flex items-center gap-4 rounded-lg border border-border p-3">
                          <span className={`rounded px-2 py-1 text-xs font-bold ${
                            error.code < 300 ? "bg-green-100 text-green-700" :
                            error.code < 500 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {error.code}
                          </span>
                          <span className="font-medium text-foreground">{error.name}</span>
                          <span className="text-sm text-muted-foreground">{error.description}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Submit Plugin Tab */}
        {activeTab === "submit" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Publicar Plugin en el Marketplace
                </CardTitle>
                <CardDescription>
                  Comparte tu plugin con la comunidad educativa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Guidelines */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Antes de enviar tu plugin</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-amber-700">
                        <li>Asegúrate de que funciona correctamente en el Sandbox</li>
                        <li>Incluye documentación clara de instalación y uso</li>
                        <li>Tu código debe seguir nuestras guías de seguridad</li>
                        <li>El proceso de revisión toma 3-5 días hábiles</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground">Información Básica</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="pluginName">Nombre del Plugin *</Label>
                      <Input
                        id="pluginName"
                        placeholder="ej: Asistencia QR Scanner"
                        value={pluginName}
                        onChange={(e) => setPluginName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pluginDescription">Descripción *</Label>
                      <Textarea
                        id="pluginDescription"
                        placeholder="Describe qué hace tu plugin y sus principales características..."
                        rows={4}
                        value={pluginDescription}
                        onChange={(e) => setPluginDescription(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pluginCategory">Categoría *</Label>
                        <select
                          id="pluginCategory"
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          value={pluginCategory}
                          onChange={(e) => setPluginCategory(e.target.value)}
                        >
                          <option value="">Seleccionar...</option>
                          <option value="comunicacion">Comunicación</option>
                          <option value="evaluacion">Evaluación</option>
                          <option value="reportes">Reportes</option>
                          <option value="integraciones">Integraciones</option>
                          <option value="seguridad">Seguridad</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pluginVersion">Versión *</Label>
                        <Input
                          id="pluginVersion"
                          placeholder="1.0.0"
                          value={pluginVersion}
                          onChange={(e) => setPluginVersion(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="repoUrl">URL del Repositorio</Label>
                      <Input
                        id="repoUrl"
                        placeholder="https://github.com/tu-usuario/tu-plugin"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Technical Info */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground">Información Técnica</h3>
                    
                    <div className="space-y-2">
                      <Label>Archivos del Plugin *</Label>
                      <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                        <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Arrastra tu archivo .zip o haz clic para seleccionar
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Máximo 50MB - Incluye manifest.json
                        </p>
                        <Button variant="outline" size="sm" className="mt-3">
                          Seleccionar Archivo
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Capturas de Pantalla</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-border"
                          >
                            <Plus className="h-6 w-6 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Permisos Requeridos</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {availableScopes.slice(0, 6).map((scope) => (
                          <label key={scope.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="rounded border-input" />
                            <span>{scope.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Precio</h3>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="pricing" value="free" defaultChecked className="text-primary" />
                      <span className="text-sm font-medium">Gratis</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="pricing" value="paid" className="text-primary" />
                      <span className="text-sm font-medium">De Pago</span>
                    </label>
                  </div>
                </div>

                {/* Terms */}
                <div className="rounded-lg border border-border p-4">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 rounded border-input" />
                    <span className="text-sm text-muted-foreground">
                      Acepto los{" "}
                      <a href="#" className="text-foreground underline">Términos del Desarrollador</a>,
                      la{" "}
                      <a href="#" className="text-foreground underline">Política de Privacidad</a> y
                      las{" "}
                      <a href="#" className="text-foreground underline">Guías de la Comunidad</a>.
                      Confirmo que mi plugin no contiene código malicioso y cumple con los estándares de seguridad.
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline">Guardar Borrador</Button>
                  <Button className="gap-2">
                    <Rocket className="h-4 w-4" />
                    Enviar para Revisión
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* My Plugins */}
            <Card>
              <CardHeader>
                <CardTitle>Mis Plugins Enviados</CardTitle>
                <CardDescription>Estado de tus plugins en revisión o publicados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "QR Attendance Scanner", version: "1.2.0", status: "published", downloads: 1250, rating: 4.7 },
                    { name: "Parent Notification Plus", version: "1.0.0", status: "review", downloads: 0, rating: 0 },
                    { name: "Grade Analytics", version: "0.9.0", status: "draft", downloads: 0, rating: 0 },
                  ].map((plugin, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                          <Package className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{plugin.name}</p>
                          <p className="text-sm text-muted-foreground">v{plugin.version}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {plugin.status === "published" && (
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Download className="h-4 w-4" />
                              {plugin.downloads}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-amber-500" />
                              {plugin.rating}
                            </span>
                          </div>
                        )}
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          plugin.status === "published" ? "bg-green-100 text-green-700" :
                          plugin.status === "review" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {plugin.status === "published" ? "Publicado" :
                           plugin.status === "review" ? "En Revisión" : "Borrador"}
                        </span>
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
