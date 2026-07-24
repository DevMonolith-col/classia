const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        // Node + Jest globals: el mismo config aplica a src (Node/NestJS) y
        // test (Jest), sin separar un config por carpeta.
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        module: "writable",
        require: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    rules: {
      // NestJS se apoya mucho en decoradores + inyección de tipos que TS a
      // veces no puede inferir del todo; "any" explícito es aceptable acá,
      // solo se marca el implícito (que sí suele ser un descuido real).
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Los decoradores de NestJS (@Injectable, @Controller...) y DTOs con
      // constructor vacío disparan falsos positivos en esta regla.
      "@typescript-eslint/no-empty-object-type": "off",
      // `declare global { namespace Express { ... } }` es el patrón estándar
      // (y el único soportado por TS) para aumentar tipos ambient globales
      // como Express.Request — no es un "namespace" evitable con ES modules.
      "@typescript-eslint/no-namespace": "off",
      // Fase 5 de docs/planning/aislamiento-rls-multitenant.md: un
      // `prisma.$transaction(...)` crudo abre SU PROPIA transacción en una
      // conexión nueva del pool -- la extensión de RLS solo puede setear
      // `app.tenant_id` con `SET LOCAL` (por transacción), así que cualquier
      // query dentro de esa transacción cruda queda sin contexto de tenant
      // (trampa #3 del plan; RLS falla cerrado, pero rompe la
      // funcionalidad). El wrapper sancionado es `runInTenantTransaction`
      // (`apps/api/src/core/prisma/run-in-tenant-transaction.ts`), que abre
      // la transacción y setea el contexto una sola vez al principio. Esta
      // regla bloquea cualquier `$transaction` nuevo fuera de los 3 sitios
      // ya auditados y exceptuados abajo (el wrapper mismo, la extensión de
      // RLS que usa la misma forma-array para operaciones sueltas, y el
      // único `$queryRaw` agregado standalone que necesitó la misma forma
      // manual -- ver conversations.service.ts#unreadCountsFor).
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='$transaction']",
          message:
            "No uses prisma.$transaction(...) crudo -- usa runInTenantTransaction() (apps/api/src/core/prisma/run-in-tenant-transaction.ts) para que app.tenant_id quede seteado en la misma conexión. Ver docs/planning/aislamiento-rls-multitenant.md, trampa #3.",
        },
      ],
    },
  },
  {
    // Los 3 sitios ya auditados que necesitan $transaction crudo de verdad
    // (ver el comentario de la regla arriba) -- cada uno documenta en su
    // propio código por qué es seguro.
    files: [
      "src/core/prisma/run-in-tenant-transaction.ts",
      "src/core/prisma/tenant-rls.extension.ts",
      "src/modules/conversations/conversations.service.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
