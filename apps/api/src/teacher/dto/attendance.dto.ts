import { IsString, IsArray, IsDateString, ValidateNested, IsEnum } from "class-validator";
import { Type } from "class-transformer";

class AttendanceRecordDto {
  @IsString()
  studentId!: string;

  @IsEnum(["PRESENT", "ABSENT", "LATE", "JUSTIFIED", "PERMISSION"])
  status!: string;
}

export class CreateAttendanceDto {
  @IsString()
  scheduleId!: string;

  @IsDateString()
  date!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records!: AttendanceRecordDto[];
}
