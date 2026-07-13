# Plan de Preparación para Despliegue (Trust Proxy & CORS Dinámico)

Este documento contiene las especificaciones técnicas detalladas para habilitar el soporte de Proxy Inverso (Coolify / Cloudflare) y la gestión de CORS dinámico para subdominios multi-tenant en el backend de **Classia SaaS**. 

Está redactado como una guía paso a paso lista para ser procesada por un asistente de código (como Claude) para su implementación directa.

---

## Objetivo

Preparar el backend NestJS (`apps/api`) para ser desplegado en producción de forma segura y automatizada dentro de un VPS de Hostinger controlado por Coolify, asegurando que:
1. Las IPs de los clientes se registren correctamente en la auditoría (`AuditLog`) en lugar de registrar `127.0.0.1`.
2. Las llamadas CORS se permitan de forma dinámica para cualquier subdominio del tenant (ej. `app.colegio.classia.com.co`) sin intervención manual en las variables de entorno.

---

## Archivos a Modificar

* **Archivo Principal:** `apps/api/src/app.setup.ts`
* **Archivo de Configuración (opcional/verificación):** `apps/api/src/config/app.config.ts`

---

## Instrucciones Paso a Paso para la Implementación

### Paso 1: Configurar `trust proxy` en Express (NestJS)

En el archivo `apps/api/src/app.setup.ts`, dentro de la función `setupApp`, debemos obtener la instancia interna de Express desde el adaptador HTTP de NestJS y activar la configuración de `trust proxy`.

#### Código a agregar:
```typescript
  // Obtener la instancia de Express y habilitar trust proxy para Cloudflare/Coolify
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', true);
  }
```

---

### Paso 2: Implementar CORS Dinámico con Expresión Regular

En el mismo archivo `apps/api/src/app.setup.ts`, se debe configurar una expresión regular dinámica basada en el dominio principal de la plataforma (`app.domain`, por defecto `classia.com.co`).

Esta expresión regular debe:
* Permitir `http://` y `https://`.
* Permitir cualquier subdominio (ej: `app.sanpedro.classia.com.co`).
* Permitir puertos de desarrollo opcionales (ej: `:3000`).
* Evitar falsos positivos (como `maliciousclassia.com.co`).

#### Código a agregar:
```typescript
  // Construir la expresión regular para permitir dinámicamente cualquier subdominio del dominio principal
  const domain = config.get<string>("app.domain", "classia.com.co");
  const escapedDomain = domain.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const tenantOriginRegex = new RegExp(
    `^https?:\\/\\/([a-zA-Z0-9-]+\\.)*${escapedDomain}(:\\d+)?$`
  );
```

#### Modificar la función `origin` en `app.enableCors`:
```typescript
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      if (!origin) return callback(null, true);

      // Permitir orígenes privados en desarrollo (localhost, etc.)
      if (
        nodeEnv === "development" &&
        PRIVATE_ORIGIN.test(origin)
      ) {
        return callback(null, true);
      }

      // Permitir dinámicamente subdominios del dominio principal del SaaS
      if (tenantOriginRegex.test(origin)) {
        return callback(null, true);
      }

      // Permitir dominios explícitos configurados en la variable de entorno
      if (explicitOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  });
```

---

## Así debe quedar el archivo final (`apps/api/src/app.setup.ts`)

Reemplazar todo el contenido de `apps/api/src/app.setup.ts` por el siguiente código optimizado:

```typescript
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

const PRIVATE_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("app.nodeEnv", "development");
  const webUrl = config.get<string>("app.webUrl", "http://localhost:3000");
  const explicitOrigins = config.get<string[]>("app.corsOrigins") ?? [webUrl];

  // 1. Confiar en proxies inversos (Coolify/Cloudflare) para resolver la IP real del cliente
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp.set === "function") {
    expressApp.set("trust proxy", true);
  }

  // 2. Configurar Regex para validar subdominios dinámicos del SaaS (ej. app.colegio.classia.com.co)
  const domain = config.get<string>("app.domain", "classia.com.co");
  const escapedDomain = domain.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const tenantOriginRegex = new RegExp(
    `^https?:\\/\\/([a-zA-Z0-9-]+\\.)*${escapedDomain}(:\\d+)?$`
  );

  app.use(helmet());
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      if (!origin) return callback(null, true);

      // Permitir IPs privadas / localhost en desarrollo
      if (
        nodeEnv === "development" &&
        PRIVATE_ORIGIN.test(origin)
      ) {
        return callback(null, true);
      }

      // Permitir dinámicamente cualquier subdominio del dominio principal
      if (tenantOriginRegex.test(origin)) {
        return callback(null, true);
      }

      // Permitir dominios explícitos configurados (útil para dominios personalizados de colegios)
      if (explicitOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter(config));
}
```

---

## Verificación de Cambios (QA)

Para verificar que la implementación es correcta, se deben realizar las siguientes pruebas locales:

### Prueba de CORS
1. Iniciar la API localmente (`pnpm dev:api`).
2. Ejecutar una consulta HTTP utilizando herramientas como Postman o cURL simulando una petición desde un subdominio multi-tenant:
   ```bash
   curl -I -X OPTIONS http://localhost:3001/health \
     -H "Origin: https://app.sanpedro.classia.com.co" \
     -H "Access-Control-Request-Method: GET"
   ```
3. **Resultado Esperado:** La API debe responder con status `204 No Content` u `200 OK` e incluir la cabecera `Access-Control-Allow-Origin: https://app.sanpedro.classia.com.co`.

### Prueba de IP (`trust proxy`)
1. Realizar una petición a un endpoint de login (`POST /auth/login`) simulando el reenvío por proxy:
   ```bash
   curl -X POST http://localhost:3001/auth/login \
     -H "X-Forwarded-For: 203.0.113.195" \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@classia.com.co", "password": "ClassiaDemo2026!"}'
   ```
2. **Resultado Esperado:** Al revisar la base de datos de auditoría (`AuditLog`), el log de la acción `auth.login` debe haber guardado `203.0.113.195` como `ipAddress`, en lugar de `127.0.0.1` o `::1`.
