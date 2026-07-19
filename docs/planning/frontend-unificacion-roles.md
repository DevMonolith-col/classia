# Auditoría: Duplicación de UI por Rol y Plan de Unificación

> Auditoría técnica del frontend (`apps/web`) enfocada en la duplicación de pantallas
> entre portales (superadmin/admin/profesor/alumno/familia) y en la falta de una capa
> compartida de identidad/permisos. Sirve como base para las ramas de refactor que se
> abran a partir de esta fecha — no se ha implementado nada de lo aquí descrito todavía.

## 1. Diagnóstico de Áreas Débiles

- **No existe ninguna capa de identidad/rol reutilizable en el frontend.** No hay
  `useAuth()`, `useCurrentUser()`, `useRole()`, `usePermissions()` ni `RoleContext` en
  todo `apps/web` (confirmado por grep exhaustivo — los únicos `createContext`
  encontrados pertenecen a primitivos internos de shadcn/ui, no a auth). Cada página
  redescubre el rol por su cuenta: decodificando el JWT (`lib/auth.ts`), leyendo un
  caché paralelo en `localStorage` (`getStoredUser()`, que alimenta los 5 sidebars), o
  re-haciendo `fetch("/app/bootstrap")` y renarrando el tipo inline. El tipo del
  bootstrap (`summary.kind`) está **redeclarado manualmente 6 veces** solo dentro de
  `apps/web/app/profesor/*` (asignaciones, calificaciones, asistencia, estudiantes,
  asignaciones/nueva), cada una con su propio bloque de guardas de error casi
  idéntico.
- **El backend ya calcula lo que hace falta y el frontend lo ignora.**
  `bootstrap.service.ts` devuelve `membership.permissions` (el array de permisos
  exacto por rol, vía `getPermissionsForRole()`) en cada respuesta de
  `/app/bootstrap` — pero **cero archivos en `apps/web` leen ese campo**. Hoy el
  único control de acceso en la UI es el particionamiento duro de rutas en
  `middleware.ts` (redirige por rol a `/admin`, `/profesor`, etc.), no hay ningún
  mecanismo de "mostrar/ocultar según permiso" dentro de una misma pantalla.
- **El mapa rol→sección está duplicado sin fuente única de verdad**: existe una vez
  en `middleware.ts` (`ROLE_SECTION`) y otra vez en `lib/auth.ts`
  (`ROLE_ROUTES`/`getRoleRoute`). Hoy están sincronizados, pero nada impide que
  diverjan.
- **Los 5 sidebars (superadmin/admin/profesor/alumno/familia) son ~150 líneas de
  shell casi idéntico cada uno** (mismo wrapper responsive, mismo overlay móvil,
  misma derivación de iniciales/nombre, mismo `handleLogout`) — lo único que
  legítimamente cambia es el array de navegación y el label de rol. Cero componente
  compartido.
- **Ya existe el patrón correcto en 3 lugares — y no se replicó al resto.**
  `MessagingPanel`, `AnnouncementsBoard` y `NotificationsPanel` son exactamente el
  modelo a seguir: un componente único recibiendo `userRole` como prop, con lógica
  condicional interna (`canBroadcast`, `canPublish`, `canDelete`). Las páginas de
  mensajes/comunicados/notificaciones de los 3 portales son wrappers de 7-8 líneas.
  Esto prueba que el patrón funciona en este codebase — el problema es que no se
  extendió a Asignaciones, Calificaciones, Estudiantes, Horarios ni a los Sidebars.
- **Duplicación "de componente unificado pero shell de página no"**: en Asignaciones,
  la tarjeta (`AssignmentCard`) sí está compartida entre admin/profesor/alumno, pero
  el andamiaje alrededor (filtros, tabs, paginación, skeleton de carga) está copiado
  casi byte-a-byte 3 veces (~120-150 líneas por página).
- **Constantes duplicadas sin componente ni archivo compartido**:
  `ATTENDANCE_STATUS_LABELS`/`COLORS` existen por separado en
  `components/admin/attendance-types.ts` y `components/profesor/attendance-types.ts`
  con las mismas 5 claves; el filtro de Periodo/Materia se repite igual en 4
  pantallas de calificaciones.
- **Deuda de implementación disfrazada de "falta unificar"**: `familia/page.tsx`
  (dashboard), `familia/asistencia`, `profesor/horario` y `familia/horario` son
  **100% datos mock** sin ninguna llamada a la API — y `familia/horario`/
  `profesor/horario` además duplican ~70% de su propio código de calendario entre
  sí. No es solo un refactor de UI: son features sin terminar, con `profesor/horario`
  y `familia/horario` incluso usando vocabularios de estado distintos al enum real
  del backend.
- **Código muerto activo**: `admin/mensajes/nuevo` y `profesor/mensajes/nuevo` son
  páginas idénticas ("Próximamente...") ya obsoletas — `ChatInterface` ya tiene el
  flujo real de composición integrado — pero los botones de acción rápida en ambos
  dashboards siguen apuntando a esas rutas muertas en vez de al flujo real.
- **Gap de acceso real detectado de paso** (no es un problema de arquitectura de UI,
  pero surge del mismo análisis): `familia/calificaciones/page.tsx` llama a
  `/students` sin scope, con un comentario propio en el código admitiendo que
  debería filtrar solo a los hijos del acudiente; `GUARDIAN` ni siquiera tiene
  `STUDENTS_LIST`/`STUDENTS_READ` en `permissions.ts`. Vale la pena verificarlo
  aparte del esfuerzo de unificación.
- **Fan-out N+1 enmascarado de duplicación de UI**: `profesor/estudiantes` no tiene
  un endpoint backend con scope de profesor, así que reconstruye "mis estudiantes"
  en el cliente con 3 llamadas encadenadas (`bootstrap` → `schedules?teacherId=` →
  N× `students?groupId=`). Unificar la UI con `admin/estudiantes` sin resolver esto
  solo esconde el problema, no lo arregla.

## 2. Propuesta de Unificación (Matriz de Reusabilidad)

| # | Vistas actuales duplicadas | Componente unificado propuesto | Beneficio / impacto |
|---|---|---|---|
| 1 | `components/{superadmin,admin,profesor,alumno,familia}/sidebar.tsx` (5 archivos, ~150 líneas c/u de shell casi idéntico) | `components/shared/portal-sidebar.tsx` → `<PortalSidebar navigation={NavItem[]} roleLabels? brandFallback />` | Elimina ~600-700 líneas duplicadas. Único punto para arreglar el responsive, el logout o el overlay móvil una sola vez. Riesgo bajo: es 1:1 visual, sin cambio de datos. |
| 2 | Shell de `admin/asignaciones`, `profesor/asignaciones`, `alumno/asignaciones` (filtros + tabs + paginación + skeleton; `AssignmentCard` ya es compartido) | `usePagination()` hook + `components/shared/list-page-shell.tsx` (empty-state, loading-skeleton, paginación) | -350/400 líneas. Cambiar el tamaño de página o el mensaje de "sin resultados" deja de requerir tocar 3 archivos. |
| 3 | `profesor/horario` + `familia/horario` (mock duplicado entre sí, ~70% overlap, ninguno conectado a `/schedules`) | `components/shared/weekly-schedule-view.tsx` → `<WeeklyScheduleView schedules={Schedule[]} />`, alimentado por el `/schedules?teacherId=` que YA se usa correctamente en otras páginas de profesor | Cierra deuda funcional real (deja de ser mock) **y** unifica UI en un solo paso. Es el quick-win más claro de toda la auditoría. |
| 4 | Filtro Periodo/Materia repetido en `admin/calificaciones`, `profesor/calificaciones`, `alumno/calificaciones`, `familia/calificaciones` | `components/shared/period-subject-filter.tsx` | -80 líneas, consistencia de UX garantizada entre portales. |
| 5 | `admin/estudiantes` (CRUD, tenant-wide) vs `profesor/estudiantes` (solo lectura, fan-out N+1) — mismo tipo `Student`, misma forma de fila | `components/shared/students-table.tsx` → `<StudentsTable scope="all" \| "mine" mutable={boolean} />` **+ backend**: nuevo `GET /students?teacherId=` para reemplazar el fan-out | Elimina el N+1 del lado profesor y dos implementaciones de tabla. Requiere coordinar con backend (no es solo frontend) — por eso va en fase tardía del plan. |
| 6 | `components/admin/attendance-types.ts` + `components/profesor/attendance-types.ts` (labels/colores duplicados) | `components/shared/attendance-constants.ts` | Cambio mecánico, cero riesgo, una sola fuente de verdad de color/label por estado de asistencia. |
| 7 | `summary.kind`/`teacherId` re-declarado y re-validado 6× en `profesor/*` | `lib/bootstrap.ts` → tipo `Bootstrap` compartido + `useBootstrap()` / `useTeacherId()` | Elimina 6 bloques idénticos de fetch+narrow+manejo de error. Es la base técnica que habilita todo lo demás (ver sección 3). |
| 8 | Grid de stat-cards en `admin/profesor/alumno` dashboards (mismo patrón de `Card` + `Skeleton`, datos distintos por rol) | `components/shared/stat-card.tsx` / `<StatGrid items={} />` (solo presentación, no fuerza unificar el fetch) | Reduce boilerplate visual sin obligar a unificar datos que son legítimamente distintos por rol. |
| 9 | *(ya resuelto — usar como plantilla, no tocar)* Mensajes / Comunicados / Notificaciones | `MessagingPanel` / `AnnouncementsBoard` / `NotificationsPanel` | Ninguna acción — es el ejemplo a copiar para los ítems 1-7. Único ajuste menor: en `NotificationsPanel` el prop `userRole` se recibe pero nunca se usa — o se aprovecha o se retira. |

**Explícitamente fuera de esta matriz** (verificado que son concerns genuinamente
distintos, forzar su unificación violaría el principio de bajo acoplamiento):
`admin/calificaciones` (listado/índice) vs `profesor/calificaciones` (grilla
editable) vs las 3 vistas de solo-lectura ya unificadas en `StudentGradesTable`;
`admin/asistencia` (auditoría, tabla) vs `profesor/asistencia` (formulario de
captura); `admin/horarios` (CRUD) vs las vistas de solo-lectura del ítem 3.

## 3. Arquitectura de Control de UI por Rol

El principio: **ningún componente compartido debe preguntar "¿qué rol tengo?"** —
debe preguntar "¿tengo permiso X?", igual que ya hace `MessagingPanel` con
`canBroadcast`/`canPublish`, pero apoyado en el array `membership.permissions` que el
backend ya envía (hoy sin usar) en vez de un string de rol hardcodeado. Esto da
acoplamiento débil real: si mañana cambia qué roles tienen un permiso en
`apps/api/src/common/permissions/permissions.ts`, ningún componente de UI necesita
tocarse.

```ts
// lib/bootstrap.ts — fuente única de verdad del usuario actual, reemplaza los
// 6 tipos inline duplicados en profesor/* y el localStorage/JWT paralelos.

type BootstrapSummary =
  | { kind: "admin"; stats: AdminStats }
  | { kind: "teacher"; teacher: { id: string }; schedules: Schedule[] }
  | { kind: "guardian"; guardian: { id: string }; students: LinkedStudent[] }
  | { kind: "student"; student: { id: string; groupId: string | null } }
  | { kind: "basic" };

type Bootstrap = {
  user: { id: string; firstName: string; lastName: string; email: string };
  tenant: { id: string; slug: string; name: string };
  membership: { role: UserRole; permissions: Permission[] };
  summary: BootstrapSummary;
};

// hook único, cacheado en memoria para el ciclo de vida de la navegación
export function useBootstrap(): { data: Bootstrap | null; loading: boolean; error: string } { ... }

// azúcar sintáctica sobre useBootstrap(), reemplaza los 6 bloques duplicados
export function useTeacherId(): { teacherId: string | null; loading: boolean; error: string } {
  const { data, loading, error } = useBootstrap();
  if (data && data.summary.kind !== "teacher") return { teacherId: null, loading, error: "Esta cuenta no tiene perfil de profesor." };
  return { teacherId: data?.summary.kind === "teacher" ? data.summary.teacher.id : null, loading, error };
}

// check de permiso — esto es lo único que un componente compartido debe usar
export function usePermissions() {
  const { data } = useBootstrap();
  const set = new Set(data?.membership.permissions ?? []);
  return { can: (permission: Permission) => set.has(permission) };
}
```

```tsx
// components/shared/students-table.tsx — ejemplo del patrón "un componente,
// comportamiento condicionado por permiso" aplicado al ítem #5 de la matriz.

interface Props {
  scope: "all" | "mine";     // decide la estrategia de fetch (tenant-wide vs. /students?teacherId=)
  students: Student[];
}

export function StudentsTable({ scope, students }: Props) {
  const { can } = usePermissions();
  const canMutate = can(PERMISSIONS.STUDENTS_UPDATE); // no "role === TEACHER ? false : true"

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Estudiante</TableHead>
          <TableHead>Documento</TableHead>
          <TableHead>Curso</TableHead>
          {canMutate && <TableHead>Acudientes</TableHead>}
          {canMutate && <TableHead>Estado</TableHead>}
          {canMutate && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => (
          <StudentRow key={s.id} student={s} showMutationColumns={canMutate} />
        ))}
      </TableBody>
    </Table>
  );
}
```

```tsx
// components/shared/portal-sidebar.tsx — ítem #1, sin lógica de permisos
// (la navegación visible por rol sigue siendo config estática por portal,
// no necesita gating dinámico porque middleware ya la separa por ruta).

interface NavItem { name: string; href: string; icon: LucideIcon }
interface Props {
  navigation: NavItem[];
  roleLabels?: Record<string, string>;
  isCollapsed: boolean;
  onToggle: () => void;
}
export function PortalSidebar({ navigation, roleLabels, isCollapsed, onToggle }: Props) { /* shell único hoy duplicado x5 */ }
```

**Dónde se valida cada regla — explícitamente en dos capas, no una sola:**

- **UI (esta propuesta)**: `usePermissions().can(...)` decide qué se **muestra,
  oculta o deshabilita** dentro del componente compartido. Es puramente de
  experiencia — evita que un usuario vea botones que no puede usar, nada más.
- **Backend (ya existe, sin tocar)**: `PermissionsGuard` + `@Permissions(...)` en
  cada controller de NestJS siguen siendo la única fuente real de autorización. La
  UI ocultando un botón **nunca** reemplaza el guard del endpoint — si se agrega un
  `GET /students?teacherId=` (ítem #5), ese endpoint necesita su propio guard de
  permisos igual que los demás, independientemente de que la tabla ya filtre
  columnas en el cliente.

## 4. Plan de Migración Paso a Paso

**Fase 0 — Fundación invisible (riesgo mínimo, sin cambios visuales)**
1. Crear `lib/bootstrap.ts` con el tipo `Bootstrap` y los hooks `useBootstrap()` /
   `useTeacherId()` / `usePermissions()`.
2. Migrar los 6 archivos de `profesor/*` que hoy redeclaran el tipo inline para que
   usen `useTeacherId()`. Verificación: cada página debe comportarse pixel-a-pixel
   igual, solo cambia de dónde saca el dato.

**Fase 1 — Consolidaciones mecánicas de bajo riesgo**
3. Extraer `components/shared/portal-sidebar.tsx` y migrar los 5 sidebars uno por
   uno, comparando captura de pantalla antes/después de cada portal.
4. Unificar `attendance-types.ts` en `components/shared/attendance-constants.ts`.
5. Eliminar `admin/mensajes/nuevo` y `profesor/mensajes/nuevo`; repuntar los
   quick-actions de ambos dashboards al flujo real ya integrado en `ChatInterface`.

**Fase 2 — Shells de listado**
6. Extraer `usePagination()` + shell compartido de lista y migrar Asignaciones
   (admin/profesor/alumno) — `AssignmentCard` no cambia, solo el andamiaje
   alrededor.
7. Extraer `PeriodSubjectFilter` y aplicarlo a las 4 pantallas de calificaciones que
   lo repiten.

**Fase 3 — Cierre de deuda funcional real (no es solo refactor)**
8. Construir `WeeklyScheduleView` conectado a `/schedules` real; migrar
   `profesor/horario` primero (reutiliza el fetch que ya existe en el dashboard de
   profesor), luego `familia/horario` (probablemente necesite scope por acudiente,
   verificar backend).
9. Conectar `familia/page.tsx` (dashboard) y `familia/asistencia` a datos reales —
   marcar como su propio ticket, ya que toca el mismo hueco de scope de `GUARDIAN`
   detectado en el diagnóstico.

**Fase 4 — Consolidación que requiere coordinación con backend (mayor riesgo, hacer
al final)**
10. Diseñar y agregar `GET /students?teacherId=` (o `/students/mine`) con su propio
    guard de permisos.
11. Construir `StudentsTable` con `scope`/`mutable`, migrar `profesor/estudiantes` a
    consumir el nuevo endpoint, luego `admin/estudiantes` al mismo componente.
12. Resolver aparte (no bloquea lo anterior) el gap de `GUARDIAN` sin
    `STUDENTS_LIST`/`READ` usado sin scope en `familia/calificaciones`.

Cada fase se cierra con: build + typecheck limpio, y verificación manual en
navegador de que cada portal afectado se ve y funciona igual que antes de tocarlo —
ninguna fase depende de que la siguiente exista, así que se puede pausar entre fases
sin dejar nada a medias.
