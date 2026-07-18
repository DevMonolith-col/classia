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
};
