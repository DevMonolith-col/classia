import { ReportTable } from "./reports.service"

// Serializer propio, sin dependencia nueva: los reportes son tablas simples
// (texto/números), no ameritan sumar una librería de CSV para esto.
export function toCsv(table: ReportTable): string {
  const escape = (value: string | number) => {
    const str = String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const lines = [table.columns.map((c) => escape(c.label)).join(",")]
  for (const row of table.rows) {
    lines.push(table.columns.map((c) => escape(row[c.key] ?? "")).join(","))
  }
  return lines.join("\n")
}

const BASE_STYLE = `
  body { font-family: -apple-system, Arial, sans-serif; color: #1a1a1a; padding: 40px 50px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .summary { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
  .summary .item { border: 1px solid #ddd; border-radius: 8px; padding: 10px 16px; }
  .summary .item .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary .item .value { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e5e5e5; font-size: 11px; }
  th { background: #f5f5f5; text-transform: uppercase; font-size: 10px; color: #444; }
  tr:nth-child(even) { background: #fafafa; }
`

export function toReportHtml(title: string, tenantName: string, generatedAt: Date, table: ReportTable): string {
  const summaryHtml = Object.entries(table.summary)
    .map(([label, value]) => `<div class="item"><div class="label">${label}</div><div class="value">${value}</div></div>`)
    .join("")

  const headerHtml = table.columns.map((c) => `<th>${c.label}</th>`).join("")
  const rowsHtml = table.rows
    .map((row) => `<tr>${table.columns.map((c) => `<td>${row[c.key] ?? ""}</td>`).join("")}</tr>`)
    .join("")

  return `
<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head>
<body>
  <h1>${title}</h1>
  <div class="meta">${tenantName} · Generado el ${generatedAt.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</div>
  <div class="summary">${summaryHtml}</div>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml || `<tr><td colspan="${table.columns.length}">Sin datos para los filtros seleccionados.</td></tr>`}</tbody>
  </table>
</body></html>
`
}
