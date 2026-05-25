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
  BookOpen,
  Clock,
  GraduationCap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ProfesorConfiguracionPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    newMessage: true,
    newTask: true,
    attendance: false,
    grades: true,
  })

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Configuración</h1>
            <p className="mt-1 text-muted-foreground">
              Administra tu cuenta y preferencias
            </p>
          </div>

          <Tabs defaultValue="perfil" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
              <TabsTrigger value="perfil">Perfil</TabsTrigger>
              <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
              <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
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
                          JL
                        </AvatarFallback>
                      </Avatar>
                      <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-center sm:text-left">
                      <h3 className="text-lg font-semibold text-foreground">Prof. Juan López</h3>
                      <p className="text-sm text-muted-foreground">Profesor de Matemáticas</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Cambiar foto
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Nombre</label>
                      <Input defaultValue="Juan" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Apellido</label>
                      <Input defaultValue="López" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Correo electrónico</label>
                      <Input type="email" defaultValue="jlopez@colegio.edu" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Teléfono</label>
                      <Input type="tel" defaultValue="+51 987 654 321" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button>Guardar cambios</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Información Académica</CardTitle>
                  <CardDescription>Datos sobre tus clases y especialidad</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                        <BookOpen className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Especialidad</p>
                        <p className="font-medium text-foreground">Matemáticas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                        <GraduationCap className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Clases asignadas</p>
                        <p className="font-medium text-foreground">3 cursos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                        <Clock className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Horas semanales</p>
                        <p className="font-medium text-foreground">18 horas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                        <User className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Estudiantes</p>
                        <p className="font-medium text-foreground">90 estudiantes</p>
                      </div>
                    </div>
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
                      <p className="font-medium text-foreground">Nuevos mensajes</p>
                      <p className="text-sm text-muted-foreground">De padres o administración</p>
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
                      <p className="font-medium text-foreground">Entregas de tareas</p>
                      <p className="text-sm text-muted-foreground">Cuando un estudiante entregue una tarea</p>
                    </div>
                    <Switch
                      checked={notifications.newTask}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, newTask: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-foreground">Recordatorios de asistencia</p>
                      <p className="text-sm text-muted-foreground">Recordatorio diario para pasar asistencia</p>
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
                      <p className="font-medium text-foreground">Fechas de calificaciones</p>
                      <p className="text-sm text-muted-foreground">Recordatorio de fechas límite</p>
                    </div>
                    <Switch
                      checked={notifications.grades}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, grades: checked })
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
