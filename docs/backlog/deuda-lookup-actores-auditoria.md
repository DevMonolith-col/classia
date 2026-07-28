# Deuda funcional aceptada — el lookup de actores de auditoría solo cubre la primera página

Ítem detectado al corregir el consumo del sobre paginado de `GET /users` en
`/admin/actividad` (julio 2026). No fue introducido por ese trabajo: es
preexistente y quedó a la vista porque esa fase fue la primera en hacer
renderizar la ruta y mirar de dónde salían los nombres de la columna "Actor".

Mismo criterio que [`riesgo-residual-acceso.md`](./riesgo-residual-acceso.md) y
[`deuda-visual-responsive.md`](./deuda-visual-responsive.md): este documento no
propone trabajo nuevo, dimensiona lo que se decidió postergar y deja escrita la
condición que lo reactiva.

## 1. El lookup de `/users` trae 50 filas; la tabla de auditoría puede referenciar a cualquiera

**Descripción**: las dos vistas de auditoría cargan `/users` una sola vez, sin
`limit` ni `cursor`, para construir un `Map` de `id → usuario` con el que
resuelven el nombre del actor de cada fila. `apps/api/src/modules/users/users.schemas.ts:55`
fija `limit` en **50** por defecto (máximo 100), y ninguno de los dos lookups
pide más ni sigue `pageInfo.nextCursor`.

Los registros de auditoría no están acotados a ese subconjunto: `AuditService`
pagina sobre todos los logs del tenant. Cuando el actor de una fila no está en
el `Map`, la celda cae a `"—"` (`apps/web/app/admin/actividad/page.tsx:144`).
No hay error, ni log, ni indicador visual: el nombre se pierde en silencio y la
fila parece no tener autor.

**El sesgo no es aleatorio, y esa es la parte que importa**: los dos extremos
ordenan al revés.

| Consulta | Orden | Qué se queda |
| --- | --- | --- |
| `users.service.ts:119-121` | `createdAt: "asc"` | los 50 usuarios **más antiguos** |
| `audit.service.ts:38-39` | `createdAt: "desc"` | la actividad **más reciente** |

Los usuarios creados después del corte son justamente los que más probablemente
aparezcan en la actividad reciente, y son exactamente los que el lookup no
resuelve. El modo de falla no es "algunos actores al azar salen sin nombre",
sino "los usuarios nuevos salen sin nombre, y con el tiempo son cada vez más".

**Alcance**: dos vistas, ambas por el mismo lookup de `/users`.

- `apps/web/app/admin/actividad/page.tsx:63`
- `apps/web/app/superadmin/audit/page.tsx:115-124`

`/tenants`, el otro lookup de la vista de superadmin, **no** está afectado:
`tenants.service.ts:37` devuelve un `findMany` sin paginar, es decir un arreglo
plano — que es el caso que resuelve el `Array.isArray(...)` de esa vista.

**Impacto**: hoy nulo, y verificado como tal: el tenant demo tiene 26 usuarios y
la respuesta trae `pageInfo.hasNextPage: false`, así que el lookup los cubre a
todos. Se manifiesta en cuanto un colegio pase de 50 usuarios entre personal,
docentes, acudientes y estudiantes con cuenta.

Cuando se manifieste, la degradación es cosmética y no destructiva: la fila de
auditoría conserva fecha, acción, entidad y rol del actor, y el `userId` sigue
almacenado en el log. No se pierde trazabilidad — se pierde la comodidad de leer
el nombre sin ir a la base. Por eso se acepta como deuda y no como defecto a
corregir en caliente.

**Opciones a evaluar cuando se priorice**:

- *Resolver el actor en el servidor*, incluyendo nombre y rol en la respuesta de
  `/audit/logs`. Elimina el lookup y el modo de falla de raíz, y es
  probablemente la salida correcta. Toca la ruta del API, que estaba fuera del
  alcance de la fase que detectó esto.
- *Paginar el lookup hasta agotar `nextCursor`*. Resuelve el síntoma sin tocar
  el API, pero no escala: un colegio con 2000 usuarios haría 40 requests al
  abrir la pantalla, para poblar un `Map` del que usará 20 entradas.
- *Pedir solo los actores presentes en la página visible* (los ≤20 `userId`
  distintos de la página). Es lo más ajustado, pero exige un endpoint que acepte
  una lista de ids, que hoy no existe.

**Condición para priorizar**: cuando el primer tenant supere los 50 usuarios, o
cuando se abra trabajo sobre el endpoint de auditoría por cualquier otro motivo
— en ese momento la primera opción sale casi gratis. Corregirlo solo en el
cliente, sin tocar el API, cambia un modo de falla silencioso por 40 requests
por carga, así que no conviene hacerlo aislado.
