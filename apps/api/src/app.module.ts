import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import appConfig from "./config/app.config";
import databaseConfig from "./config/database.config";
import emailConfig from "./config/email.config";
import { envSchema } from "./config/env.schema";
import redisConfig from "./config/redis.config";
import storageConfig from "./config/storage.config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditCoreModule } from "./core/audit/audit-core.module";
import { ImpersonationAuditInterceptor } from "./common/interceptors/impersonation-audit.interceptor";
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
import { BootstrapModule } from "./modules/bootstrap/bootstrap.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", "../../.env.example"],
      validate: (config) => envSchema.parse(config),
      load: [appConfig, databaseConfig, redisConfig, storageConfig, emailConfig],
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    AuditCoreModule,
    TenantContextModule,
    HealthModule,
    TenantsModule,
    AuthModule,
    BootstrapModule,
    UsersModule,
    GroupsModule,
    StudentsModule,
    TeachersModule,
    GuardiansModule,
    SubjectsModule,
    SchedulesModule,
    EventsModule,
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
    SettingsModule,
    ElectionsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ImpersonationAuditInterceptor,
    },
  ],
})
export class AppModule {}
