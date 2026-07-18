# Credenciales de Semilla (Datos Masivos)

Se ha ejecutado exitosamente un script de semilla masiva (`seed-massive`) que ha poblado la base de datos con:
- La institución Demo inicial actualizada (100 estudiantes).
- 5 instituciones nuevas (100 estudiantes cada una).
- Profesores, Padres (Guardians), Grados, Materias y Calificaciones.

## 🔑 Contraseña Universal
Para **todos** los usuarios (Administradores, Profesores, Acudientes, Estudiantes), la contraseña es:
> **`ClassiaTest2026!`**

## 👑 Super Administrador (Global)
Para acceder al panel global SaaS y probar las nuevas funcionalidades (Paginación y Filtros de Usuarios, Auditoría, etc.), utiliza esta cuenta que tiene acceso a **todas** las instituciones:

- **Email:** `admin@classia.com.co`
- **Contraseña:** `ClassiaDemo2026!`

---

## 🎧 Equipo de Soporte B2B (colegio `demo`)

Cuentas reales del equipo de soporte, con la misma contraseña `ClassiaDemo2026!`. Todas viven en el tenant `demo` (igual que `admin@classia.com.co`), que es la convención que ya usa este proyecto para el personal de plataforma.

| Rol | Nombre | Email | Puede |
|---|---|---|---|
| Supervisor de Soporte | Camila Rodríguez | `supervisor.soporte@classia.com.co` | Ver todos los tickets, asignarlos, entrar al colegio de un ticket, cambiar estado — sin el resto del poder de plataforma de `SUPER_ADMIN` (no crea/borra colegios, no asigna roles globales). |
| Agente de Soporte | Daniel Torres | `agente1.soporte@classia.com.co` | Ver todos los tickets, comentar, cambiar estado. No asigna tickets ni entra al colegio por su cuenta — eso lo hace el supervisor. |
| Agente de Soporte | Valentina Ramírez | `agente2.soporte@classia.com.co` | Igual que arriba. |

Se crean/actualizan automáticamente al correr `pnpm run db:seed` (son `upsert`, no se duplican).

---

## 🏫 Instituciones Generadas

Cada institución tiene su propio administrador. 

| Institución | Slug | Email del Administrador |
|---|---|---|
| Colegio Demo Classia | `demo` | `admin@demo.classia.co` |
| Colegio Horizonte | `horizonte` | `admin@horizonte.classia.co` |
| Instituto San Jorge | `sanjorge` | `admin@sanjorge.classia.co` |
| Liceo Montessori | `montessori` | `admin@montessori.classia.co` |
| Gimnasio Los Andes | `andes` | `admin@andes.classia.co` |
| Colegio Del Valle | `valle` | `admin@valle.classia.co` |

---

## 👨‍🏫 Profesores

En cada institución se generaron 10 profesores. El formato de su correo es:
- `profesor1@<slug>.classia.co`
- `profesor2@<slug>.classia.co`
- ...
- `profesor10@<slug>.classia.co`

**Ejemplo para el Colegio Horizonte:**
- `profesor1@horizonte.classia.co`
- `profesor2@horizonte.classia.co`

Estos profesores ya tienen clases asignadas (ej. Matemáticas en 5to Grado A), tareas creadas y notas puestas a los alumnos para el **Periodo 1 del 2026**.

---

## 👨‍👩‍👧‍👦 Padres y Acudientes (Guardians)

Para garantizar relaciones robustas de familia (padres con múltiples hijos), se generaron cuentas de acudientes en cada institución.

Formato de correos de acudientes:
- `padre1@<slug>.classia.co`
- `padre2@<slug>.classia.co`
- ...
- `padre80@<slug>.classia.co`

**Ejemplo para Liceo Montessori:**
- `padre12@montessori.classia.co`

Al iniciar sesión como un `padreX`, podrás ver a los estudiantes (hijos) que le fueron asignados de manera aleatoria. En muchos casos verás 1, 2 o más hijos.

---

## 🎓 Estudiantes

Muchos estudiantes (aproximadamente el 50%) tienen una cuenta de usuario activa para que puedas probar el portal del alumno.

Formato de correos de estudiantes:
- `estudiante1@<slug>.classia.co`
- `estudiante2@<slug>.classia.co`
- ...
- `estudiante100@<slug>.classia.co`

*(Nota: si al intentar iniciar sesión te dice que no existe, intenta con otro número cercano, ya que la asignación de cuenta fue aleatoria al 50%).*

---

## 💡 Cómo probar la nueva data

1. **Prueba el flujo del Motor de Notas (Administrador):**
   - Entra como `admin@horizonte.classia.co`.
   - Navega a **Administración -> Calificaciones**.
   - Prueba los nuevos filtros, busca un estudiante y general el boletín masivo. Verás cómo carga perfectamente con la base de 100 estudiantes y sus respectivas notas de clase.

2. **Prueba el flujo del Profesor:**
   - Entra como `profesor1@sanjorge.classia.co`.
   - Navega a tus calificaciones y verás las tareas que se generaron (ej. "Actividad 1 - P1 - Matemáticas").
   - Las notas están promediadas usando la escala nacional de 1.0 a 5.0.

3. **Prueba el portal de Padres:**
   - Entra como `padre1@valle.classia.co`.
   - Revisa la vista del acudiente, cambiando entre los perfiles de los hijos que te fueron asignados aleatoriamente.
