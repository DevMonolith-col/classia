"use client"

import { useState } from "react"
import {
  Puzzle,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  Trash2,
  RefreshCw,
  ExternalLink,
  Star,
  Users,
  Shield,
  Zap,
  BarChart3,
  MessageSquare,
  Calendar,
  CreditCard,
  Video,
  FileText,
  Globe,
  Lock,
  Unlock,
  ChevronDown,
  Upload,
  Package,
  Info,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type PluginStatus = "instalado" | "disponible" | "actualizar"
type PluginCategory = "todos" | "comunicacion" | "evaluacion" | "reportes" | "integraciones" | "seguridad"

interface Plugin {
  id: number
  nombre: string
  descripcion: string
  version: string
  versionDisponible?: string
  autor: string
  estado: PluginStatus
  categoria: PluginCategory
  icon: React.ElementType
  color: string
  instalaciones: number
  rating: number
  precio: "gratis" | number
  activo: boolean
  ultimaActualizacion: string
  requiereConfig: boolean
}

const plugins: Plugin[] = [
  {
    id: 1,
    nombre: "Zoom Meeting Integration",
    descripcion: "Integra reuniones de Zoom directamente en las clases virtuales. Permite crear y programar reuniones desde el sistema.",
    version: "2.1.0",
    autor: "Classia Team",
    estado: "instalado",
    categoria: "comunicacion",
    icon: Video,
    color: "bg-blue-500",
    instalaciones: 15420,
    rating: 4.8,
    precio: "gratis",
    activo: true,
    ultimaActualizacion: "15 Feb 2024",
    requiereConfig: true,
  },
  {
    id: 2,
    nombre: "Google Classroom Sync",
    descripcion: "Sincroniza automáticamente tareas, calificaciones y estudiantes con Google Classroom.",
    version: "1.5.2",
    versionDisponible: "1.6.0",
    autor: "EduTech Solutions",
    estado: "actualizar",
    categoria: "integraciones",
    icon: Globe,
    color: "bg-green-500",
    instalaciones: 23100,
    rating: 4.6,
    precio: "gratis",
    activo: true,
    ultimaActualizacion: "10 Ene 2024",
    requiereConfig: true,
  },
  {
    id: 3,
    nombre: "Advanced Reports Pro",
    descripcion: "Genera reportes avanzados con gráficos interactivos, exportación a múltiples formatos y programación automática.",
    version: "3.0.1",
    autor: "Analytics Plus",
    estado: "instalado",
    categoria: "reportes",
    icon: BarChart3,
    color: "bg-purple-500",
    instalaciones: 8750,
    rating: 4.9,
    precio: 49,
    activo: true,
    ultimaActualizacion: "01 Mar 2024",
    requiereConfig: false,
  },
  {
    id: 4,
    nombre: "Quiz Builder",
    descripcion: "Crea cuestionarios interactivos con múltiples tipos de preguntas, temporizadores y calificación automática.",
    version: "2.3.0",
    autor: "Classia Team",
    estado: "instalado",
    categoria: "evaluacion",
    icon: FileText,
    color: "bg-amber-500",
    instalaciones: 31200,
    rating: 4.7,
    precio: "gratis",
    activo: false,
    ultimaActualizacion: "20 Feb 2024",
    requiereConfig: false,
  },
  {
    id: 5,
    nombre: "SMS Notifications",
    descripcion: "Envía notificaciones por SMS a padres y estudiantes para eventos importantes, faltas y calificaciones.",
    version: "1.2.0",
    autor: "MessageHub",
    estado: "disponible",
    categoria: "comunicacion",
    icon: MessageSquare,
    color: "bg-cyan-500",
    instalaciones: 12300,
    rating: 4.4,
    precio: 29,
    activo: false,
    ultimaActualizacion: "05 Mar 2024",
    requiereConfig: true,
  },
  {
    id: 6,
    nombre: "Payment Gateway",
    descripcion: "Procesa pagos de colegiaturas, eventos y servicios adicionales con múltiples métodos de pago.",
    version: "2.0.0",
    autor: "PaySchool",
    estado: "disponible",
    categoria: "integraciones",
    icon: CreditCard,
    color: "bg-emerald-500",
    instalaciones: 9800,
    rating: 4.5,
    precio: 79,
    activo: false,
    ultimaActualizacion: "28 Feb 2024",
    requiereConfig: true,
  },
  {
    id: 7,
    nombre: "Two-Factor Authentication",
    descripcion: "Añade una capa extra de seguridad con autenticación de dos factores para todos los usuarios.",
    version: "1.1.0",
    autor: "SecureEdu",
    estado: "disponible",
    categoria: "seguridad",
    icon: Shield,
    color: "bg-red-500",
    instalaciones: 18900,
    rating: 4.9,
    precio: "gratis",
    activo: false,
    ultimaActualizacion: "12 Mar 2024",
    requiereConfig: true,
  },
  {
    id: 8,
    nombre: "Calendar Sync",
    descripcion: "Sincroniza el calendario escolar con Google Calendar, Outlook y Apple Calendar.",
    version: "1.4.0",
    autor: "Classia Team",
    estado: "disponible",
    categoria: "integraciones",
    icon: Calendar,
    color: "bg-indigo-500",
    instalaciones: 14500,
    rating: 4.3,
    precio: "gratis",
    activo: false,
    ultimaActualizacion: "08 Mar 2024",
    requiereConfig: true,
  },
  {
    id: 9,
    nombre: "AI Grading Assistant",
    descripcion: "Utiliza inteligencia artificial para ayudar en la calificación de ensayos y respuestas abiertas.",
    version: "1.0.0",
    autor: "EduAI Labs",
    estado: "disponible",
    categoria: "evaluacion",
    icon: Zap,
    color: "bg-violet-500",
    instalaciones: 5200,
    rating: 4.2,
    precio: 99,
    activo: false,
    ultimaActualizacion: "10 Mar 2024",
    requiereConfig: true,
  },
]

const categories = [
  { id: "todos", label: "Todos", icon: Package },
  { id: "comunicacion", label: "Comunicación", icon: MessageSquare },
  { id: "evaluacion", label: "Evaluación", icon: FileText },
  { id: "reportes", label: "Reportes", icon: BarChart3 },
  { id: "integraciones", label: "Integraciones", icon: Globe },
  { id: "seguridad", label: "Seguridad", icon: Shield },
]

export default function AdminPluginsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory>("todos")
  const [filterStatus, setFilterStatus] = useState<"todos" | "instalado" | "disponible">("todos")

  const filteredPlugins = plugins.filter((plugin) => {
    const matchesSearch =
      plugin.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.descripcion.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === "todos" || plugin.categoria === selectedCategory
    const matchesStatus =
      filterStatus === "todos" ||
      (filterStatus === "instalado" && (plugin.estado === "instalado" || plugin.estado === "actualizar")) ||
      (filterStatus === "disponible" && plugin.estado === "disponible")
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  const installedPlugins = plugins.filter((p) => p.estado === "instalado" || p.estado === "actualizar")
  const activePlugins = plugins.filter((p) => p.activo)
  const updatesAvailable = plugins.filter((p) => p.estado === "actualizar")

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Plugins y Extensiones
          </h1>
          <p className="mt-1 text-muted-foreground">
            Amplía las funcionalidades de tu sistema escolar
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Subir Plugin
          </Button>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Buscar Actualizaciones
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                <Puzzle className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{installedPlugins.length}</p>
                <p className="text-sm text-muted-foreground">Instalados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activePlugins.length}</p>
                <p className="text-sm text-muted-foreground">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{updatesAvailable.length}</p>
                <p className="text-sm text-muted-foreground">Actualizaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{plugins.length - installedPlugins.length}</p>
                <p className="text-sm text-muted-foreground">Disponibles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Updates Banner */}
      {updatesAvailable.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-foreground">
                  {updatesAvailable.length} actualización{updatesAvailable.length > 1 ? "es" : ""} disponible{updatesAvailable.length > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {updatesAvailable.map((p) => p.nombre).join(", ")}
                </p>
              </div>
            </div>
            <Button size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualizar Todo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        {/* Categories */}
        <Card className="lg:w-64">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as PluginCategory)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <cat.icon className="h-4 w-4" />
                  {cat.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search and Filter */}
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex rounded-lg border border-input bg-background p-1">
              {(["todos", "instalado", "disponible"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filterStatus === status
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status === "todos" ? "Todos" : status === "instalado" ? "Instalados" : "Disponibles"}
                </button>
              ))}
            </div>
          </div>

          {/* Plugins Grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredPlugins.map((plugin) => {
              const PluginIcon = plugin.icon

              return (
                <Card key={plugin.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${plugin.color}`}>
                            <PluginIcon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{plugin.nombre}</h3>
                            <p className="text-xs text-muted-foreground">por {plugin.autor}</p>
                          </div>
                        </div>
                        {plugin.estado === "instalado" || plugin.estado === "actualizar" ? (
                          <button
                            className={`rounded-full p-2 ${
                              plugin.activo ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {plugin.activo ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </button>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {plugin.descripcion}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500" />
                          <span>{plugin.rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          <span>{plugin.instalaciones.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>v{plugin.version}</span>
                        </div>
                        {plugin.precio === "gratis" ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Gratis
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            ${plugin.precio}/mes
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border bg-secondary/30 p-3">
                      {plugin.estado === "instalado" ? (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Instalado
                          </span>
                          <div className="flex gap-2">
                            {plugin.requiereConfig && (
                              <Button size="sm" variant="outline" className="h-8 gap-1">
                                <Settings className="h-3 w-3" />
                                Configurar
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-red-600 hover:bg-red-50 hover:text-red-700">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : plugin.estado === "actualizar" ? (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertCircle className="h-3 w-3" />
                            v{plugin.versionDisponible} disponible
                          </span>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8 gap-1">
                              <RefreshCw className="h-3 w-3" />
                              Actualizar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <Button size="sm" variant="outline" className="h-8 gap-1">
                            <Info className="h-3 w-3" />
                            Más Info
                          </Button>
                          <Button size="sm" className="h-8 gap-1">
                            <Download className="h-3 w-3" />
                            {plugin.precio === "gratis" ? "Instalar" : "Comprar"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredPlugins.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Puzzle className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium text-foreground">No se encontraron plugins</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Intenta con otros filtros o busca en el marketplace
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Developer Section */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <h3 className="font-semibold text-foreground">Desarrolla tu propio Plugin</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Crea extensiones personalizadas para tu institución o compártelas con la comunidad
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Documentación
              </Button>
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Developer Portal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
