import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import appConfig from "./config/app.config";
import databaseConfig from "./config/database.config";
import emailConfig from "./config/email.config";
import { envSchema } from "./config/env.schema";
import redisConfig from "./config/redis.config";
import storageConfig from "./config/storage.config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuditCoreModule } from "./core/audit/audit-core.module";
import { ImpersonationAuditInterceptor } from "./common/interceptors/impersonation-audit.interceptor";
import { TenantRlsContextInterceptor } from "./common/interceptors/tenant-rls-context.interceptor";
import { PdfModule } from "./core/pdf/pdf.module";
import { PrismaModule } from "./core/prisma/prisma.module";
import { QueueModule } from "./core/queue/queue.module";
import { RedisModule } from "./core/redis/redis.module";
import { StorageModule } from "./core/storage/storage.module";
import { TenantContextModule } from "./core/tenant-context/tenant-context.module";
import { AnnouncementsModule } from "./modules/announcements/announcements.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AcademicModule } from "./modules/academic/academic.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { PasswordResetCleanupModule } from "./modules/auth/password-reset-cleanup.module";
import { BootstrapModule } from "./modules/bootstrap/bootstrap.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { EventsModule } from "./modules/events/events.module";
import { FilesModule } from "./modules/files/files.module";
import { GroupsModule } from "./modules/groups/groups.module";
import { GuardiansModule } from "./modules/guardians/guardians.module";
import { HealthModule } from "./modules/health/health.module";
import { HomeworkModule } from "./modules/homework/homework.module";
import { HomeworkSubmissionsModule } from "./modules/homework-submissions/homework-submissions.module";
import { GradingModule } from "./modules/grading/grading.module";
import { MarksModule } from "./modules/marks/marks.module";
import { QuestionsModule } from "./modules/questions/questions.module";
import { QuizAttemptsModule } from "./modules/quiz-attempts/quiz-attempts.module";
import { ReportCardsModule } from "./modules/report-cards/report-cards.module";
import { SchedulesModule } from "./modules/schedules/schedules.module";
import { StudentsModule } from "./modules/students/students.module";
import { SubjectsModule } from "./modules/subjects/subjects.module";
import { TeachersModule } from "./modules/teachers/teachers.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";
import { SupportModule } from "./modules/support/support.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ElectionsModule } from "./modules/elections/elections.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AccessControlModule } from "./modules/access-control/access-control.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", "../../.env.example"],
      validate: (config) => envSchema.parse(config),
      load: [appConfig, databaseConfig, redisConfig, storageConfig, emailConfig],
    }),
    EventEmitterModule.forRoot(),
    // Rate limiting con almacén en Redis (compartido entre instancias). El
    // límite por default (30/60s, ver abajo) se aplica GLOBAL vía APP_GUARD
    // (backlog "Seguridad y Permisos" 2.2) -- antes solo cubría las rutas
    // donde alguien puso `@UseGuards(ThrottlerGuard)` a mano (login,
    // forgot/reset/change-password, verificación de documentos, feed de
    // calendario), y el resto de la API -- estudiantes, tareas, mensajería,
    // todo el CRUD -- no tenía ningún tope. Las rutas ya throttled siguen
    // con su propio `@Throttle()` más estricto: NestJS respeta el override
    // por ruta aunque el guard sea global.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 30 }],
        storage: new ThrottlerStorageRedisService(config.get<string>("redis.url") ?? "redis://localhost:6379"),
        // **Apagado en tests, y no por comodidad: el rate-limit no prueba nada acá y cuesta
        // minutos.** Ninguna suite afirma un 429 — lo que hacen las cuatro que tocan endpoints
        // limitados es *reintentar con espera creciente* hasta cruzar la ventana de 60 s. Eso
        // es tiempo dormido puro: `calendar-feed` se llevaba 130 s de los 296 de la suite
        // completa por dos bucles de backoff (login y emisión de token) de hasta 112 s cada
        // uno, y CI se pasaba de sus 20 minutos por esto.
        //
        // Que el almacén sea Redis lo empeora: el contador **sobrevive entre corridas**, así
        // que verificar un test por reversión —correr dos veces seguidas— arranca la segunda
        // con el cupo ya gastado.
        //
        // Si alguna vez hay que probar el límite en sí, el test tiene que levantar su propio
        // módulo con esto desactivado; no alcanza con quitar esta línea.
        skipIf: () => config.get<string>("app.nodeEnv") === "test",
      }),
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    PdfModule,
    AuditCoreModule,
    TenantContextModule,
    HealthModule,
    TenantsModule,
    AuthModule,
    PasswordResetCleanupModule,
    BootstrapModule,
    UsersModule,
    GroupsModule,
    StudentsModule,
    TeachersModule,
    GuardiansModule,
    SubjectsModule,
    SchedulesModule,
    EventsModule,
    CalendarModule,
    AcademicModule,
    GradingModule,
    AttendanceModule,
    MarksModule,
    ReportCardsModule,
    HomeworkModule,
    HomeworkSubmissionsModule,
    QuestionsModule,
    QuizAttemptsModule,
    FilesModule,
    ConversationsModule,
    AnnouncementsModule,
    NotificationsModule,
    AuditModule,
    SupportModule,
    AccessControlModule,
    SettingsModule,
    ElectionsModule,
    DocumentsModule,
    PaymentsModule,
    ReportsModule,
  ],
  providers: [
    // Orden importa: los interceptors globales se anidan en el orden en que
    // se registran (el primero es el mas externo). TenantRlsContextInterceptor
    // va primero para que el contexto de tenant (AsyncLocalStorage) envuelva
    // TODO lo demas, incluyendo el write de auditoria de
    // ImpersonationAuditInterceptor -- si fuera al revés, ese write correría
    // sin contexto de tenant.
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantRlsContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ImpersonationAuditInterceptor,
    },
    // Global (backlog "Seguridad y Permisos" 2.2): ver el comentario junto a
    // ThrottlerModule.forRootAsync arriba. Sigue apagado en tests (skipIf).
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
