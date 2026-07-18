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
      // Desactivar JS es defensa en profundidad, pero NO impide que Chromium
      // cargue subrecursos (<img>, <link>, fuentes, <iframe>). Una plantilla
      // editable por un admin de colegio (no confiable a nivel infra) podría
      // apuntar a una URL interna (metadata del cloud, servicios internos) y
      // exfiltrarla dentro del PDF. Por eso interceptamos toda petición y solo
      // permitimos recursos embebidos (data:), abortando cualquier otra.
      await page.setJavaScriptEnabled(false)
      await page.setRequestInterception(true)
      page.on("request", (req) => {
        if (req.url().startsWith("data:")) {
          void req.continue()
        } else {
          void req.abort()
        }
      })
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
