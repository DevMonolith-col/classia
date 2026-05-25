"use client"

import { useState } from "react"
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  HelpCircle,
  ChevronRight,
  Moon,
  Sun,
  Smartphone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Camera,
  LogOut,
  Building,
  Users,
  GraduationCap,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminConfiguracionPage() {
  const [darkMode, setDarkMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    newStudent: true,
    newMessage: true,
    attendance: true,
    reports: false,
  })

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Configuración</h1>
            <p className="mt-1 text-muted-foreground">
              Administra la configuración del sistema y tu cuenta
            </p>
          </div>

          <Tabs defaultValue="perfil" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
              <TabsTrigger value="perfil">Perfil</TabsTrigger>
              <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
              <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
              <TabsTrigger value="institucion">Institución</TabsTrigger>
              <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
            </TabsList>

            {/* Perfil Tab */}
            <TabsContent value="perfil" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>Actualiza tu información de perfil</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                          AD
                        </AvatarFallback>
                      </Avatar>
                      <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-center sm:text-left">
                      <h3 className="text-lg font-semibold text-foreground">Admin Principal</h3>
                      <p className="text-sm text-muted-foreground">Administrador del Sistema</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Cambiar foto
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Nombre</label>
                      <Input defaultValue="Admin" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Apellido</label>
                      <Input defaultValue="Principal" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Correo electrónico</label>
                      <Input type="email" defaultValue="admin@colegio.edu" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Teléfono</label>
                      <Input type="tel" defaultValue="+51 999 888 777" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button>Guardar cambios</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notificaciones Tab */}
            <TabsContent value="notificaciones" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Canales de Notificación</CardTitle>
                  <CardDescription>Elige cómo quieres recibir las notificaciones</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Mail className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Correo electrónico</p>
                        <p className="text-sm text-muted-foreground">Recibe notificaciones por email</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, email: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Smartphone className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Notificaciones push</p>
                        <p className="text-sm text-muted-foreground">Recibe alertas en tiempo real</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.push}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, push: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Bell className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">SMS</p>
                        <p className="text-sm text-muted-foreground">Recibe mensajes de texto</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.sms}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, sms: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tipos de Notificación</CardTitle>
                  <CardDescription>Selecciona qué eventos quieres que te notifiquemos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-foreground">Nuevos estudiantes</p>
                      <p className="text-sm text-muted-foreground">Cuando se registre un nuevo estudiante</p>
                    </div>
                    <Switch
                      checked={notifications.newStudent}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, newStudent: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-foreground">Nuevos mensajes</p>
                      <p className="text-sm text-muted-foreground">Cuando recibas un mensaje nuevo</p>
                    </div>
                    <Switch
                      checked={notifications.newMessage}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, newMessage: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-foreground">Reportes de asistencia</p>
                      <p className="text-sm text-muted-foreground">Resumen diario de asistencia</p>
                    </div>
                    <Switch
                      checked={notifications.attendance}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, attendance: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-foreground">Reportes semanales</p>
                      <p className="text-sm text-muted-foreground">Resumen semanal del sistema</p>
                    </div>
                    <Switch
                      checked={notifications.reports}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, reports: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Seguridad Tab */}
            <TabsContent value="seguridad" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cambiar Contraseña</CardTitle>
                  <CardDescription>Asegúrate de usar una contraseña segura</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Contraseña actual</label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Nueva contraseña</label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Confirmar contraseña</label>
                    <Input type="password" />
                  </div>
                  <Button>Actualizar contraseña</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Autenticación de dos factores</CardTitle>
                  <CardDescription>Añade una capa extra de seguridad a tu cuenta</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Shield className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Verificación en dos pasos</p>
                        <p className="text-sm text-muted-foreground">Usar autenticador o SMS</p>
                      </div>
                    </div>
                    <Button variant="outline">Configurar</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sesiones activas</CardTitle>
                  <CardDescription>Administra tus sesiones en otros dispositivos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                        <Smartphone className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Este dispositivo</p>
                        <p className="text-sm text-muted-foreground">Lima, Perú • Activo ahora</p>
                      </div>
                    </div>
                    <span className="text-sm text-green-500">Actual</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Smartphone className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">iPhone 14</p>
                        <p className="text-sm text-muted-foreground">Lima, Perú • Hace 2 horas</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      Cerrar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Institución Tab */}
            <TabsContent value="institucion" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información de la Institución</CardTitle>
                  <CardDescription>Datos generales del colegio</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary">
                      <Building className="h-10 w-10 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Colegio San Martín</h3>
                      <p className="text-sm text-muted-foreground">Institución Educativa Privada</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Cambiar logo
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Nombre del colegio</label>
                      <Input defaultValue="Colegio San Martín" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">RUC</label>
                      <Input defaultValue="20123456789" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Dirección</label>
                      <Input defaultValue="Av. Principal 123, Lima" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Teléfono</label>
                      <Input defaultValue="+51 1 234 5678" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Año Escolar</CardTitle>
                  <CardDescription>Configuración del periodo académico</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Año actual</label>
                      <Input defaultValue="2024" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Inicio de clases</label>
                      <Input type="date" defaultValue="2024-03-01" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Fin de clases</label>
                      <Input type="date" defaultValue="2024-12-15" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                      <GraduationCap className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">1,248</p>
                      <p className="text-sm text-muted-foreground">Estudiantes</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                      <Users className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">64</p>
                      <p className="text-sm text-muted-foreground">Profesores</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                      <Calendar className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">32</p>
                      <p className="text-sm text-muted-foreground">Cursos</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Apariencia Tab */}
            <TabsContent value="apariencia" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tema</CardTitle>
                  <CardDescription>Personaliza la apariencia del sistema</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <button className="flex flex-col items-center gap-3 rounded-lg border-2 border-primary p-4">
                      <div className="flex h-16 w-full items-center justify-center rounded-lg bg-background shadow-sm">
                        <Sun className="h-8 w-8 text-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Claro</span>
                    </button>
                    <button className="flex flex-col items-center gap-3 rounded-lg border border-border p-4 hover:border-primary/50">
                      <div className="flex h-16 w-full items-center justify-center rounded-lg bg-gray-900 shadow-sm">
                        <Moon className="h-8 w-8 text-white" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Oscuro</span>
                    </button>
                    <button className="flex flex-col items-center gap-3 rounded-lg border border-border p-4 hover:border-primary/50">
                      <div className="flex h-16 w-full items-center justify-center rounded-lg bg-gradient-to-r from-background to-gray-900 shadow-sm">
                        <Smartphone className="h-8 w-8 text-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Sistema</span>
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Idioma</CardTitle>
                  <CardDescription>Selecciona el idioma del sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Globe className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Español (Latinoamérica)</p>
                        <p className="text-sm text-muted-foreground">Idioma actual</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Cambiar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Help & Logout */}
          <div className="mt-8 space-y-4">
            <Card>
              <CardContent className="p-4">
                <button className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <HelpCircle className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Centro de ayuda</p>
                      <p className="text-sm text-muted-foreground">Preguntas frecuentes y soporte</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>

            <Card className="border-destructive/20">
              <CardContent className="p-4">
                <button className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                      <LogOut className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-destructive">Cerrar sesión</p>
                      <p className="text-sm text-muted-foreground">Salir de tu cuenta</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
