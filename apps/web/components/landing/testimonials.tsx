import { Quote } from "lucide-react"

const testimonials = [
  {
    quote:
      "Classia transformó la manera en que gestionamos nuestra escuela. La comunicación con los padres mejoró un 80% y ahora tenemos todo centralizado.",
    author: "María González",
    role: "Directora",
    institution: "Colegio San Martín",
    location: "Buenos Aires, Argentina",
  },
  {
    quote:
      "El sistema de calificaciones es muy intuitivo. Mis profesores lo adoptaron rápidamente y los padres valoran poder ver el progreso de sus hijos en tiempo real.",
    author: "Carlos Mendoza",
    role: "Coordinador Académico",
    institution: "Instituto Pedagógico Nacional",
    location: "Ciudad de México, México",
  },
  {
    quote:
      "La implementación fue muy sencilla. El equipo de soporte nos acompañó en todo momento y ahora no podemos imaginar trabajar sin Classia.",
    author: "Ana Lucía Vargas",
    role: "Administradora",
    institution: "Liceo Moderno",
    location: "Bogotá, Colombia",
  },
]

export function LandingTestimonials() {
  return (
    <section id="testimonios" className="bg-secondary py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
            Testimonios
          </h2>
          <p className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Lo que dicen nuestros clientes
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <Quote className="h-8 w-8 text-muted-foreground/30" />
              <blockquote className="mt-4 flex-1 text-pretty text-muted-foreground">
                {testimonial.quote}
              </blockquote>
              <div className="mt-6 flex items-center gap-4 border-t border-border pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {testimonial.author.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}, {testimonial.institution}
                  </p>
                  <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
