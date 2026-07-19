export const TICKET_CATEGORIES = ["BUG", "BILLING", "FEATURE", "HELP"] as const
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  BUG: "Error en el sistema",
  BILLING: "Facturación / Pagos",
  FEATURE: "Nueva funcionalidad",
  HELP: "Duda / Ayuda",
}
