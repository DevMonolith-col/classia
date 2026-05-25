import { IsString, IsNumber, IsOptional, IsInt, Min, Max } from "class-validator";

export class CreateMarkDto {
  @IsString()
  studentId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  title!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  value!: number;

  @IsInt()
  @Min(1)
  period!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxValue?: number;
}
