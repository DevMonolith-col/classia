import { apiFetch } from "@/lib/api-client"

export type UploadedFile = {
  key: string
  name: string
  size: number
}

/**
 * Sube un archivo a `POST /files` y devuelve la clave con la que después se referencia.
 *
 * El backend genera la clave como `tenants/{tenantId}/{uuid}-{nombre}` y devuelve el nombre ya
 * saneado: por eso se usa el `name` de la respuesta y no `file.name` del input.
 *
 * Lanza con el mensaje del servidor cuando hay uno. El aviso al usuario queda del lado de quien
 * llama, porque cada pantalla lo muestra distinto (toast, texto bajo el campo, burbuja fallida).
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await apiFetch("/files", {
    method: "POST",
    body: formData,
    silent: true,
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
    const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
    throw new Error(message || "No se pudo subir el archivo.")
  }

  return (await res.json()) as UploadedFile
}

/** Nombres que se muestran embebidos en la burbuja en vez de como archivo para descargar. */
export const IMAGE_FILE_PATTERN = /\.(jpg|jpeg|png|gif|webp)$/i
