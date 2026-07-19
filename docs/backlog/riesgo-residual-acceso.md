# Riesgo residual aceptado — control de acceso de soporte

Ítems aceptados conscientemente al cerrar el sistema de acceso consentido
(ver [`docs/architecture/support-access-control.md`](../architecture/support-access-control.md)),
no resueltos porque no ameritaban el trabajo adicional en el momento del
cierre. Cada uno queda registrado con su condición de reactivación explícita
— este documento no propone trabajo nuevo, solo dimensiona lo que ya se
decidió postergar.

## 1. PDF de prueba huérfano en MinIO

**Descripción**: `tenants/8c8650c1-fde5-4f06-b5ac-116b938f1fdd/reports/6c69cef0-4729-44a2-adbe-f9f6cb4d8ea6.pdf`
quedó en el bucket de storage tras la verificación runtime del fix de
`buildJobId` en `reports.service.ts` (commit `41d86f5`). La fila de
`GeneratedReport` que lo referenciaba ya se borró por SQL directo; el archivo
en sí no se borró de MinIO por no tener a mano una vía de limpieza sin
herramientas adicionales.

**Impacto**: nulo. No contiene datos de un colegio real ni PII (es un reporte
de "cursos" del tenant demo, generado por una prueba), y es un único archivo
de tamaño mínimo.

**Condición para priorizar**: si aparece un proceso de auditoría de storage
que cuente objetos huérfanos (sin fila en `generated_reports` que los
referencie) y este archivo empieza a generar ruido en ese reporte.

## 2. Nada fuerza el uso de `buildJobId()` en código nuevo

**Descripción**: `apps/api/src/core/queue/job-id.ts` existe y está adoptado
en los 4 puntos de construcción de `jobId` detectados por auditoría (ver
commit `41d86f5`), pero no hay ningún lint rule, test de integración, ni
convención forzada que impida que un módulo nuevo (o una modificación futura
a uno existente) vuelva a escribir un `jobId` a mano con `:` u otro carácter
prohibido por BullMQ.

**Impacto**: el mismo bug (un endpoint que crea un job programado tira 500
silenciosamente en cada intento) podría reintroducirse sin que nada lo
detecte hasta que alguien lo note en producción — exactamente como pasó con
`reports.service.ts#schedulerJobId`, que estuvo así desde que se escribió sin
que ningún test lo cubriera.

**Condición para priorizar**: la próxima vez que se agregue una cola nueva
con `jobId` personalizado en `queue.add()`/`addBulk()`. En ese momento, la
opción más barata es una regla de ESLint simple (prohibir template literals
con `:` pasados a la opción `jobId`) o, más simple todavía, code review
manual que verifique que el nuevo punto usa `buildJobId()`.

## 3. `files` mantiene fallback a `DATOS_PERSONALES` sin registro exhaustivo

**Descripción**: `FilesDataScopeGuard` resuelve el alcance de un `fileKey`
buscándolo en las 8 tablas dueñas conocidas; si no aparece en ninguna, cae al
fallback conservador `DATOS_PERSONALES` (nunca al revés). Cada caída queda
instrumentada (`files.scope_fallback`, con el `fileKey` y el `ticketId`) pero
no existe un registro explícito `fileKey → entidad` que resuelva esto sin la
búsqueda por tablas.

**Impacto**: bajo por diseño — el fallback es conservador, así que un
`fileKey` no resuelto nunca queda MENOS protegido de lo que debería, solo
potencialmente MÁS restringido de lo necesario (un archivo que en realidad es
OPERATIVO podría exigir alcance DATOS_PERSONALES si no se encuentra en
ninguna tabla). Con datos reales insuficientes (N=1 en el momento de este
cierre, generado por prueba propia, no por uso orgánico) no hay señal para
decidir si construir el registro exhaustivo.

**Condición para priorizar**: volver a correr
[`scripts/sql/files-scope-fallback-report.sql`](../../scripts/sql/files-scope-fallback-report.sql)
después de varias semanas de tráfico real de soporte. Si el volumen es alto,
o se concentra en un tipo de archivo/prefijo identificable, ahí se justifica
construir el registro.

## 4. `MAX_ACCESS_DURATION_MINUTES` es una constante de aplicación

**Descripción**: el techo absoluto del sistema (480 min) vive como constante
en `access-control.schemas.ts`, no en ningún modelo de configuración. El
techo por colegio (`Tenant.maxAccessDurationMinutes`) es opcional sobre esa
constante — nunca puede excederla, pero la constante en sí solo se cambia
editando código y desplegando.

**Impacto**: bajo. No existe hoy un caso de negocio que pida un techo
absoluto distinto de 480 min, y cambiarlo (si hiciera falta) es un cambio de
una línea sin lógica adicional.

**Condición para priorizar**: si en algún momento se necesita que el techo
absoluto mismo sea configurable sin desplegar (p. ej. distinto por ambiente,
o ajustable por un `SUPER_ADMIN` sin pasar por código) — en ese punto sí
justificaría un modelo de configuración de plataforma real (el único que
existe hoy, `SystemSetting`, es genérico pero nunca se evaluó para este caso
específico).

## 5. Sin auditoría general de BullMQ más allá del patrón `:`

**Descripción**: el cierre del bug de `jobId` fue específico al patrón
`:` (confirmado real en `reports.service.ts` y corregido). No se hizo una
auditoría más amplia de otras formas en que un job de BullMQ pudiera fallar
silenciosamente en este código base (opciones mal formadas, colas sin
processor registrado, reintentos configurados de forma inconsistente entre
módulos, etc.).

**Impacto**: desconocido — es precisamente lo que una auditoría más amplia
determinaría. El hallazgo de `reports.service.ts` (una función completa,
nunca antes usada con éxito, sin que ningún test la cubriera) sugiere que
podría haber otros puntos ciegos similares en código que tampoco tiene
cobertura de integración real.

**Condición para priorizar**: si aparece otro caso de "una función que
debería estar funcionando pero nunca lo hizo" — el patrón que reveló el bug
original. En ese punto, vale la pena revisar sistemáticamente cada `queue.add`/
`addBulk`/`registerJobScheduler` del repo contra un entorno real, no solo
contra typecheck/lint.
