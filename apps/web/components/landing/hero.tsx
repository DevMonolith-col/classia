import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2 } from "lucide-react"

export function LandingHero() {
  const features = [
    "Gestión de estudiantes y profesores",
    "Calificaciones en tiempo real",
    "Comunicación integrada con padres",
  ]

  return (
    <section className="relative overflow-hidden bg-background py-16 sm:py-24 lg:py-32">
      {/* Background Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#f5f5f5_1px,transparent_1px),linear-gradient(to_bottom,#f5f5f5_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm font-medium text-muted-foreground">
              Plataforma educativa #1 en Latinoamérica
            </span>
          </div>

          {/* Headline */}
          <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            La plataforma integral para la{" "}
            <span className="text-accent">gestión escolar</span> moderna
          </h1>

          {/* Subheadline */}
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
            Simplifica la administración de tu institución educativa. Conecta profesores, 
            estudiantes y padres en un solo lugar con herramientas intuitivas y poderosas.
          </p>

          {/* Features List */}
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {feature}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild className="gap-2">
              <Link href="/registro">
                Comenzar Gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#demo">Ver Demostración</Link>
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Más de <span className="font-semibold text-foreground">500+ instituciones</span> confían en Classia
            </p>
            <div className="flex items-center gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-24 rounded bg-secondary"
                  aria-label={`Logo institución ${i}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
