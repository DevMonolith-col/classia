import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import appConfig from "./config/app.config";
import databaseConfig from "./config/database.config";
import { envSchema } from "./config/env.schema";
import redisConfig from "./config/redis.config";
import storageConfig from "./config/storage.config";
import { AuditCoreModule } from "./core/audit/audit-core.module";
import { PrismaModule } from "./core/prisma/prisma.module";
import { QueueModule } from "./core/queue/queue.module";
import { RedisModule } from "./core/redis/redis.module";
import { StorageModule } from "./core/storage/storage.module";
import { TenantContextModule } from "./core/tenant-context/tenant-context.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BootstrapModule } from "./modules/bootstrap/bootstrap.module";
import { EventsModule } from "./modules/events/events.module";
import { FilesModule } from "./modules/files/files.module";
import { GroupsModule } from "./modules/groups/groups.module";
import { GuardiansModule } from "./modules/guardians/guardians.module";
import { HealthModule } from "./modules/health/health.module";
import { HomeworkModule } from "./modules/homework/homework.module";
import { HomeworkSubmissionsModule } from "./modules/homework-submissions/homework-submissions.module";
import { MarksModule } from "./modules/marks/marks.module";
import { QuestionsModule } from "./modules/questions/questions.module";
import { QuizAttemptsModule } from "./modules/quiz-attempts/quiz-attempts.module";
import { SchedulesModule } from "./modules/schedules/schedules.module";
import { StudentsModule } from "./modules/students/students.module";
import { SubjectsModule } from "./modules/subjects/subjects.module";
import { TeachersModule } from "./modules/teachers/teachers.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", "../../.env.example"],
      validate: (config) => envSchema.parse(config),
      load: [appConfig, databaseConfig, redisConfig, storageConfig],
    }),
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
    AttendanceModule,
    MarksModule,
    HomeworkModule,
    HomeworkSubmissionsModule,
    QuestionsModule,
    QuizAttemptsModule,
    FilesModule,
    AuditModule,
  ],
})
export class AppModule {}
