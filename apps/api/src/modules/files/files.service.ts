import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RequestUser } from "../../common/types/request-context";
import { StorageService } from "../../core/storage/storage.service";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
]);

@Injectable()
export class FilesService {
  constructor(private readonly storage: StorageService) {}

  async upload(file: Express.Multer.File | undefined, actor: RequestUser) {
    if (!file) {
      throw new BadRequestException("A file is required.");
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("File exceeds the 15 MB limit.");
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed.`);
    }

    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const key = `tenants/${actor.tenantId}/${randomUUID()}-${sanitizedName}`;

    await this.storage.upload(key, file.buffer, file.mimetype);
    const url = await this.storage.getSignedDownloadUrl(key);

    return {
      key,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      url,
    };
  }

  async getDownloadUrl(key: string, actor: RequestUser) {
    this.assertKeyBelongsToTenant(key, actor);
    const url = await this.storage.getSignedDownloadUrl(key);
    return { key, url };
  }

  async delete(key: string, actor: RequestUser) {
    this.assertKeyBelongsToTenant(key, actor);
    await this.storage.delete(key);
    return { key, deleted: true };
  }

  private assertKeyBelongsToTenant(key: string, actor: RequestUser) {
    const isGlobalAdmin = actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.SUPPORT_AGENT;
    if (isGlobalAdmin) return;

    if (!key.startsWith(`tenants/${actor.tenantId}/`)) {
      throw new ForbiddenException("File is outside of current tenant.");
    }
  }
}
