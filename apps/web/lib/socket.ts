import type { Socket } from "socket.io-client"
import { getAccessToken, refreshAccessToken } from "./auth"

/**
 * El gateway desconecta el socket y emite "token_expired" en cuanto el JWT
 * usado para conectar caduca (un socket no recibe un 401 por sí solo).
 * Refresca el access token y reconecta con el nuevo, en vez de dejar al
 * cliente "conectado" en apariencia pero sin poder autenticar nada más.
 */
export function attachTokenRefresh(socket: Socket) {
  socket.on("token_expired", async () => {
    const refreshed = await refreshAccessToken()
    if (!refreshed) return

    const token = getAccessToken()
    if (!token) return

    socket.auth = { token }
    socket.connect()
  })
}
