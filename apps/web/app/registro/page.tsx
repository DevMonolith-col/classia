"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff, Building2, Users, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

const plans = [
  {
    id: "basico",
    name: "Básico",
    price: "$299",
    features: ["Hasta 200 estudiantes", "5 usuarios admin"],
  },
  {
    id: "profesional",
    name: "Profesional",
    price: "$599",
    features: ["Hasta 1,000 estudiantes", "20 usuarios admin"],
    popular: true,
  },
  {
    id: "empresarial",
    name: "Empresarial",
    price: "Personalizado",
    features: ["Estudiantes ilimitados", "Soporte 24/7"],
  },
]

export default function RegistroPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState("profesional")
  const [step, setStep] = useState(1)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <span className="text-2xl font-bold text-primary-foreground">C</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Classia</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Solicita tu demo gratuita por 30 días
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-8 ${step > s ? "bg-primary" : "bg-muted"}`}
                />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <h1 className="text-center text-2xl font-bold text-foreground">
              {step === 1 && "Elige tu Plan"}
              {step === 2 && "Datos de la Institución"}
              {step === 3 && "Crea tu Cuenta"}
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              {step === 1 && "Selecciona el plan que mejor se adapte a tu institución"}
              {step === 2 && "Cuéntanos sobre tu escuela o colegio"}
              {step === 3 && "Configura tu acceso de administrador"}
            </p>
          </CardHeader>
          <CardContent>
            {/* Step 1: Plan Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative rounded-xl border p-4 text-left transition-all ${
                        selectedPlan === plan.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          Popular
                        </span>
                      )}
                      <p className="font-semibold text-foreground">{plan.name}</p>
                      <p className="text-xl font-bold text-foreground">{plan.price}</p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="text-xs text-muted-foreground"
                          >
                            • {feature}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
                <Button onClick={() => setStep(2)} className="w-full">
                  Continuar
                </Button>
              </div>
            )}

            {/* Step 2: Institution Info */}
            {step === 2 && (
              <form className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Nombre de la Institución
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Colegio San Martín" className="pl-10" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      País
                    </label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option>México</option>
                      <option>Argentina</option>
                      <option>Colombia</option>
                      <option>Chile</option>
                      <option>Perú</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Ciudad
                    </label>
                    <Input placeholder="Ciudad de México" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Número de Estudiantes
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <select className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm">
                        <option>1-100</option>
                        <option>101-300</option>
                        <option>301-500</option>
                        <option>501-1000</option>
                        <option>1000+</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Número de Profesores
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <select className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm">
                        <option>1-10</option>
                        <option>11-30</option>
                        <option>31-50</option>
                        <option>51-100</option>
                        <option>100+</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Teléfono de Contacto
                  </label>
                  <Input type="tel" placeholder="+52 555 123 4567" />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Atrás
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-1"
                  >
                    Continuar
                  </Button>
                </div>
              </form>
            )}

            {/* Step 3: Account Setup */}
            {step === 3 && (
              <form className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Nombre
                    </label>
                    <Input placeholder="Juan" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Apellido
                    </label>
                    <Input placeholder="García" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Correo Electrónico
                  </label>
                  <Input type="email" placeholder="admin@colegio.edu" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Debe contener al menos 8 caracteres, una mayúscula y un número
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Confirmar Contraseña
                  </label>
                  <Input type="password" placeholder="Repite tu contraseña" />
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="terms"
                    className="mt-1 h-4 w-4 rounded border-border text-primary"
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground">
                    Acepto los{" "}
                    <Link href="#" className="text-primary hover:underline">
                      Términos de Servicio
                    </Link>{" "}
                    y la{" "}
                    <Link href="#" className="text-primary hover:underline">
                      Política de Privacidad
                    </Link>
                  </label>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    Atrás
                  </Button>
                  <Button type="submit" className="flex-1" asChild>
                    <Link href="/admin">Crear Cuenta</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes una cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
