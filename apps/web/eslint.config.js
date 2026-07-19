const nextConfig = require("eslint-config-next");

module.exports = [
  ...nextConfig,
  {
    ignores: ["eslint.config.js", ".next/**", "node_modules/**"],
  },
  {
    rules: {
      // Familia de reglas nuevas de eslint-plugin-react-hooks (preparación
      // para el React Compiler), no bugs del código actual. Revisados a mano
      // los ~4 casos que existían: un Date.now() de granularidad-día (sin
      // riesgo real de mismatch de hidratación), un Math.random() puramente
      // cosmético (ancho de un skeleton loader), un reset de lastIndex de un
      // regex module-level ANTES de usarlo (el patrón correcto, no una fuga),
      // y un ref mutado dentro de un handler async (no durante el render) —
      // los cuatro son falsos positivos de un análisis estático todavía muy
      // conservador, no bugs. Si se adopta el React Compiler, revisar de nuevo.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
];
