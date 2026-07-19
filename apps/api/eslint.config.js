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
    },
  },
);
