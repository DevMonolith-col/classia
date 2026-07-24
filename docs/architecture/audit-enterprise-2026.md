# Auditoría de Arquitectura - Classia SaaS (Visión Enterprise)

Este documento registra los hallazgos de la auditoría arquitectónica realizada a la plataforma Classia SaaS, con el objetivo de asegurar que la infraestructura y el código estén listos para soportar contratos de grado *Enterprise* (alto volumen, auditorías estrictas, SLAs exigentes).

## 🚨 1. Aislamiento Multi-Tenant (Punto Más Frágil)

### El Problema
Actualmente, la separación de datos entre colegios (tenants) depende exclusivamente de la memoria y disciplina de los desarrolladores en la capa de servicios (ej. `GroupsService`, `UsersService`). El filtro de seguridad se aplica manualmente en cada consulta:

```typescript
where: scopedTenantId ? { tenantId: scopedTenantId } : undefined
```

**Riesgo:** Si un desarrollador olvida agregar `tenantId` en un nuevo endpoint (ej. `findMany` de notas), la consulta devolverá datos de todos los colegios de la plataforma. En un entorno enterprise, una mínima fuga de datos inter-tenant es inaceptable y causaría problemas legales graves.

### Solución Propuesta
Quitar la responsabilidad del aislamiento de las manos del desarrollador e implementarlo a nivel global:
1. **Prisma Client Extensions:** Usar `$extends` para inyectar automáticamente el `tenantId` en **todas** las consultas de Prisma, extrayéndolo de un contexto asíncrono (cls-hooked / AsyncLocalStorage).
2. **Row Level Security (RLS) en Postgres:** Configurar políticas restrictivas a nivel de motor de base de datos usando `SET LOCAL tenant.id`. (Es la opción de máxima seguridad).

---

## ⚠️ 2. Gestión de Estado en Frontend (Web)

### El Problema
La aplicación Next.js se comunica con la API usando un wrapper de `fetch` crudo (`apiFetch`). No se utiliza un gestor de estado de servidor / caché como TanStack Query (React Query) o SWR.

**Riesgos:**
- Peticiones redundantes (no hay deduplicación ni caché en memoria del cliente).
- Falta de "optimistic updates" para dar sensación de velocidad.
- Dificultad para manejar estados de carga y error a medida que la aplicación escala.

### Solución Propuesta
Integrar **TanStack Query**. Reducirá drásticamente la carga sobre el backend, manejará reintentos, validará la caché (stale-while-revalidate) y mejorará significativamente la Experiencia de Usuario (UX).

---

## ⚡ 3. Caché y Saturación de Base de Datos (Backend)

### El Problema
Aunque Redis está configurado para manejar colas (BullMQ) y WebSockets (Socket.IO), **no se está aprovechando para cachear datos de lectura intensiva**.

**Riesgos:**
Cuando múltiples colegios se conecten simultáneamente en horarios pico, PostgreSQL recibirá el impacto de consultas complejas (listados, promedios, configuraciones) que no cambian con tanta frecuencia.

### Solución Propuesta
Implementar una capa de caché explícita en NestJS usando `CacheModule` respaldado por Redis para datos estáticos, metadatos del tenant y resultados de consultas analíticas.

---

## 🛡️ 4. Confianza, Calidad y Testing

### El Problema
La suite de pruebas automatizadas es mínima. Depende principalmente de pruebas End-to-End (E2E) que exigen que la base de datos y Redis estén corriendo localmente.

**Riesgos:**
- Suites lentas y frágiles en CI/CD.
- El equipo técnico sentirá fricción y riesgo al refactorizar lógica core por miedo a romper algo en producción.

### Solución Propuesta
Adoptar una estrategia balanceada (Pirámide de Tests):
- **Unit Tests:** Para lógica de negocio compleja (cálculos académicos, evaluación de permisos) mockeando Prisma.
- **Integration/E2E Tests:** Apoyarse en `Testcontainers` para levantar instancias aisladas de Postgres y Redis en el pipeline, asegurando que las pruebas sean deterministas.

---

## 🏗️ 5. Manejo de Autorización y Sesiones

### Observación Positiva
El sistema de **impersonación** para soporte técnico es una excelente decisión arquitectónica, indispensable para auditorías enterprise.

### Oportunidad de Mejora
Actualmente, el enrutamiento y validación de roles de Next.js (`middleware.ts`) decodifica el JWT sin una validación estricta de firma criptográfica en ese punto exacto. Aunque está bien para la UI, es vital garantizar que en el backend (NestJS) los Guards (`RoleGuard`, `PermissionsGuard`) estén aplicados rigurosamente a cada endpoint. La seguridad real vive en el backend.
