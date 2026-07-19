import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { FilesDataScopeGuard } from "./files-data-scope.guard";
import { FileKeyQuery, fileKeyQuerySchema } from "./files.schemas";
import { FilesService } from "./files.service";

// `files` sirve cualquier fileKey por una única ruta genérica: FilesDataScopeGuard
// resuelve el alcance real por payload (join fileKey -> entidad dueña), ver la
// tabla de resolución documentada ahí. `upload` no tiene key todavía (archivo
// recién subido, sin adjuntar) así que usa el fallback DATOS_PERSONALES del guard.
@Controller("files")
@UseGuards(JwtAuthGuard, PermissionsGuard, FilesDataScopeGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @Permissions(PERMISSIONS.FILES_UPLOAD)
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    return this.files.upload(file, user);
  }

  @Get("url")
  @Permissions(PERMISSIONS.FILES_READ)
  getDownloadUrl(
    @Query(new ZodValidationPipe(fileKeyQuerySchema)) query: FileKeyQuery,
    @CurrentUser() user: RequestUser,
  ) {
    return this.files.getDownloadUrl(query.key, user);
  }

  @Delete()
  @Permissions(PERMISSIONS.FILES_DELETE)
  delete(
    @Query(new ZodValidationPipe(fileKeyQuerySchema)) query: FileKeyQuery,
    @CurrentUser() user: RequestUser,
  ) {
    return this.files.delete(query.key, user);
  }
}
