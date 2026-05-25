"use client"

import { useState } from "react"
import {
  User,
  Bell,
  Shield,
  Globe,
  HelpCircle,
  ChevronRight,
  Moon,
  Sun,
  Smartphone,
  Mail,
  Eye,
  EyeOff,
  Camera,
  LogOut,
  GraduationCap,
  Users,
  CreditCard,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function FamiliaAjustesPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    newGrades: true,
    newTasks: true,
    attendance: true,
    messages: true,
    events: false,
  })

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Ajustes</h1>
            <p className="mt-1 text-muted-foreground">
              Administra tu cuenta y preferencias familiares
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
                  <CardTitle>Información del Apoderado</CardTitle>
                  <CardDescription>Actualiza tu información de contacto</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                          FG
                        </AvatarFallback>
                      </Avatar>
                      <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-center sm:text-left">
                      <h3 className="text-lg font-semibold text-foreground">Familia García</h3>
                      <p className="text-sm text-muted-foreground">2 estudiantes registrados</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Cambiar foto
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Nombre del apoderado</label>
                      <Input defaultValue="Roberto García" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Parentesco</label>
                      <Input defaultValue="Padre" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Correo electrónico</label>
                      <Input type="email" defaultValue="rgarcia@gmail.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Teléfono</label>
                      <Input type="tel" defaultValue="+51 999 888 777" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium text-foreground">Dirección</label>
                      <Input defaultValue="Av. Los Olivos 456, Lima" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button>Guardar cambios</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mis Hijos</CardTitle>
                  <CardDescription>Estudiantes registrados en tu cuenta</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-blue-500/10 text-blue-500">
                          MG
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">María García</p>
                        <p className="text-sm text-muted-foreground">5to Grado A</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Ver perfil
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-green-500/10 text-green-500">
                          PG
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">Pedro García</p>
                        <p className="text-sm text-muted-foreground">3er Grado B</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Ver perfil
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                      <CreditCard className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Estado de Pagos</p>
                      <p className="text-sm text-green-500">Al día</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                      <FileText className="h-6 w-6 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Documentos</p>
                      <p className="text-sm text-muted-foreground">3 disponibles</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </div>
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
                      <p className="font-medium text-foreground">Nuevas calificaciones</p>
                      <p className="text-sm text-muted-foreground">Cuando se registren notas nuevas</p>
                    </div>
                    <Switch
                      checked={notifications.newGrades}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, newGrades: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-foreground">Tareas pendientes</p>
                      <p className="text-sm text-muted-foreground">Recordatorios de tareas próximas</p>
                    </div>
                    <Switch
                      checked={notifications.newTasks}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, newTasks: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-foreground">Asistencia</p>
                      <p className="text-sm text-muted-foreground">Notificar ausencias o tardanzas</p>
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
                      <p className="font-medium text-foreground">Mensajes de profesores</p>
                      <p className="text-sm text-muted-foreground">Cuando un profesor te escriba</p>
                    </div>
                    <Switch
                      checked={notifications.messages}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, messages: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-foreground">Eventos del colegio</p>
                      <p className="text-sm text-muted-foreground">Actividades y reuniones</p>
                    </div>
                    <Switch
                      checked={notifications.events}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, events: checked })
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
                  <CardTitle>Apoderados autorizados</CardTitle>
                  <CardDescription>Personas con acceso a la cuenta</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          RG
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">Roberto García</p>
                        <p className="text-sm text-muted-foreground">Padre • Titular</p>
                      </div>
                    </div>
                    <span className="text-sm text-green-500">Activo</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          LM
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">Laura Martínez</p>
                        <p className="text-sm text-muted-foreground">Madre • Secundario</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      Eliminar
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full">
                    <Users className="mr-2 h-4 w-4" />
                    Agregar apoderado
                  </Button>
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
