import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { TeacherModule } from "./teacher/teacher.module";
import { GuardianModule } from "./guardian/guardian.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminModule,
    TeacherModule,
    GuardianModule,
  ],
})
export class AppModule {}
