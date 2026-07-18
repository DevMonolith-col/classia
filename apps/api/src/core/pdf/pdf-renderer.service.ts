import { Injectable, OnModuleDestroy } from "@nestjs/common"
import puppeteer, { Browser } from "puppeteer"

// Un solo Chromium reusado entre todos los módulos que necesitan renderizar
// PDF (documents, reports) - lanzar el navegador es lo más caro de toda la
// operación (~1-2s y bastante RAM); si cada módulo mantuviera su propio
// singleton, terminaríamos con dos instancias de Chromium en memoria a la vez
// por nada.
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private browserPromise: Promise<Browser> | null = null

  async renderPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser()
    const page = await browser.newPage()
    try {
      // El HTML que se renderiza acá lo arman los propios módulos (plantillas
      // de certificados, tablas de reportes) con datos ya resueltos, nunca JS
      // de terceros - desactivarlo cierra de raíz cualquier intento de
      // fetch/XHR saliente desde el proceso del servidor.
      await page.setJavaScriptEnabled(false)
      // Timeout explícito: una plantilla con CSS roto o una imagen externa
      // que nunca resuelve no debe poder colgar el worker para siempre.
      await page.setContent(html, { waitUntil: "load", timeout: 15_000 })
      const pdf = await page.pdf({ format: "letter", printBackground: true, timeout: 15_000 })
      return Buffer.from(pdf)
    } finally {
      await page.close()
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] })
    }
    return this.browserPromise
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise
      await browser.close()
    }
  }
}
