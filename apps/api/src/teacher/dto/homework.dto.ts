import { IsString, IsOptional, IsDateString } from "class-validator";

export class CreateHomeworkDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  subjectId!: string;

  @IsString()
  groupId!: string;

  @IsDateString()
  dueDate!: string;
}
