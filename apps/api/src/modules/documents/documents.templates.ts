import { DocumentType } from "@prisma/client"

// Sustitución simple {{variable}}, sin motor de plantillas: alcanza para HTML
// estático + datos del estudiante, y evita sumar una dependencia nueva para
// esta primera versión (el editor solo cambia contentHtml, no el mecanismo).
export function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "")
}

export const DEFAULT_TEMPLATE_NAMES: Record<DocumentType, string> = {
  STUDY_CERTIFICATE: "Constancia de estudio (oficial)",
  REPORT_CARD: "Boletín para certificar (oficial)",
}

const BASE_STYLE = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; padding: 60px 70px; }
  .header { text-align: center; margin-bottom: 40px; }
  .header h1 { font-size: 15px; letter-spacing: 2px; text-transform: uppercase; color: #444; margin: 0; }
  .header h2 { font-size: 26px; margin: 10px 0 0; }
  .body { font-size: 15px; line-height: 1.8; text-align: justify; margin: 30px 0 60px; }
  .body strong { font-weight: 700; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px; }
  .verification { font-size: 11px; color: #666; }
  .verification .code { font-family: monospace; font-size: 13px; font-weight: 700; color: #222; }
  .qr { width: 90px; height: 90px; }
`

const STUDY_CERTIFICATE_HTML = `
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body>
  <div class="header">
    <h1>{{tenantName}}</h1>
    <h2>Constancia de Estudio</h2>
  </div>
  <div class="body">
    La institución educativa <strong>{{tenantName}}</strong> hace constar que
    <strong>{{studentName}}</strong>, identificado(a) con documento
    <strong>{{studentDocument}}</strong>, se encuentra actualmente matriculado(a)
    en el curso <strong>{{groupName}}</strong>.
    <br/><br/>
    Se expide la presente constancia a solicitud del interesado el {{issuedDate}}.
  </div>
  <div class="footer">
    <div class="verification">
      Verificable en {{verifyUrl}}<br/>
      Código: <span class="code">{{verificationCode}}</span>
    </div>
    <img class="qr" src="{{qrDataUrl}}" />
  </div>
</body></html>
`

const REPORT_CARD_HTML = `
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body>
  <div class="header">
    <h1>{{tenantName}}</h1>
    <h2>Certificación de Boletín</h2>
  </div>
  <div class="body">
    La institución educativa <strong>{{tenantName}}</strong> certifica que
    <strong>{{studentName}}</strong>, identificado(a) con documento
    <strong>{{studentDocument}}</strong>, del curso <strong>{{groupName}}</strong>,
    obtuvo un promedio general de <strong>{{overallAverage}}</strong> (escala
    {{scaleName}}) durante el periodo académico evaluado.
    <br/><br/>
    Se expide la presente certificación a solicitud del interesado el {{issuedDate}}.
  </div>
  <div class="footer">
    <div class="verification">
      Verificable en {{verifyUrl}}<br/>
      Código: <span class="code">{{verificationCode}}</span>
    </div>
    <img class="qr" src="{{qrDataUrl}}" />
  </div>
</body></html>
`

export const DEFAULT_TEMPLATE_HTML: Record<DocumentType, string> = {
  STUDY_CERTIFICATE: STUDY_CERTIFICATE_HTML,
  REPORT_CARD: REPORT_CARD_HTML,
}

// Datos de ejemplo para la vista previa del editor - nunca toca la base de
// datos ni genera un DocumentIssuance real, así que los valores son fijos.
export function buildSampleVars(type: DocumentType, qrDataUrl: string): Record<string, string> {
  const vars: Record<string, string> = {
    studentName: "Ana María Restrepo Gómez",
    studentDocument: "1 098 765 432",
    groupName: "9°A",
    tenantName: "Institución Educativa de Ejemplo",
    issuedDate: new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }),
    verificationCode: "AB12CD34",
    verifyUrl: "https://classia.co/verify/AB12CD34",
    qrDataUrl,
  }
  if (type === "REPORT_CARD") {
    vars.overallAverage = "4.5"
    vars.scaleName = "0.0 - 5.0"
  }
  return vars
}
