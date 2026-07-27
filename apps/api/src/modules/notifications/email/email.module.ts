import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";

/**
 * `EmailService` vivía solo dentro de `NotificationsModule`, que además registra la cola de
 * BullMQ y todo el aparato de notificaciones. Cuando el restablecimiento de contraseña necesitó
 * mandar un correo, importar ese módulo entero desde `AuthModule` habría atado el arranque de
 * la autenticación a Redis para usar una función que solo depende de `ConfigService`.
 *
 * El servicio es stateless, así que esto es puramente de cableado: mismos envíos, mismo
 * proveedor, sin duplicar el provider en dos módulos.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
