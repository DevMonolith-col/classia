# SuperAdmin v1 - Plan de seguimiento

## Objetivo del incremento

Dejar una primera base visual funcional para el dashboard global de superadmin en `apps/web`, enfocada en la operacion SaaS multi-tenant de Classia.

Este incremento debe permitir que un usuario con rol `SUPER_ADMIN` llegue a `/superadmin`, vea una pantalla inicial clara y tenga una estructura de navegacion preparada para crecer sin exponer rutas incompletas o confusas.

## Estado actual

Implementado en progreso:

- Redireccion de `SUPER_ADMIN` hacia `/superadmin` desde `apps/web/lib/auth.ts`.
- Proteccion de `/superadmin` en `apps/web/middleware.ts`.
- Layout dedicado para `/superadmin`.
- Sidebar dedicado para superadmin.
- Dashboard inicial con metricas, tabla de tenants, auditoria reciente, soporte y acciones operativas.
- Consumo inicial de `GET /tenants` y `GET /audit/logs?limit=6` mediante `apiFetch`.
- Datos fallback/mock para mantener una base visual util cuando la API no responda o no devuelva datos suficientes.

## Decisiones tomadas

- Mantener el alcance en el dashboard inicial de superadmin, sin introducir modulos nuevos.
- Aceptar mocks/fallbacks temporalmente porque el objetivo inmediato es estabilizar la base visual.
- Evitar navegacion rota: las secciones futuras del sidebar deben mostrarse como no disponibles hasta que existan rutas reales.
- No implementar CRUD de tenants, usuarios globales, soporte auditado ni configuracion en este incremento.
- Mantener la separacion de roles: `SUPER_ADMIN` usa `/superadmin`; roles administrativos de colegio siguen usando `/admin`.

## Tareas pendientes

- Crear rutas reales para las secciones futuras del sidebar:
  - `/superadmin/tenants`
  - `/superadmin/users`
  - `/superadmin/audit`
  - `/superadmin/support`
  - `/superadmin/security`
  - `/superadmin/settings`
- Definir contrato frontend/backend para metricas reales del dashboard.
- Decidir si `GET /tenants` debe incluir conteos de usuarios o memberships.
- Reemplazar valores simulados de plan, uso y soporte por datos reales.
- Implementar acciones reales para crear tenant, revisar auditoria, actualizar datos y revisar accesos de soporte.
- Agregar pruebas o validaciones automatizadas cuando la configuracion de lint/typecheck este lista.

## Riesgos conocidos

- Los datos fallback/mock pueden confundirse con datos reales si no se comunican claramente en la UI o en el codigo.
- `apiFetch` envia `X-Tenant-Slug` incluso en consultas globales; hay que validar si esto sera correcto para flujos de superadmin en produccion.
- La validacion con ESLint no esta disponible actualmente porque falta `eslint.config.(js|mjs|cjs)` para ESLint 10.
- La proteccion de rutas depende del claim `role` presente en el JWT.
- Las metricas de usuarios pueden aparecer en cero con datos reales si la API no devuelve conteos.

## Criterios para considerar listo el commit

- `SUPER_ADMIN` redirige a `/superadmin`.
- `/superadmin` esta protegida por middleware.
- Usuarios con otros roles no quedan autorizados a navegar en `/superadmin` con token valido.
- No hay enlaces activos hacia rutas inexistentes desde el sidebar.
- Los mocks/fallbacks temporales estan documentados en codigo o plan.
- No se incluyen cambios accidentales como modificaciones solo por line endings.
- El diff del commit queda limitado al dashboard inicial de superadmin, auth/middleware necesario y este documento de seguimiento.

## Siguiente paso recomendado

Trabajar la primera subruta real de superadmin: `/superadmin/tenants`.

Este paso es prioritario porque el dashboard inicial ya presenta la operacion global de colegios, pero la siguiente necesidad natural es poder revisar tenants con mas detalle sin caer en navegacion deshabilitada o pantallas 404. Tambien permite validar temprano el contrato entre frontend y backend para datos globales antes de construir usuarios, auditoria o soporte.

Alcance sugerido para la proxima iteracion:

- Crear la pagina `/superadmin/tenants` con una vista de listado de colegios.
- Reutilizar el shell y sidebar actual, habilitando solo el enlace `Colegios` cuando la ruta exista.
- Consumir `GET /tenants` con estados de loading, error y empty.
- Mantener fallback/mock solo si la API no esta disponible, dejando claro que es temporal.
- Mostrar campos ya disponibles del backend: nombre, slug, dominio principal, estado, color de marca y fechas.
- No implementar todavia creacion, edicion, suspension ni eliminacion de tenants.
- No modificar backend salvo que sea estrictamente necesario para corregir un contrato ya existente.

Criterios para considerar completado ese siguiente paso:

- `/superadmin/tenants` carga sin errores en desktop y mobile.
- El enlace `Colegios` del sidebar queda habilitado y marca estado activo correctamente.
- La pagina maneja loading, error, empty y success.
- No hay enlaces activos hacia subrutas inexistentes desde esa pagina.
- La vista no permite acciones sensibles sin flujo auditado definido.
- El build web pasa y no se agregan cambios generados innecesarios.

## Seguimiento

Usar este documento como punto de control antes de continuar el modulo de superadmin. Cada nuevo incremento debe actualizar el estado, decisiones y pendientes relevantes.
