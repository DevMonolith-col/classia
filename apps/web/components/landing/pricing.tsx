import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Básico",
    description: "Ideal para instituciones pequeñas",
    price: "299",
    currency: "USD",
    period: "/mes",
    features: [
      "Hasta 200 estudiantes",
      "5 usuarios administrativos",
      "Gestión de calificaciones",
      "Calendario escolar",
      "Soporte por email",
    ],
    cta: "Comenzar Prueba",
    highlighted: false,
  },
  {
    name: "Profesional",
    description: "Para instituciones en crecimiento",
    price: "599",
    currency: "USD",
    period: "/mes",
    features: [
      "Hasta 1,000 estudiantes",
      "20 usuarios administrativos",
      "Todo lo del plan Básico",
      "Comunicación con padres",
      "Reportes avanzados",
      "Integración con contabilidad",
      "Soporte prioritario",
    ],
    cta: "Comenzar Prueba",
    highlighted: true,
  },
  {
    name: "Empresarial",
    description: "Solución completa personalizada",
    price: "Personalizado",
    currency: "",
    period: "",
    features: [
      "Estudiantes ilimitados",
      "Usuarios ilimitados",
      "Todo lo del plan Profesional",
      "API personalizada",
      "Onboarding dedicado",
      "SLA garantizado",
      "Soporte 24/7",
    ],
    cta: "Contactar Ventas",
    highlighted: false,
  },
]

export function LandingPricing() {
  return (
    <section id="planes" className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Planes
          </h2>
          <p className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Precios transparentes que se adaptan a ti
          </p>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Sin costos ocultos. Prueba gratis por 30 días sin compromiso.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border ${
                plan.highlighted
                  ? "border-primary bg-primary text-primary-foreground shadow-2xl"
                  : "border-border bg-card"
              } p-8`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                  Más Popular
                </div>
              )}

              <div className="mb-6">
                <h3
                  className={`text-xl font-bold ${
                    plan.highlighted ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`mt-1 text-sm ${
                    plan.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span
                  className={`text-4xl font-bold ${
                    plan.highlighted ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {plan.currency && <span className="text-lg">{plan.currency}</span>}
                  {plan.price}
                </span>
                {plan.period && (
                  <span
                    className={`text-sm ${
                      plan.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {plan.period}
                  </span>
                )}
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      className={`h-5 w-5 shrink-0 ${
                        plan.highlighted ? "text-primary-foreground" : "text-success"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        plan.highlighted ? "text-primary-foreground/90" : "text-muted-foreground"
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlighted ? "secondary" : "default"}
                className="w-full"
                asChild
              >
                <Link href="/registro">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
