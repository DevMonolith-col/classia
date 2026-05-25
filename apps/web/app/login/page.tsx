"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [userType, setUserType] = useState<"admin" | "profesor" | "familia">("admin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const userTypeLabels = {
    admin: { label: "Administrador", redirect: "/admin" },
    profesor: { label: "Profesor", redirect: "/profesor" },
    familia: { label: "Padre/Estudiante", redirect: "/familia" },
  }

  const demoAccounts = [
    {
      label: "Admin",
      email: "admin@classia.com.co",
      password: "ClassiaDemo2026!",
      type: "admin" as const,
    },
    {
      label: "Profesor",
      email: "lopez@demo.classia.co",
      password: "demo123",
      type: "profesor" as const,
    },
    {
      label: "Familia",
      email: "rosa@demo.classia.co",
      password: "demo123",
      type: "familia" as const,
    },
  ]

  const selectDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setUserType(account.type)
    setEmail(account.email)
    setPassword(account.password)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    router.push(userTypeLabels[userType].redirect)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <span className="text-2xl font-bold text-primary-foreground">C</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Classia</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Plataforma de Gestión Escolar
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <h1 className="text-center text-2xl font-bold text-foreground">
              Iniciar Sesión
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              Ingresa tus credenciales para acceder
            </p>
          </CardHeader>
          <CardContent>
            {/* User Type Selector */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-foreground">
                Tipo de Usuario
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(userTypeLabels) as Array<keyof typeof userTypeLabels>).map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setUserType(type)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        userType === type
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {userTypeLabels[type].label}
                    </button>
                  )
                )}
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Correo Electrónico
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">Recordarme</span>
                </label>
                <Link
                  href="/recuperar-password"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full">
                Iniciar Sesión
              </Button>
            </form>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {demoAccounts.map((account) => (
                <Button
                  key={account.type}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => selectDemoAccount(account)}
                >
                  {account.label}
                </Button>
              ))}
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">o continúa con</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Social Login */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>
              <Button variant="outline" className="gap-2">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                </svg>
                Apple
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta?{" "}
          <Link href="/registro" className="font-medium text-primary hover:underline">
            Solicita una demo
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Al iniciar sesión, aceptas nuestros{" "}
          <Link href="#" className="underline hover:text-foreground">
            Términos de Servicio
          </Link>{" "}
          y{" "}
          <Link href="#" className="underline hover:text-foreground">
            Política de Privacidad
          </Link>
        </p>
      </div>
    </div>
  )
}
