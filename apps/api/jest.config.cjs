module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.e2e-spec.ts", "<rootDir>/src/**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    "^@classia/database$": "<rootDir>/../../packages/database/src",
    "^@classia/shared$": "<rootDir>/../../packages/shared/src",
    "^@classia/validators$": "<rootDir>/../../packages/validators/src",
    // puppeteer es ESM-only y Jest no lo transforma; se stubbea porque el PDF no
    // se ejercita en los tests (ver test/mocks/puppeteer.stub.ts).
    "^puppeteer$": "<rootDir>/test/mocks/puppeteer.stub.ts",
  },
  maxWorkers: 1,
  // El default de 5s no alcanza cuando un test tiene que esperar la ventana de
  // 60s del ThrottlerGuard de /auth/login (20/min por IP): corriendo las suites
  // seguidas, o dos veces dentro del mismo minuto, el backoff de login llega a
  // ~85s. En la corrida normal ningún test se acerca a esto -- es solo el techo
  // para que el rate-limit no se manifieste como un timeout espurio.
  testTimeout: 120_000,
};
