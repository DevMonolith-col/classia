// Stub de puppeteer para el harness de tests. puppeteer (>=23) es ESM-only y Jest
// no lo transforma, lo que impedía arrancar TODA la suite e2e solo porque AppModule
// importa PdfRendererService. El PDF no se ejercita en los tests, así que basta con
// un stub: si algún test llegara a intentar renderizar, falla explícitamente.
export class Browser {}

const puppeteer = {
  launch: async () => {
    throw new Error("puppeteer está stubbeado en tests: no se puede renderizar PDF aquí");
  },
};

export default puppeteer;
