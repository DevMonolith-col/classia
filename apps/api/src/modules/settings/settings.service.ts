import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service";
import { UpdateSettingsDto } from "./settings.schemas";

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    const result: Record<string, any> = {};
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
    return result;
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const operations = Object.entries(dto).map(([key, value]) => {
      // TypeScript compiler complains without 'as any' for value if value is union type that Prisma doesn't perfectly match for Json
      return this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: value as any },
        create: { key, value: value as any },
      });
    });
    
    await this.prisma.$transaction(operations);
    return this.getSettings();
  }
}
